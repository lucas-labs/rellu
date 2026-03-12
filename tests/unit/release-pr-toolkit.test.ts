import { expect, mock, test } from 'bun:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { loadConfig } from 'tests/mock/core.mock';
import { octokitMocks } from 'tests/mock/gh-client.mock';
import { mockIo } from 'tests/mock/io.mock';
import { mockLogger } from 'tests/mock/log.mock';

function setWorkspaceRoot(workspaceRoot: string): () => void {
  const previous = process.env.GITHUB_WORKSPACE;
  process.env.GITHUB_WORKSPACE = workspaceRoot;
  return () => {
    if (previous === undefined) {
      delete process.env.GITHUB_WORKSPACE;
      return;
    }
    process.env.GITHUB_WORKSPACE = previous;
  };
}

test('release PR management uses toolkit GitHub client and syncs metadata', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rellu-release-pr-test-'));
  const manifestPath = path.join(tempDir, 'package.json');
  const restoreWorkspace = setWorkspaceRoot(tempDir);
  await fs.writeFile(
    manifestPath,
    JSON.stringify({ name: 'app-1', version: '1.2.3' }, null, 2),
    'utf8',
  );

  await mockIo();
  await mockLogger();

  try {
    const execMock = mock(async (_command: string, args: string[], options: any) => {
      if (args[0] === 'status') {
        return { stdout: ` M ${manifestPath}\n`, stderr: '', code: 0 };
      }
      return { stdout: '', stderr: '', code: 0 };
    });

    const listPullMock = octokitMocks.rest.pulls.list();
    const createPullMock = octokitMocks.rest.pulls.create();
    const updatePullMock = octokitMocks.rest.pulls.update();

    await mock.module('@actions/github', () => ({
      getOctokit: () => ({
        rest: {
          pulls: {
            list: listPullMock,
            create: createPullMock,
            update: updatePullMock,
          },
        },
      }),
    }));

    await mock.module('../../src/utils/cmd.ts', () => ({
      default: {
        exec: execMock,
      },
    }));

    const queryKey = 'release-pr-existing-open';
    const config = await loadConfig({
      queryKey,
      inputs: {
        'github-token': `gh-fake-token-${queryKey}`,
      },
      config: {
        targets: [
          {
            label: 'app-1',
            paths: ['apps/app1/**/*'],
            releasePr: { enabled: true },
            version: {
              file: manifestPath,
              type: 'node-package-json',
            },
          },
        ],
      },
    });

    const { maybeManageReleasePr } = await import(
      `../../src/action/release/index.ts?${queryKey}`
    );

    const outcome = await maybeManageReleasePr(config, {
      label: 'app-1',
      changed: true,
      matchedFiles: ['apps/app1/src/index.ts', 'apps/app1/foo/bar/baz.ts'],
      commitCount: 3,
      currentVersion: '1.2.3',
      nextVersion: '1.2.4',
      bump: 'patch',
      commits: [],
      changelog: { markdown: '## Bug Fixes\n- fix' },
      versionSource: {
        file: manifestPath,
        type: 'node-package-json',
      },
      skipRelease: false,
    });

    expect(listPullMock).toHaveBeenCalled();
    expect(updatePullMock).toHaveBeenCalled();
    expect(createPullMock).toHaveBeenCalledTimes(0);

    expect(outcome.changed).toBe(true);
    expect(outcome.releasePr).toEqual({
      enabled: true,
      action: 'updated',
      branch: 'rellu/release/app-1',
      title: 'release(app-1): 🔖 v1.2.4',
      number: 123,
      url: 'https://example.local/pull/123',
    });
  } finally {
    mock.restore();
    restoreWorkspace();
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test('release PR regeneration resets branch from base and writes exactly one fresh release commit', async () => {
  const tempDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'rellu-release-pr-reset-semantics-'),
  );
  const manifestPath = path.join(tempDir, 'package.json');
  const restoreWorkspace = setWorkspaceRoot(tempDir);
  await fs.writeFile(
    manifestPath,
    JSON.stringify({ name: 'app-1', version: '1.2.3' }, null, 2),
    'utf8',
  );

  try {
    const execMock = mock(async (_command: string, args: string[], options: any) => {
      if (args[0] === 'status') {
        return { stdout: ` M ${manifestPath}\n`, stderr: '', code: 0 };
      }
      return { stdout: '', stderr: '', code: 0 };
    });

    await mockLogger();

    const queryKey = 'release-pr-reset-semantics';

    const config = await loadConfig({
      queryKey,
      inputs: {
        'github-token': `gh-fake-token-${queryKey}`,
        'release-branch-prefix': 'rellu/release',
        'base-branch': 'main',
      },
      config: {
        targets: [
          {
            label: 'app-1',
            paths: ['apps/app1/**/*'],
            releasePr: { enabled: true },
            version: {
              file: manifestPath,
              type: 'node-package-json',
            },
          },
        ],
      },
    });

    await mock.module('@actions/github', () => ({
      getOctokit: () => ({
        rest: {
          pulls: {
            list: octokitMocks.rest.pulls.list(),
            create: octokitMocks.rest.pulls.create(),
            update: octokitMocks.rest.pulls.update(),
          },
        },
      }),
    }));

    await mock.module('../../src/utils/cmd.ts', () => ({
      default: {
        exec: execMock,
      },
    }));

    const { maybeManageReleasePr } = await import(
      `../../src/action/release/index.ts?${queryKey}`
    );

    await maybeManageReleasePr(config, {
      label: 'app-1',
      changed: true,
      matchedFiles: ['apps/app1/src/index.ts', 'apps/app1/foo/bar/baz.ts'],
      commitCount: 3,
      currentVersion: '1.2.3',
      nextVersion: '1.2.4',
      bump: 'patch',
      commits: [],
      changelog: { markdown: '## Bug Fixes\n- fix' },
      versionSource: {
        file: manifestPath,
        type: 'node-package-json',
      },
      skipRelease: false,
    });

    const checkoutCalls = execMock.mock.calls.filter((call) => call[1]?.[0] === 'checkout');
    expect(checkoutCalls).toHaveLength(1);
    expect(checkoutCalls[0]?.[1]).toEqual([
      'checkout',
      '-B',
      'rellu/release/app-1',
      'origin/main',
    ]);

    const commitCalls = execMock.mock.calls.filter((call) => call[1]?.[0] === 'commit');
    expect(commitCalls).toHaveLength(1);
    expect(commitCalls[0]?.[1]).toEqual([
      'commit',
      '-m',
      'release(app-1): 🔖 v1.2.4',
      '--no-verify',
    ]);

    const pushCalls = execMock.mock.calls.filter((call) => call[1]?.[0] === 'push');
    expect(pushCalls).toHaveLength(1);
    expect(pushCalls[0]?.[1]).toEqual(['push', 'origin', '+rellu/release/app-1']);

    const addCalls = execMock.mock.calls.filter((call) => call[1]?.[0] === 'add');
    expect(addCalls).toHaveLength(1);
    expect(addCalls[0]?.[1]).toEqual(['add', manifestPath]);
  } finally {
    mock.restore();
    restoreWorkspace();
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test('release PR management marks non-releasable targets with disabled releasePr metadata', async () => {
  try {
    const execMock = mock(async () => ({
      stdout: '',
      stderr: '',
      code: 0,
    }));

    const queryKey = 'release-pr-skipped-target';

    await mockLogger();

    await mock.module('../../src/utils/cmd.ts', () => ({
      default: {
        exec: execMock,
      },
    }));

    await mock.module('@actions/github', () => ({
      getOctokit: () => ({
        rest: {
          pulls: {
            list: octokitMocks.rest.pulls.list(),
            create: octokitMocks.rest.pulls.create(),
            update: octokitMocks.rest.pulls.update(),
          },
        },
      }),
    }));

    const config = await loadConfig({
      queryKey,
      inputs: {
        'github-token': `gh-fake-token-${queryKey}`,
        'release-branch-prefix': 'rellu/release',
        'base-branch': 'main',
      },
      config: {
        targets: [
          {
            label: 'app-1',
            paths: ['apps/app1/**/*'],
            releasePr: { enabled: true },
            version: {
              file: 'apps/app1/package.json',
              type: 'node-package-json',
            },
          },
        ],
      },
    });

    const { maybeManageReleasePr } = await import(
      `../../src/action/release/index.ts?${queryKey}`
    );

    const outcome = await maybeManageReleasePr(config, {
      label: 'app-1',
      changed: true,
      matchedFiles: ['apps/app1/src/index.ts'],
      commitCount: 1,
      currentVersion: '1.2.3',
      nextVersion: '1.2.3',
      bump: 'none',
      commits: [],
      changelog: { markdown: '## No Releases' },
      versionSource: {
        file: 'apps/app1/package.json',
        type: 'node-package-json',
      },
      skipRelease: true,
    });

    expect(outcome.skipRelease).toBe(true);
    expect(outcome.releasePr).toEqual({ enabled: false, action: 'none' });
    expect(execMock).toHaveBeenCalledTimes(0);
  } finally {
    mock.restore();
  }
});

test('release PR management uses sanitized changelog markdown for PR body updates', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rellu-release-pr-sanitized-body-'));
  const manifestPath = path.join(tempDir, 'package.json');
  const restoreWorkspace = setWorkspaceRoot(tempDir);
  await fs.writeFile(
    manifestPath,
    JSON.stringify({ name: 'app-1', version: '1.2.3' }, null, 2),
    'utf8',
  );

  try {
    const execMock = mock(async (_command: string, args: string[], _options: any) => {
      if (args[0] === 'status') {
        return { stdout: ` M ${manifestPath}\n`, stderr: '', code: 0 };
      }
      return { stdout: '', stderr: '', code: 0 };
    });

    const queryKey = 'release-pr-sanitized-body';
    const config = await loadConfig({
      queryKey,
      inputs: {
        'github-token': `gh-fake-token-${queryKey}`,
        'release-branch-prefix': 'rellu/release',
        'base-branch': 'main',
      },
      config: {
        targets: [
          {
            label: 'app-1',
            paths: ['apps/app1/**/*'],
            releasePr: { enabled: true },
            version: {
              file: 'apps/app1/package.json',
              type: 'node-package-json',
            },
          },
        ],
      },
    });

    await mockLogger();

    await mock.module('../../src/utils/cmd.ts', () => ({
      default: {
        exec: execMock,
      },
    }));

    const listPrMock = octokitMocks.rest.pulls.list();
    const createPrMock = octokitMocks.rest.pulls.create();
    const updatePrMock = octokitMocks.rest.pulls.update();

    await mock.module('@actions/github', () => ({
      getOctokit: () => ({
        rest: {
          pulls: {
            list: listPrMock,
            create: createPrMock,
            update: updatePrMock,
          },
        },
      }),
    }));

    const { maybeManageReleasePr } = await import(
      `../../src/action/release/index.ts?${queryKey}`
    );

    const sanitizedMarkdown =
      '## Bug Fixes\n- api: escape \\[link\\]\\(url\\) and ping \\@team (thanks @alice(bot)) ([abc1234](...))';

    await maybeManageReleasePr(config, {
      label: 'app-1',
      changed: true,
      matchedFiles: [manifestPath],
      commitCount: 1,
      currentVersion: '1.2.3',
      nextVersion: '1.2.4',
      bump: 'patch',
      commits: [
        {
          sha: 'abc1234',
          type: 'fix',
          scope: 'api',
          description: 'escape [link](url) and ping @team',
          isBreaking: false,
          rawSubject: 'fix(api): escape [link](url) and ping @team',
          body: '',
          author: {
            name: 'Alice',
            username: 'alice',
            display: '@alice(bot)',
          },
        },
      ],
      changelog: { markdown: sanitizedMarkdown },
      versionSource: { file: manifestPath, type: 'node-package-json' },
      skipRelease: false,
    });

    expect(updatePrMock).toHaveBeenCalledTimes(1);
    expect(updatePrMock).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      pull_number: 123,
      title: 'release(app-1): 🔖 v1.2.4',
      body: sanitizedMarkdown,
    });
  } finally {
    mock.restore();
    restoreWorkspace();
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test('release PR management honors per-target releasePr.enabled opt-out while globally enabled', async () => {
  try {
    const queryKey = 'release-pr-target-opt-out';

    const execMock = mock(async () => ({
      stdout: '',
      stderr: '',
      code: 0,
    }));

    await mock.module('../../src/utils/cmd.ts', () => ({
      default: {
        exec: execMock,
      },
    }));

    await mockIo();
    await mockLogger();

    const listPrMock = octokitMocks.rest.pulls.list();
    const createPrMock = octokitMocks.rest.pulls.create();
    const updatePrMock = octokitMocks.rest.pulls.update();

    await mock.module('@actions/github', () => ({
      getOctokit: () => ({
        rest: {
          pulls: {
            list: listPrMock,
            create: createPrMock,
            update: updatePrMock,
          },
        },
      }),
    }));

    const config = await loadConfig({
      queryKey,
      inputs: {
        'github-token': `gh-fake-token-${queryKey}`,
        'release-branch-prefix': 'rellu/release',
        'base-branch': 'main',
      },
      config: {
        targets: [
          {
            label: 'app-1',
            paths: ['apps/app1/**/*'],
            releasePr: { enabled: false },
            version: {
              file: 'apps/app1/package.json',
              type: 'node-package-json',
            },
          },
        ],
      },
    });

    const { maybeManageReleasePr } = await import(
      `../../src/action/release/index.ts?${queryKey}`
    );

    const outcome = await maybeManageReleasePr(config, {
      label: 'app-1',
      changed: true,
      matchedFiles: ['apps/app1/src/index.ts'],
      commitCount: 1,
      currentVersion: '1.2.3',
      nextVersion: '1.2.4',
      bump: 'patch',
      commits: [],
      changelog: { markdown: '## Bug Fixes\n- fix' },
      versionSource: {
        file: 'apps/app1/package.json',
        type: 'node-package-json',
      },
      skipRelease: false,
    });

    expect(outcome.releasePr.enabled).toBe(false);
    expect(execMock).toHaveBeenCalledTimes(0);
    expect(listPrMock).toHaveBeenCalledTimes(0);
    expect(createPrMock).toHaveBeenCalledTimes(0);
    expect(updatePrMock).toHaveBeenCalledTimes(0);
  } finally {
    mock.restore();
  }
});

test('release PR management preserves global-only behavior when target releasePr is omitted', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rellu-release-pr-global-only-'));
  const manifestPath = path.join(tempDir, 'package.json');
  const restoreWorkspace = setWorkspaceRoot(tempDir);
  await fs.writeFile(
    manifestPath,
    JSON.stringify({ name: 'app-1', version: '1.2.3' }, null, 2),
    'utf8',
  );

  try {
    const queryKey = 'release-pr-global-only-target-default';
    await mockLogger();
    await mockIo();

    const execMock = mock(async (_command: string, args: string[], _options: any) => {
      if (args[0] === 'status') {
        return { stdout: ` M ${manifestPath}\n`, stderr: '', code: 0 };
      }
      return { stdout: '', stderr: '', code: 0 };
    });

    const listPullMock = octokitMocks.rest.pulls.list();
    const createPullMock = octokitMocks.rest.pulls.create();
    const updatePullMock = octokitMocks.rest.pulls.update();

    const config = await loadConfig({
      queryKey,
      inputs: {
        'github-token': `gh-fake-token-${queryKey}`,
      },
      config: {
        targets: [
          {
            label: 'app-1',
            paths: ['apps/app1/**/*'],
            version: {
              file: manifestPath,
              type: 'node-package-json',
            },
          },
        ],
      },
    });

    await mock.module('../../src/utils/cmd.ts', () => ({
      default: {
        exec: execMock,
      },
    }));

    await mock.module('@actions/github', () => ({
      getOctokit: () => ({
        rest: {
          pulls: {
            list: listPullMock,
            create: createPullMock,
            update: updatePullMock,
          },
        },
      }),
    }));

    const { maybeManageReleasePr } = await import(
      `../../src/action/release/index.ts?${queryKey}`
    );

    const outcome = await maybeManageReleasePr(config, {
      label: 'app-1',
      changed: true,
      matchedFiles: [manifestPath],
      commitCount: 1,
      currentVersion: '1.2.3',
      nextVersion: '1.2.4',
      bump: 'patch',
      commits: [],
      changelog: { markdown: '## Bug Fixes\n- fix' },
      versionSource: { file: manifestPath, type: 'node-package-json' },
      skipRelease: false,
    });

    expect(outcome.releasePr?.enabled).toBe(true);
    expect(outcome.releasePr?.action).toBe('updated');
    expect(outcome.releasePr?.branch).toBe('rellu/release/app-1');
    expect(listPullMock).toHaveBeenCalledTimes(1);
    expect(createPullMock).toHaveBeenCalledTimes(0);
    expect(updatePullMock).toHaveBeenCalledTimes(1);
  } finally {
    mock.restore();
    restoreWorkspace();
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test('release PR management uses per-target branchPrefix and baseBranch overrides', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rellu-release-pr-override-'));
  const manifestPath = path.join(tempDir, 'package.json');
  const restoreWorkspace = setWorkspaceRoot(tempDir);
  await fs.writeFile(
    manifestPath,
    JSON.stringify({ name: 'app-1', version: '1.2.3' }, null, 2),
    'utf8',
  );

  try {
    const queryKey = 'release-pr-target-prefix-base-override';
    await mockLogger();
    await mockIo();

    const execMock = mock(async (_command: string, args: string[], _options: any) => {
      if (args[0] === 'status') {
        return { stdout: ` M ${manifestPath}\n`, stderr: '', code: 0 };
      }
      return { stdout: '', stderr: '', code: 0 };
    });

    const listPullMock = octokitMocks.rest.pulls.list();
    const createPullMock = octokitMocks.rest.pulls.create();
    const updatePullMock = octokitMocks.rest.pulls.update();

    const config = await loadConfig({
      queryKey,
      inputs: {
        'github-token': `gh-fake-token-${queryKey}`,
      },
      config: {
        targets: [
          {
            label: 'app-1',
            paths: ['apps/app1/**/*'],

            releasePr: {
              enabled: true,
              branchPrefix: 'custom/release/',
              baseBranch: 'release-main',
            },
            version: {
              file: manifestPath,
              type: 'node-package-json',
            },
          },
        ],
      },
    });

    await mock.module('../../src/utils/cmd.ts', () => ({
      default: {
        exec: execMock,
      },
    }));

    await mock.module('@actions/github', () => ({
      getOctokit: () => ({
        rest: {
          pulls: {
            list: listPullMock,
            create: createPullMock,
            update: updatePullMock,
          },
        },
      }),
    }));

    const { maybeManageReleasePr } = await import(
      `../../src/action/release/index.ts?${queryKey}`
    );

    const outcome = await maybeManageReleasePr(config, {
      label: 'app-1',
      changed: true,
      matchedFiles: [manifestPath],
      commitCount: 1,
      currentVersion: '1.2.3',
      nextVersion: '1.2.4',
      bump: 'patch',
      commits: [],
      changelog: { markdown: '## Bug Fixes\n- fix' },
      versionSource: { file: manifestPath, type: 'node-package-json' },
      skipRelease: false,
    });

    expect(outcome.releasePr.enabled).toBe(true);
    expect(outcome.releasePr?.branch).toBe('custom/release/app-1');

    const fetchCalls = execMock.mock.calls.filter((call) => call[1]?.[0] === 'fetch');
    expect(fetchCalls.some((call) => call[1]?.[2] === 'release-main')).toBe(true);

    const checkoutCalls = execMock.mock.calls.filter((call) => call[1]?.[0] === 'checkout');
    expect(checkoutCalls.some((call) => call[1]?.[2] === 'custom/release/app-1')).toBe(true);
    expect(checkoutCalls.some((call) => call[1]?.[3] === 'origin/release-main')).toBe(true);

    expect(listPullMock).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      state: 'open',
      head: 'owner:custom/release/app-1',
      per_page: 100,
      base: 'release-main',
    });
    expect(updatePullMock).toHaveBeenCalledTimes(1);
  } finally {
    mock.restore();
    restoreWorkspace();
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test('release PR management fails fast on malformed repository slug', async () => {
  try {
    const queryKey = 'release-pr-invalid-repo';
    await mockLogger();
    await mockIo();
    const execMock = mock(async () => ({
      stdout: '',
      stderr: '',
      code: 0,
    }));

    await mock.module('../../src/utils/cmd.ts', () => ({
      default: {
        exec: execMock,
      },
    }));

    const listPullMock = octokitMocks.rest.pulls.list();
    const createPullMock = octokitMocks.rest.pulls.create();
    const updatePullMock = octokitMocks.rest.pulls.update();

    await mock.module('@actions/github', () => ({
      getOctokit: () => ({
        rest: {
          pulls: {
            list: listPullMock,
            create: createPullMock,
            update: updatePullMock,
          },
          search: {
            users: octokitMocks.rest.search.users(),
          },
          repos: {
            getCommit: octokitMocks.rest.repos.getCommit(),
          },
        },
      }),
    }));

    const config = await loadConfig({
      queryKey,
      inputs: {
        'github-token': `gh-fake-token-${queryKey}`,
        repo: 'owner/repo/invalid',
      },
      config: {
        targets: [
          {
            label: 'app-1',
            paths: ['apps/app1/**/*'],
            releasePr: {
              enabled: true,
              branchPrefix: 'custom/release/',
              baseBranch: 'release-main',
            },
            version: {
              file: 'apps/app1/package.json',
              type: 'node-package-json',
            },
          },
        ],
      },
    });

    const { maybeManageReleasePr } = await import(
      `../../src/action/release/index.ts?${queryKey}`
    );

    expect(
      maybeManageReleasePr(config, {
        label: 'app-1',
        changed: true,
        matchedFiles: ['foo/bar/baz.ts'],
        commitCount: 1,
        currentVersion: '1.2.3',
        nextVersion: '1.2.4',
        bump: 'patch',
        commits: [],
        changelog: { markdown: '## Bug Fixes\n- fix' },
        versionSource: { file: 'foo/bar/package.json', type: 'node-package-json' },
        skipRelease: false,
      }),
    ).rejects.toThrow(/Expected format "owner\/name"/);

    expect(listPullMock).toHaveBeenCalledTimes(0);
    expect(createPullMock).toHaveBeenCalledTimes(0);
    expect(updatePullMock).toHaveBeenCalledTimes(0);
  } finally {
    mock.restore();
  }
});

test('release PR management blocks force-push when resolved branch is not automation-owned', async () => {
  const queryKey = 'release-pr-unsafe-branch-force-push-block';
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rellu-release-pr-unsafe-branch-'));
  const manifestPath = path.join(tempDir, 'package.json');
  const restoreWorkspace = setWorkspaceRoot(tempDir);
  await fs.writeFile(
    manifestPath,
    JSON.stringify({ name: 'app-1', version: '1.2.3' }, null, 2),
    'utf8',
  );

  try {
    await mockLogger();
    await mockIo();
    const execMock = mock(async (_command: string, args: string[]) => {
      if (args[0] === 'status') {
        return { stdout: ` M ${manifestPath}\n`, stderr: '', code: 0 };
      }
      return { stdout: '', stderr: '', code: 0 };
    });

    await mock.module('../../src/utils/cmd.ts', () => ({
      default: {
        exec: execMock,
      },
    }));

    const listPullMock = octokitMocks.rest.pulls.list();
    const updatePullMock = octokitMocks.rest.pulls.update();
    const createPullMock = octokitMocks.rest.pulls.create();

    await mock.module('@actions/github', () => ({
      getOctokit: () => ({
        rest: {
          pulls: {
            list: listPullMock,
            update: updatePullMock,
            create: createPullMock,
          },
          search: {
            users: octokitMocks.rest.search.users(),
          },
          repos: {
            getCommit: octokitMocks.rest.repos.getCommit(),
          },
        },
      }),
    }));

    const { maybeManageReleasePr } = await import(
      `../../src/action/release/index.ts?${queryKey}`
    );

    const config = await loadConfig({
      queryKey,
      inputs: {
        'base-branch': 'main',
        'github-token': `gh-fake-token-${queryKey}`,
        'release-branch-prefix': 'main',
      },
      config: {
        targets: [
          {
            label: 'app-1',
            paths: ['apps/app1/**/*'],

            releasePr: { enabled: true },
            version: {
              file: manifestPath,
              type: 'node-package-json',
            },
          },
        ],
      },
    });

    await expect(
      maybeManageReleasePr(config, {
        label: 'app-1',
        changed: true,
        matchedFiles: [manifestPath],
        commitCount: 1,
        currentVersion: '1.2.3',
        nextVersion: '1.2.4',
        bump: 'patch',
        commits: [],
        changelog: { markdown: '## Bug Fixes\n- fix' },
        versionSource: { file: manifestPath, type: 'node-package-json' },
        skipRelease: false,
      }),
    ).rejects.toThrow(/Security validation failed for release branch/);

    const pushCalls = execMock.mock.calls.filter(
      (call) => call[1]?.[0] === 'push' && String(call[1]?.[2] ?? '').startsWith('+'),
    );
    expect(pushCalls.length).toBe(0);
    expect(listPullMock).toHaveBeenCalledTimes(0);
    expect(updatePullMock).toHaveBeenCalledTimes(0);
    expect(createPullMock).toHaveBeenCalledTimes(0);
  } finally {
    mock.restore();
    restoreWorkspace();
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});
