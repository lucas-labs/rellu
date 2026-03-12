import { expect, mock, test } from 'bun:test';

function createAnalysis() {
  return {
    range: 'abc123..def456',
    commitCount: 3,
    results: [
      {
        label: 'app-1',
        changed: true,
        matchedFiles: ['apps/app1/src/index.ts'],
        commitCount: 2,
        currentVersion: '1.2.3',
        nextVersion: '1.2.4',
        bump: 'patch' as const,
        commits: [
          {
            sha: 'abc1234',
            type: 'fix',
            scope: 'api',
            description: 'fix issue',
            emoji: null,
            isBreaking: false,
            rawSubject: 'fix(api): fix issue',
            body: '',
            author: {
              name: 'The Octocat',
              username: 'octocat',
              display: '@octocat',
            },
          },
        ],
        changelog: {
          markdown: '## Bug Fixes\n- api: fix issue (thanks @octocat) ([abc1234](...))',
        },
        versionSource: {
          file: 'apps/app1/package.json',
          type: 'node-package-json' as const,
        },
        skipRelease: false,
        releasePr: {
          enabled: true,
          action: 'updated' as const,
          branch: 'rellu/release/app-1',
          title: 'release(app-1): 🔖 v1.2.4',
          number: 123,
          url: 'https://github.com/lucas-labs/rellu/pull/123',
        },
      },
      {
        label: 'app-2',
        changed: false,
        matchedFiles: [],
        commitCount: 0,
        currentVersion: '2.0.0',
        nextVersion: '2.0.0',
        bump: 'none' as const,
        commits: [],
        changelog: {
          markdown: '',
        },
        versionSource: {
          file: 'apps/app2/Cargo.toml',
          type: 'rust-cargo-toml' as const,
        },
        skipRelease: true,
      },
    ],
  };
}

test('setOutputs writes top-level and per-target outputs using the current contract', async () => {
  const setOutput = mock((_name: string, _value: unknown) => {});
  const write = mock(() => Promise.resolve());
  const addRaw = mock((_body: string, _overwrite?: boolean) => ({ write }));

  try {
    await mock.module('@actions/core', () => ({
      setOutput,
      summary: {
        addRaw,
      },
    }));

    const queryKey = 'output-set-outputs';
    const { setOutputs } = await import(`../../src/utils/output.ts?${queryKey}`);
    const analysis = createAnalysis();

    setOutputs(analysis);

    expect(setOutput).toHaveBeenCalledWith('count-processed', 2);
    expect(setOutput).toHaveBeenCalledWith('pr-updated', 1);
    expect(setOutput).toHaveBeenCalledWith('pr-created', 0);
    expect(setOutput).toHaveBeenCalledWith('changed-targets', '["app-1"]');
    expect(setOutput).toHaveBeenCalledWith('has-changes', true);

    const resultJsonCall = setOutput.mock.calls.find((call) => call[0] === 'result-json');
    expect(resultJsonCall).toBeDefined();
    expect(JSON.parse(String(resultJsonCall?.[1] ?? '{}'))).toEqual(analysis);

    expect(setOutput).toHaveBeenCalledWith('app-1-label', 'app-1');
    expect(setOutput).toHaveBeenCalledWith('app-1-changed', true);
    expect(setOutput).toHaveBeenCalledWith(
      'app-1-matched-files',
      '["apps/app1/src/index.ts"]',
    );
    expect(setOutput).toHaveBeenCalledWith('app-1-commit-count', 2);
    expect(setOutput).toHaveBeenCalledWith('app-1-current-version', '1.2.3');
    expect(setOutput).toHaveBeenCalledWith('app-1-next-version', '1.2.4');
    expect(setOutput).toHaveBeenCalledWith('app-1-bump', 'patch');
    expect(setOutput).toHaveBeenCalledWith('app-1-commits', '["abc1234"]');
    expect(setOutput).toHaveBeenCalledWith(
      'app-1-changelog',
      '## Bug Fixes\n- api: fix issue (thanks @octocat) ([abc1234](...))',
    );
    expect(setOutput).toHaveBeenCalledWith(
      'app-1-version-source-file',
      'apps/app1/package.json',
    );
    expect(setOutput).toHaveBeenCalledWith('app-1-skip-release', false);
    expect(setOutput).toHaveBeenCalledWith('app-1-pr-enabled', true);
    expect(setOutput).toHaveBeenCalledWith('app-1-pr-action', 'updated');
    expect(setOutput).toHaveBeenCalledWith('app-1-pr-branch', 'rellu/release/app-1');
    expect(setOutput).toHaveBeenCalledWith('app-1-pr-title', 'release(app-1): 🔖 v1.2.4');
    expect(setOutput).toHaveBeenCalledWith('app-1-pr-number', '123');
    expect(setOutput).toHaveBeenCalledWith(
      'app-1-pr-url',
      'https://github.com/lucas-labs/rellu/pull/123',
    );

    expect(setOutput).toHaveBeenCalledWith('app-2-label', 'app-2');
    expect(setOutput).toHaveBeenCalledWith('app-2-changed', false);
    expect(setOutput).toHaveBeenCalledWith('app-2-matched-files', '[]');
    expect(setOutput).toHaveBeenCalledWith('app-2-commit-count', 0);
    expect(setOutput).toHaveBeenCalledWith('app-2-current-version', '2.0.0');
    expect(setOutput).toHaveBeenCalledWith('app-2-next-version', '2.0.0');
    expect(setOutput).toHaveBeenCalledWith('app-2-bump', 'none');
    expect(setOutput).toHaveBeenCalledWith('app-2-commits', '[]');
    expect(setOutput).toHaveBeenCalledWith('app-2-changelog', '');
    expect(setOutput).toHaveBeenCalledWith(
      'app-2-version-source-file',
      'apps/app2/Cargo.toml',
    );
    expect(setOutput).toHaveBeenCalledWith('app-2-skip-release', true);
    expect(setOutput.mock.calls.some((call) => call[0] === 'app-2-pr-action')).toBe(false);

    expect(addRaw).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  } finally {
    mock.restore();
  }
});

test('summary writes a markdown report with overview and pull request details', async () => {
  const setOutput = mock((_name: string, _value: unknown) => {});
  const write = mock(() => Promise.resolve());
  const addRaw = mock((_body: string, _overwrite?: boolean) => ({ write }));

  try {
    await mock.module('@actions/core', () => ({
      setOutput,
      summary: {
        addRaw,
      },
    }));

    const queryKey = 'output-summary';
    const { summary } = await import(`../../src/utils/output.ts?${queryKey}`);
    const analysis = createAnalysis();

    summary(analysis.results);

    expect(addRaw).toHaveBeenCalledTimes(1);
    const [body, overwrite] = addRaw.mock.calls[0] ?? [];
    expect(overwrite).toBe(true);
    expect(String(body)).toContain('## Rellu Release Summary');
    expect(String(body)).toContain('| app-1 | Yes | 2 | 1.2.3 | 1.2.4 | updated |');
    expect(String(body)).toContain('| app-2 | No | 0 | 2.0.0 | 2.0.0 | N/A |');
    expect(String(body)).toContain('| Yes | updated | rellu/release/app-1 |');
    expect(String(body)).toContain('No pull request information available.');
    expect(write).toHaveBeenCalledTimes(1);
  } finally {
    mock.restore();
  }
});
