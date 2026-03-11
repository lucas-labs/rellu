import pathUtils from '@/utils/paths';
import { expect, test } from 'bun:test';

test('pathUtils.glob.match supports recursive target patterns', () => {
  expect(pathUtils.glob.match('apps/app1/src/index.ts', 'apps/app1/**/*')).toBe(true);
  expect(pathUtils.glob.match('apps/app2/src/index.ts', 'apps/app1/**/*')).toBe(false);
  expect(pathUtils.glob.match('packages/shared/a/b.ts', 'packages/shared/**/*')).toBe(true);
  expect(pathUtils.glob.match('apps/app1/src/a.ts', 'apps/app?/src/*.ts')).toBe(true);
  expect(pathUtils.glob.match('apps/app10/src/a.ts', 'apps/app?/src/*.ts')).toBe(false);
});

test('pathUtils.glob.match supports standard brace expansion patterns', () => {
  expect(pathUtils.glob.match('apps/web/src/main.ts', 'apps/{web,admin}/src/**')).toBe(true);
  expect(pathUtils.glob.match('apps/admin/src/main.ts', 'apps/{web,admin}/src/**')).toBe(true);
  expect(pathUtils.glob.match('apps/api/src/main.ts', 'apps/{web,admin}/src/**')).toBe(false);
});

test('pathUtils.glob.match supports standard character class patterns', () => {
  expect(pathUtils.glob.match('packages/lib-a/index.ts', 'packages/lib-[ab]/**')).toBe(true);
  expect(pathUtils.glob.match('packages/lib-b/index.ts', 'packages/lib-[ab]/**')).toBe(true);
  expect(pathUtils.glob.match('packages/lib-c/index.ts', 'packages/lib-[ab]/**')).toBe(false);
});

test('dedupAndSort normalizes separators and deduplicates', () => {
  const result = pathUtils.dedupAndSort(['a\\b\\c.ts', 'a/b/c.ts', 'z/x.ts']);
  expect(result).toEqual(['a/b/c.ts', 'z/x.ts']);
});
