import test from "node:test";
import assert from "node:assert/strict";
import { isGlobMatch, uniqueSortedPosix } from "../../dist/utils/paths.js";

test("isGlobMatch supports recursive target patterns", () => {
  assert.equal(isGlobMatch("apps/app1/src/index.ts", "apps/app1/**/*"), true);
  assert.equal(isGlobMatch("apps/app2/src/index.ts", "apps/app1/**/*"), false);
  assert.equal(isGlobMatch("packages/shared/a/b.ts", "packages/shared/**/*"), true);
});

test("uniqueSortedPosix normalizes separators and deduplicates", () => {
  const result = uniqueSortedPosix(["a\\b\\c.ts", "a/b/c.ts", "z/x.ts"]);
  assert.deepEqual(result, ["a/b/c.ts", "z/x.ts"]);
});
