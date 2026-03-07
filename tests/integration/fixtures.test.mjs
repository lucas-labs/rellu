import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { analyzeTargetImpacts } from "../../dist/targets.js";
import { parseConventionalCommit, assertConventionalCommitValidity } from "../../dist/commits.js";
import { getReleaseBranchName } from "../../dist/release-pr.js";

const fixturesRoot = path.resolve("tests/fixtures");

async function readJson(relativePath) {
  const full = path.join(fixturesRoot, relativePath);
  const content = await fs.readFile(full, "utf8");
  return JSON.parse(content);
}

test("fixture: shared-path commits are assigned to every matching target", async () => {
  const targets = await readJson("multi-target-shared/targets.json");
  const commits = await readJson("multi-target-shared/commits.json");
  const commitsWithParsed = commits.map((commit) => ({
    ...commit,
    conventional: parseConventionalCommit(commit.subject, commit.body)
  }));

  const impacts = analyzeTargetImpacts(targets, commitsWithParsed);
  const app1 = impacts.find((impact) => impact.label === "app-1");
  const app2 = impacts.find((impact) => impact.label === "app-2");

  assert.ok(app1?.changed);
  assert.ok(app2?.changed);
  assert.equal(app1?.commitCount, 2);
  assert.equal(app2?.commitCount, 1);
});

test("fixture: strict mode fails for invalid conventional commits", async () => {
  const commits = await readJson("strict-invalid/commits.json");
  const invalid = parseConventionalCommit(commits[0].subject, commits[0].body);
  assert.throws(
    () => assertConventionalCommitValidity(invalid, true, "app-1", commits[0].sha, commits[0].subject),
    /Invalid conventional commit/
  );
});

test("fixture: release branch naming is deterministic and idempotent", async () => {
  const fixture = await readJson("release-idempotency/config.json");
  const first = getReleaseBranchName(fixture.releaseBranchPrefix, fixture.label);
  const second = getReleaseBranchName(fixture.releaseBranchPrefix, fixture.label);
  assert.equal(first, fixture.expectedBranch);
  assert.equal(second, fixture.expectedBranch);
});
