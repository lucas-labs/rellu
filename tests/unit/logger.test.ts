import { expect, mock, test } from 'bun:test';
import { installCoreMock, resetCoreMock } from 'tests/mock/core.mock';

const TIMESTAMP_PREFIX = /^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[(INFO|WARN|ERROR|DEBUG)\] /;

test('logger prefixes info messages with timestamp and level metadata', async () => {
  try {
    await installCoreMock();
    const core = resetCoreMock();
    const loggerModulePath = `../../src/utils/logger.ts?logger-info-test=${Date.now()}`;
    const { log } = await import(loggerModulePath);

    log.info('Loaded configuration:', { targets: 2 });

    expect(core.info).toHaveBeenCalledTimes(1);

    const rendered = String(core.info.mock.calls[0]?.[0] ?? '');
    expect(rendered).toMatch(TIMESTAMP_PREFIX);
    expect(rendered).toContain('[INFO] Loaded configuration:');
    expect(rendered).toContain('"targets": 2');
  } finally {
    mock.restore();
  }
});

test('logger renders Error instances with details instead of empty objects', async () => {
  try {
    await installCoreMock();
    const core = resetCoreMock();
    const loggerModulePath = `../../src/utils/logger.ts?logger-test=${Date.now()}`;
    const { log } = await import(loggerModulePath);
    const cause = new Error('GitHub denied pull request creation');
    const error = new Error('Failed managing release PR for target "app-1"', { cause });

    Object.assign(error, {
      status: 403,
      request: {
        method: 'POST',
        url: 'https://api.github.com/repos/owner/repo/pulls',
      },
    });

    log.err('Failed to manage release PR for target app-1:', error);

    expect(core.error).toHaveBeenCalledTimes(1);

    const rendered = String(core.error.mock.calls[0]?.[0] ?? '');
    expect(rendered).toMatch(TIMESTAMP_PREFIX);
    expect(rendered).toContain('[ERROR] Failed to manage release PR for target app-1:');
    expect(rendered).toContain('Failed to manage release PR for target app-1:');
    expect(rendered).toContain('Error: Failed managing release PR for target "app-1"');
    expect(rendered).toContain('"status": 403');
    expect(rendered).toContain('"method": "POST"');
    expect(rendered).toContain('Caused by: Error: GitHub denied pull request creation');
  } finally {
    mock.restore();
  }
});
