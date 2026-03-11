import { expect, test } from 'bun:test';
import git from '../../src/action/git';

test('parseConventionalCommit parses scope, bang, footers and breaking flag', () => {
  git;
  const parsed = git.commits.conventional.parse(
    'feat(api)!: redesign transport',
    'body text\nBREAKING CHANGE: old protocol removed\nRef: #123',
  );
  expect(parsed.valid).toBe(true);
  expect(parsed.type).toBe('feat');
  expect(parsed.scope).toBe('api');
  expect(parsed.isBreaking).toBe(true);
  expect(parsed.footers.Ref).toBe('#123');
});

test('invalid conventional commits become other in non-strict mode', () => {
  const parsed = git.commits.conventional.parse('updated files', '');
  expect(parsed.valid).toBe(false);
  expect(parsed.type).toBe('other');
  expect(() =>
    git.commits.conventional.valid(parsed, false, 'app-1', 'abc123', 'updated files', {
      isMerge: false,
    }),
  ).not.toThrow();
});

test('strict mode throws on invalid conventional commits', () => {
  const parsed = git.commits.conventional.parse('updated files', '');
  expect(() =>
    git.commits.conventional.valid(parsed, true, 'app-1', 'abc123', 'updated files', {
      isMerge: false,
    }),
  ).toThrow(/Invalid conventional commit/);
});

test('strict mode ignores invalid merge subjects', () => {
  const parsed = git.commits.conventional.parse('Merge pull request #123 from feature/x', '');
  expect(() =>
    git.commits.conventional.valid(parsed, true, 'app-1', 'abc123', parsed.rawSubject, {
      isMerge: true,
    }),
  ).not.toThrow();
});

test('resolveBumpFromCommits uses highest-priority bump', () => {
  const commits = [
    git.commits.conventional.parse('fix: patch one', ''),
    git.commits.conventional.parse('feat: minor one', ''),
    git.commits.conventional.parse('chore: no bump', ''),
  ];
  const bump = git.commits.conventional.resolveBump(commits, {
    feat: 'minor',
    fix: 'patch',
    chore: 'none',
    other: 'none',
  });
  expect(bump).toBe('minor');
});
