import { mock } from 'bun:test';

export const octokitMocks = {
  rest: {
    repos: {
      getCommit: () =>
        mock(async ({ owner, repo, ref }: { owner: string; repo: string; ref: string }) => {
          if (ref === 'c1') {
            return {
              data: {
                author: {
                  login: 'octocat',
                },
              },
            };
          }
          return {
            data: {},
          };
        }),
    },
    search: {
      users: () =>
        mock(async ({ q, per_page }: { q: string; per_page: number }) => {
          if (q === 'dev2@example.com in:email') {
            return {
              data: {
                items: [
                  {
                    login: 'dev-two',
                  },
                ],
              },
            };
          }
          return {
            data: {
              items: [],
            },
          };
        }),
    },
    pulls: {
      list: () =>
        mock(async () => ({
          data: [
            {
              number: 123,
              node_id: 'MDExOlB1bGxSZXF1ZXN0MTIz',
              html_url: 'https://example.local/pull/42',
              diff_url: 'https://example.local/pull/42.diff',
              patch_url: 'https://example.local/pull/42.patch',
              issue_url: 'https://example.local/pull/42',
              commits_url: 'https://example.local/pull/42/commits',
              review_comments_url: 'https://example.local/pull/42/comments',
              review_comment_url: 'https://example.local/pull/42/comments{/number}',
              comments_url: 'https://example.local/pull/42/comments',
              statuses_url: 'https://example.local/pull/42/statuses',
              state: 'open',
              locked: false,
              title: 'release(app-1) v1.2.3',
              user: {
                login: 'octocat',
              },
              body: 'pr body',
              draft: false,
              head: {
                ref: 'rellu/release/app-1/v1.2.3',
              },
            },
          ],
        })),
      create: () =>
        mock(async (..._args: any) => ({
          data: {
            number: 124,
            html_url: 'https://example.local/pull/124',
          },
        })),
      update: () =>
        mock(async (..._args: any) => ({
          data: {
            number: 123,
            html_url: 'https://example.local/pull/123',
          },
        })),
    },
  },
};
