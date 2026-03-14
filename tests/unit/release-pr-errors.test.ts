import { expect, mock, test } from 'bun:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { mockIo } from 'tests/mock/io.mock';
import { mockLogger } from 'tests/mock/log.mock';
import { octokitMocks } from 'tests/mock/gh-client.mock';

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

test('release PR management preserves the original GitHub failure as the thrown cause', async () => {
  const queryKey = 'release-pr-preserves-github-error-cause';
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rellu-release-pr-cause-'));
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

    const githubError = Object.assign(
      new Error('GitHub Actions is not permitted to create pull requests'),
      {
        status: 403,
      },
    );

    const listPullMock = mock(async () => {
      throw githubError;
    });

    await mock.module('@actions/github', () => ({
      getOctokit: () => ({
        rest: {
          pulls: {
            list: listPullMock,
            create: octokitMocks.rest.pulls.create(),
            update: octokitMocks.rest.pulls.update(),
          },
        },
      }),
    }));

    const config = {
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
      inputs: {
        githubToken: `gh-fake-token-${queryKey}`,
        releaseBranchPrefix: 'rellu/release',
        baseBranch: 'main',
        repo: 'owner/repo',
        releaseCommitMessagePattern: 'release({target}): 🔖 v{version}',
      },
    } as any;

    const { maybeManageReleasePr } = await import(
      `../../src/action/release/index.ts?${queryKey}`
    );

    let thrown: unknown;
    try {
      await maybeManageReleasePr(config, {
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
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toContain(
      'Failed managing release PR for target "app-1"',
    );
    expect((thrown as Error).message).toContain(
      'GitHub Actions is not permitted to create pull requests',
    );
    expect((thrown as Error & { cause?: unknown }).cause).toBe(githubError);
    expect(listPullMock).toHaveBeenCalledTimes(1);
  } finally {
    mock.restore();
    restoreWorkspace();
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});
