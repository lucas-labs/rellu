import { expect, mock, test } from 'bun:test';
import { readFixtureJson } from '../helpers/fixtures.ts';
import git from '../../src/action/git/index.ts';
import { analyzeTargetImpacts } from '../../src/action/target/impacts.ts';
import { TargetSchema } from '@/action/config/schema.ts';
import { getReleaseBranchName } from '../../src/action/release/index.ts';

function createLogger() {
  return {
    info: () => {},
    warn: () => {},
    error: () => {},
  };
}

test('fixture: shared-path commits are assigned to every matching target', async () => {
  const targetsRaw = await readFixtureJson<
    Array<{
      label: string;
      paths: string[];
      version: {
        file: string;
        type: 'node-package-json' | 'rust-cargo-toml' | 'python-pyproject-toml';
      };
    }>
  >('multi-target-shared/targets.json');
  const commits = await readFixtureJson<
    Array<{ sha: string; subject: string; body: string; files: string[] }>
  >('multi-target-shared/commits.json');
  const commitsWithParsed = commits.map((commit) => ({
    ...commit,
    conventional: git.commits.conventional.parse(commit.subject, commit.body),
  }));

  const targets = targetsRaw.map((t) => TargetSchema.parse(t));

  const impacts = analyzeTargetImpacts(targets, commitsWithParsed);
  const app1 = impacts.find((impact) => impact.label === 'app-1');
  const app2 = impacts.find((impact) => impact.label === 'app-2');

  expect(app1?.changed).toBe(true);
  expect(app2?.changed).toBe(true);
  expect(app1?.commitCount).toBe(2);
  expect(app2?.commitCount).toBe(1);
});

test('fixture: strict mode fails for invalid conventional commits', async () => {
  const commits = await readFixtureJson<Array<{ sha: string; subject: string; body: string }>>(
    'strict-invalid/commits.json',
  );
  const invalid = git.commits.conventional.parse(commits[0].subject, commits[0].body);
  expect(() =>
    git.commits.conventional.valid(
      invalid,
      true,
      'app-1',
      commits[0].sha,
      commits[0].subject,
      {
        isMerge: false,
      },
    ),
  ).toThrow(/Invalid conventional commit/);
});

test('fixture: merge handling stays deterministic for target impact outputs', () => {
  const targetsRaw = [
    {
      label: 'app-1',
      paths: ['apps/app1/**/*'],
      version: {
        file: 'apps/app1/package.json',
        type: 'node-package-json' as const,
      },
    },
  ];

  const commits = [
    {
      sha: 'a1',
      files: ['apps/app1/src/a.ts'],
    },
    {
      sha: 'm1',
      files: ['apps/app1/src/b.ts'],
    },
  ];

  const targets = targetsRaw.map((t) => TargetSchema.parse(t));

  const first = analyzeTargetImpacts(targets, commits);
  const second = analyzeTargetImpacts(targets, commits);
  expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  expect(first[0]?.changed).toBe(true);
  expect(first[0]?.matchedFiles).toEqual(['apps/app1/src/a.ts', 'apps/app1/src/b.ts']);
  expect(first[0]?.commitCount).toBe(2);
});

test('fixture: release branch naming is deterministic and idempotent', async () => {
  const fixture = await readFixtureJson<{
    releaseBranchPrefix: string;
    label: string;
    expectedBranch: string;
  }>('release-idempotency/config.json');
  const first = getReleaseBranchName(fixture.releaseBranchPrefix, fixture.label);
  const second = getReleaseBranchName(fixture.releaseBranchPrefix, fixture.label);
  expect(first).toBe(fixture.expectedBranch);
  expect(second).toBe(fixture.expectedBranch);
});

test('fixture: per-target tag-prefix range resolution stays isolated and deterministic', async () => {
  const fixture = await readFixtureJson<{
    toRef: string;
    mergedTags: string[];
    tagCommits: Record<string, string>;
    firstCommit: string;
    targets: Array<{
      label: string;
      tagPrefix: string;
      expectedRange: string;
      expectsFallback?: boolean;
    }>;
  }>('tag-prefix-per-target/config.json');

  const execMock = mock(async (_command: string, args: string[], _options: any) => {
    if (args[0] === 'rev-parse' && args[2] === fixture.toRef) {
      return { stdout: 'to-sha\n', stderr: '', code: 0 };
    }
    if (args[0] === 'tag' && args[1] === '--merged') {
      return {
        stdout: `${fixture.mergedTags.join('\n')}\n`,
        stderr: '',
        code: 0,
      };
    }
    if (args[0] === 'rev-list' && args[1] === '-n' && args[2] === '1') {
      const tag = args[3] ?? '';
      const sha = fixture.tagCommits[tag];
      if (!sha) {
        throw new Error(`Unexpected tag lookup: ${tag}`);
      }
      return { stdout: `${sha}\n`, stderr: '', code: 0 };
    }
    if (args[0] === 'rev-list' && args[1] === '--max-parents=0') {
      return { stdout: `${fixture.firstCommit}\n`, stderr: '', code: 0 };
    }
    throw new Error(`Unexpected git command args: ${args.join(' ')}`);
  });

  try {
    await mock.module('../../src/utils/cmd.ts', () => ({
      default: {
        exec: execMock,
      },
    }));

    const queryKey = 'integration-tag-prefix-per-target';
    const { resolveRange } = await import(
      `../../src/action/git/operations/read/range.ts?${queryKey}`
    );
    const logger = createLogger();

    const rangesFirstPass = await Promise.all(
      fixture.targets.map((target) =>
        resolveRange({
          strategy: 'latest-tag-with-prefix',
          fromRef: '',
          toRef: fixture.toRef,
          targetLabel: target.label,
          tagPrefix: target.tagPrefix,
        }),
      ),
    );
    const rangesSecondPass = await Promise.all(
      fixture.targets.map((target) =>
        resolveRange(
          {
            strategy: 'latest-tag-with-prefix',
            fromRef: '',
            toRef: fixture.toRef,
            targetLabel: target.label,
            tagPrefix: target.tagPrefix,
          },
          logger,
        ),
      ),
    );

    for (const [index, target] of fixture.targets.entries()) {
      expect(rangesFirstPass[index]?.expression).toBe(target.expectedRange);
    }
    expect(JSON.stringify(rangesFirstPass)).toBe(JSON.stringify(rangesSecondPass));
  } finally {
    mock.restore();
  }
});

test('fixture: strict mode accepts merge subjects when relevant non-merge commits are valid', async () => {
  const fixture = await readFixtureJson<{
    target: {
      label: string;
      paths: string[];
      version: { file: string; type: 'node-package-json' };
    };
    commits: Array<{
      sha: string;
      subject: string;
      body: string;
      isMerge: boolean;
      files: string[];
    }>;
  }>('strict-merge-valid/commits.json');

  const parsed = fixture.commits.map((commit) => ({
    ...commit,
    conventional: git.commits.conventional.parse(commit.subject, commit.body),
  }));

  for (const commit of parsed) {
    expect(() =>
      git.commits.conventional.valid(
        commit.conventional,
        true,
        fixture.target.label,
        commit.sha,
        commit.subject,
        {
          isMerge: commit.isMerge,
        },
      ),
    ).not.toThrow();
  }

  const impacts = analyzeTargetImpacts(
    [TargetSchema.parse(fixture.target)],
    parsed.map((entry) => ({ sha: entry.sha, files: entry.files })),
  );
  expect(impacts[0]?.changed).toBe(true);
  expect(impacts[0]?.commitCount).toBe(2);
  expect(impacts[0]?.matchedFiles).toEqual([
    'apps/app1/src/config.ts',
    'apps/app1/src/merge.ts',
  ]);
});
