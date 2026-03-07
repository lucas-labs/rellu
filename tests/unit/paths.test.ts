import { expect, test } from "bun:test";
import { isGlobMatch, uniqueSortedPosix } from "../../src/utils/paths.ts";

test("isGlobMatch supports recursive target patterns", () => {
  expect(isGlobMatch("apps/app1/src/index.ts", "apps/app1/**/*")).toBe(true);
  expect(isGlobMatch("apps/app2/src/index.ts", "apps/app1/**/*")).toBe(false);
  expect(isGlobMatch("packages/shared/a/b.ts", "packages/shared/**/*")).toBe(true);
});

test("uniqueSortedPosix normalizes separators and deduplicates", () => {
  const result = uniqueSortedPosix(["a\\b\\c.ts", "a/b/c.ts", "z/x.ts"]);
  expect(result).toEqual(["a/b/c.ts", "z/x.ts"]);
});
