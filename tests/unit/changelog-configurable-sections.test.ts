import { renderChangelog } from '@/action/changelog';
import { expect, test } from 'bun:test';

const commit = (
  sha: string,
  type: string | null,
  description: string,
  scope: string | null = null,
  displayAuthor = '@dev',
) => ({
  sha,
  type,
  description,
  scope,
  displayAuthor,
});

function extractHeadings(markdown: string): string[] {
  return markdown
    .split('\n')
    .filter((line) => line.startsWith('## '))
    .map((line) => line.slice(3).trim());
}

test('renderChangelog keeps default mapping and default ordering when config is omitted', () => {
  const markdown = renderChangelog(
    [
      commit('a1', 'feat', 'add endpoint'),
      commit('b2', 'fix', 'repair parser'),
      commit('c3', 'docs', 'update README'),
    ],
    'acme/rellu',
  );

  expect(extractHeadings(markdown)).toEqual([
    '✨ Features',
    '🐛 Bug Fixes',
    '📚 Documentation',
  ]);
  expect(markdown).toContain('- add endpoint (thanks @dev) ([a1]');
  expect(markdown).toContain('- repair parser (thanks @dev) ([b2]');
  expect(markdown).toContain('- update README (thanks @dev) ([c3]');
});

test('renderChangelog uses custom category mapping and custom section ordering', () => {
  const markdown = renderChangelog(
    [
      commit('a1', 'feat', 'add endpoint'),
      commit('b2', 'fix', 'repair parser'),
      commit('c3', 'docs', 'update README'),
    ],
    '',
    {
      categoryMap: {
        feat: 'Enhancements',
        fix: 'Maintenance',
        docs: 'Guides',
        other: 'Other',
      },
      sectionOrder: ['Maintenance', 'Enhancements'],
    },
  );

  expect(extractHeadings(markdown)).toEqual(['Maintenance', 'Enhancements', 'Guides']);
  expect(markdown).toContain('## Maintenance');
  expect(markdown).toContain('## Enhancements');
  expect(markdown).toContain('## Guides');
});

test('renderChangelog appends unspecified sections in deterministic sorted order', () => {
  const changelogConfig = {
    categoryMap: {
      fix: 'Maintenance',
      docs: 'Zeta',
      chore: 'Alpha',
      other: 'Other',
    },
    sectionOrder: ['Maintenance'],
  };

  const first = renderChangelog(
    [
      commit('a1', 'fix', 'repair parser'),
      commit('b2', 'docs', 'update README'),
      commit('c3', 'chore', 'clean workspace'),
    ],
    '',
    changelogConfig,
  );
  const second = renderChangelog(
    [
      commit('a1', 'fix', 'repair parser'),
      commit('b2', 'docs', 'update README'),
      commit('c3', 'chore', 'clean workspace'),
    ],
    '',
    changelogConfig,
  );

  expect(extractHeadings(first)).toEqual(['Maintenance', 'Alpha', 'Zeta']);
  expect(first).toBe(second);
});

test('renderChangelog escapes markdown-special and mention-like commit fields', () => {
  const markdown = renderChangelog(
    [
      commit(
        'a1b2c3d4',
        'fix',
        'render [link](url) and ping @team',
        'core*@scope',
        '@alice(bot)',
      ),
    ],
    'acme/rellu',
  );

  expect(markdown).toContain('core\\*\\@scope: render \\[link\\]\\(url\\) and ping \\@team');
  expect(markdown).toContain('(thanks @alice(bot))');
});
