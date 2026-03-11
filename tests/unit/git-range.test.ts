import { expect, mock, test } from 'bun:test';
import { getMockedLogger, mockLogger } from 'tests/mock/log.mock';

test('`resolveRange` resolves explicit refs deterministically', async () => {
  const mockedLogger = getMockedLogger();
  await mockLogger(mockedLogger);
  const execMock = mock(async (_command: string, args: string[], options: any) => {
    if (args[0] === 'rev-parse' && args[2] === 'HEAD') {
      return { stdout: 'to-sha\n', stderr: '', code: 0 };
    }
    if (args[0] === 'rev-parse' && args[2] === 'origin/main~10') {
      return { stdout: 'from-sha\n', stderr: '', code: 0 };
    }
    throw new Error(`Unexpected command args: ${args.join(' ')}`);
  });

  try {
    await mock.module('../../src/utils/cmd.ts', () => ({
      default: {
        exec: execMock,
      },
    }));

    const queryKey = 'git-range-explicit';
    const { resolveRange } = await import(
      `../../src/action/git/operations/read/range.ts?${queryKey}`
    );

    const range = await resolveRange({
      strategy: 'explicit',
      fromRef: 'origin/main~10',
      toRef: 'HEAD',
      targetLabel: 'app-1',
    });

    expect(range).toEqual({
      from: 'from-sha',
      to: 'to-sha',
      expression: 'from-sha..to-sha',
    });
  } finally {
    mock.restore();
  }
});

test('`resolveRange` resolves latest matching tag for target prefix', async () => {
  const mockedLogger = getMockedLogger();
  await mockLogger(mockedLogger);
  const execMock = mock(async (_command: string, args: string[], options: any) => {
    if (args[0] === 'rev-parse' && args[2] === 'HEAD') {
      return { stdout: 'to-sha\n', stderr: '', code: 0 };
    }
    if (args[0] === 'tag' && args[1] === '--merged') {
      return {
        stdout: 'app-2@v2.0.0\napp-1@v1.3.0\napp-1@v1.2.0\n',
        stderr: '',
        code: 0,
      };
    }
    if (args[0] === 'rev-list' && args[1] === '-n' && args[3] === 'app-1@v1.3.0') {
      return { stdout: 'from-sha\n', stderr: '', code: 0 };
    }
    throw new Error(`Unexpected command args: ${args.join(' ')}`);
  });

  try {
    await mock.module('../../src/utils/cmd.ts', () => ({
      default: {
        exec: execMock,
      },
    }));

    const queryKey = 'git-range-prefix';
    const { resolveRange } = await import(
      `../../src/action/git/operations/read/range.ts?${queryKey}`
    );

    const range = await resolveRange({
      strategy: 'latest-tag-with-prefix',
      fromRef: '',
      toRef: 'HEAD',
      targetLabel: 'app-1',
      tagPrefix: 'app-1@v',
    });

    expect(range).toEqual({
      from: 'from-sha',
      to: 'to-sha',
      expression: 'from-sha..to-sha',
    });
  } finally {
    mock.restore();
  }
});

test('latest-tag-with-prefix falls back to first commit when no tag matches', async () => {
  const mockedLogger = getMockedLogger();
  await mockLogger(mockedLogger);

  const execMock = mock(async (_command: string, args: string[], options: any) => {
    if (args[0] === 'rev-parse' && args[2] === 'HEAD') {
      return { stdout: 'to-sha\n', stderr: '', code: 0 };
    }
    if (args[0] === 'tag' && args[1] === '--merged') {
      return {
        stdout: 'app-2@v2.0.0\napp-2@v1.9.0\n',
        stderr: '',
        code: 0,
      };
    }
    if (args[0] === 'rev-list' && args[1] === '--max-parents=0') {
      return { stdout: 'root-sha\n', stderr: '', code: 0 };
    }
    throw new Error(`Unexpected command args: ${args.join(' ')}`);
  });

  try {
    await mock.module('../../src/utils/cmd.ts', () => ({
      default: {
        exec: execMock,
      },
    }));
    const queryKey = 'git-range-fallback';
    const { resolveRange } = await import(
      `../../src/action/git/operations/read/range.ts?${queryKey}`
    );

    const range = await resolveRange({
      strategy: 'latest-tag-with-prefix',
      fromRef: '',
      toRef: 'HEAD',
      targetLabel: 'app-1',
      tagPrefix: 'app-1@v',
    });

    expect(range).toEqual({
      from: 'root-sha',
      to: 'to-sha',
      expression: 'root-sha..to-sha',
    });
    const messages = mockedLogger.info.mock.calls.map((call) => String(call[0]));
    expect(
      messages.some((message) => message.includes('No matching tag found for target "app-1"')),
    ).toBe(true);
  } finally {
    mock.restore();
  }
});
