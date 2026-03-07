import { expect, test } from "bun:test";
import { isGlobMatch, uniqueSortedPosix } from "../../src/utils/paths.ts";

test("isGlobMatch supports recursive target patterns", () => {
  expect(isGlobMatch("apps/app1/src/index.ts", "apps/app1/**/*")).toBe(true);
  expect(isGlobMatch("apps/app2/src/index.ts", "apps/app1/**/*")).toBe(false);
  expect(isGlobMatch("packages/shared/a/b.ts", "packages/shared/**/*")).toBe(true);
  expect(isGlobMatch("apps/app1/src/a.ts", "apps/app?/src/*.ts")).toBe(true);
  expect(isGlobMatch("apps/app10/src/a.ts", "apps/app?/src/*.ts")).toBe(false);
});

test("isGlobMatch supports standard brace expansion patterns", () => {
  expect(isGlobMatch("apps/web/src/main.ts", "apps/{web,admin}/src/**")).toBe(true);
  expect(isGlobMatch("apps/admin/src/main.ts", "apps/{web,admin}/src/**")).toBe(true);
  expect(isGlobMatch("apps/api/src/main.ts", "apps/{web,admin}/src/**")).toBe(false);
});

test("isGlobMatch supports standard character class patterns", () => {
  expect(isGlobMatch("packages/lib-a/index.ts", "packages/lib-[ab]/**")).toBe(true);
  expect(isGlobMatch("packages/lib-b/index.ts", "packages/lib-[ab]/**")).toBe(true);
  expect(isGlobMatch("packages/lib-c/index.ts", "packages/lib-[ab]/**")).toBe(false);
});

test("uniqueSortedPosix normalizes separators and deduplicates", () => {
  const result = uniqueSortedPosix(["a\\b\\c.ts", "a/b/c.ts", "z/x.ts"]);
  expect(result).toEqual(["a/b/c.ts", "z/x.ts"]);
});
