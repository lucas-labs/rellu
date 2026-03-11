import { expect, mock, test } from 'bun:test';
import { octokitMocks } from 'tests/mock/gh-client.mock.ts';
import type { RelluActionInputs } from '../../src/action/config/schema.ts';

function createLogger() {
  return {
    info: (_message: string) => {},
    warn: (_message: string) => {},
    error: (_message: string) => {},
  };
}

test('enrichCommits applies association -> email -> author-name fallback', async () => {
  try {
    const getCommitMock = octokitMocks.rest.repos.getCommit();
    const searchUsersMock = octokitMocks.rest.search.users();

    await mock.module('@actions/github', () => ({
      getOctokit: () => ({
        rest: {
          repos: {
            getCommit: getCommitMock,
          },
          search: {
            users: searchUsersMock,
          },
        },
      }),
    }));

    const queryKey = 'author-resolution';

    const { getOctokit } = await import('@actions/github');

    const { enrichCommit } = await import(
      `../../src/action/github/operations/commit.ts?${queryKey}`
    );

    const gh = getOctokit('fake-token');

    const commits = [
      {
        sha: 'c1',
        parents: [],
        subject: 'fix: one',
        body: '',
        authorName: 'Dev One',
        authorEmail: 'dev1@example.com',
        files: ['apps/app1/src/a.ts'],
        isMerge: false,
        githubUsername: '',
        authorDisplay: 'Dev One',
      },
      {
        sha: 'c2',
        parents: [],
        subject: 'fix: two',
        body: '',
        authorName: 'Dev Two',
        authorEmail: 'dev2@example.com',
        files: ['apps/app1/src/b.ts'],
        isMerge: false,
        githubUsername: '',
        authorDisplay: 'Dev Two',
      },
      {
        sha: 'c3',
        parents: [],
        subject: 'fix: three',
        body: '',
        authorName: 'Jane Doe',
        authorEmail: 'missing@example.com',
        files: ['apps/app1/src/c.ts'],
        isMerge: false,
        githubUsername: '',
        authorDisplay: 'Jane Doe',
      },
    ];

    const enrich = await enrichCommit(gh);
    const enriched = await enrich(commits, 'acme/rellu');

    expect(enriched[0]?.githubUsername).toBe('octocat');
    expect(enriched[0]?.authorDisplay).toBe('@octocat');

    expect(enriched[1]?.githubUsername).toBe('dev-two');
    expect(enriched[1]?.authorDisplay).toBe('@dev-two');

    expect(enriched[2]?.githubUsername).toBe('');
    expect(enriched[2]?.authorDisplay).toBe('Jane Doe');

    expect(getCommitMock).toHaveBeenCalledTimes(3);
    expect(searchUsersMock).toHaveBeenCalledTimes(2);

    const { renderChangelog } = await import('../../src/action/changelog/index.ts');
    const changelog = renderChangelog(
      enriched.map((commit) => ({
        sha: commit.sha,
        description: commit.subject,
        scope: null,
        type: 'fix',
        displayAuthor: commit.authorDisplay,
      })),
      'acme/rellu',
    );
    expect(changelog).toContain('thanks @octocat');
    expect(changelog).toContain('thanks @dev-two');
    expect(changelog).toContain('thanks Jane Doe');
  } finally {
    mock.restore();
  }
});
