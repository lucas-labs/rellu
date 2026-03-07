import { expect, test } from "bun:test";
import { applyNoBumpPolicy } from "../../src/bump-policy.ts";
import { calculateNextVersion } from "../../src/semver.ts";

test("calculateNextVersion applies semantic bump rules", () => {
  expect(calculateNextVersion("1.2.3", "major")).toBe("2.0.0");
  expect(calculateNextVersion("1.2.3", "minor")).toBe("1.3.0");
  expect(calculateNextVersion("1.2.3", "patch")).toBe("1.2.4");
  expect(calculateNextVersion("1.2.3", "none")).toBe("1.2.3");
});

test("applyNoBumpPolicy skip marks target non-releasable", () => {
  const outcome = applyNoBumpPolicy({
    changed: true,
    bumpFromCommits: "none",
    noBumpPolicy: "skip"
  });
  expect(outcome.bump).toBe("none");
  expect(outcome.skipRelease).toBe(true);
});

test("applyNoBumpPolicy patch forces patch release", () => {
  const outcome = applyNoBumpPolicy({
    changed: true,
    bumpFromCommits: "none",
    noBumpPolicy: "patch"
  });
  expect(outcome.bump).toBe("patch");
  expect(outcome.skipRelease).toBe(false);
});
