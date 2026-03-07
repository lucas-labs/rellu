import test from "node:test";
import assert from "node:assert/strict";
import { calculateNextVersion } from "../../dist/semver.js";
import { applyNoBumpPolicy } from "../../dist/bump-policy.js";

test("calculateNextVersion applies semantic bump rules", () => {
  assert.equal(calculateNextVersion("1.2.3", "major"), "2.0.0");
  assert.equal(calculateNextVersion("1.2.3", "minor"), "1.3.0");
  assert.equal(calculateNextVersion("1.2.3", "patch"), "1.2.4");
  assert.equal(calculateNextVersion("1.2.3", "none"), "1.2.3");
});

test("applyNoBumpPolicy skip marks target non-releasable", () => {
  const outcome = applyNoBumpPolicy({
    changed: true,
    bumpFromCommits: "none",
    noBumpPolicy: "skip"
  });
  assert.equal(outcome.bump, "none");
  assert.equal(outcome.skipRelease, true);
});

test("applyNoBumpPolicy patch forces patch release", () => {
  const outcome = applyNoBumpPolicy({
    changed: true,
    bumpFromCommits: "none",
    noBumpPolicy: "patch"
  });
  assert.equal(outcome.bump, "patch");
  assert.equal(outcome.skipRelease, false);
});
