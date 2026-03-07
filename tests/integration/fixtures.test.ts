import { expect, test } from "bun:test";
import fs from "node:fs/promises";
import path from "node:path";
import { assertConventionalCommitValidity, parseConventionalCommit } from "../../src/commits.ts";
import { getReleaseBranchName } from "../../src/release-pr.ts";
import { analyzeTargetImpacts } from "../../src/targets.ts";

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

  expect(app1?.changed).toBe(true);
  expect(app2?.changed).toBe(true);
  expect(app1?.commitCount).toBe(2);
  expect(app2?.commitCount).toBe(1);
});

test("fixture: strict mode fails for invalid conventional commits", async () => {
  const commits = await readJson("strict-invalid/commits.json");
  const invalid = parseConventionalCommit(commits[0].subject, commits[0].body);
  expect(() =>
    assertConventionalCommitValidity(invalid, true, "app-1", commits[0].sha, commits[0].subject, {
      isMerge: false
    })
  ).toThrow(/Invalid conventional commit/);
});

test("fixture: merge handling stays deterministic for target impact outputs", () => {
  const targets = [
    {
      label: "app-1",
      paths: ["apps/app1/**/*"],
      version: { file: "apps/app1/package.json", type: "node-package-json" as const }
    }
  ];

  const commits = [
    {
      sha: "a1",
      files: ["apps/app1/src/a.ts"]
    },
    {
      sha: "m1",
      files: ["apps/app1/src/b.ts"]
    }
  ];

  const first = analyzeTargetImpacts(targets, commits);
  const second = analyzeTargetImpacts(targets, commits);
  expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  expect(first[0]?.changed).toBe(true);
  expect(first[0]?.matchedFiles).toEqual(["apps/app1/src/a.ts", "apps/app1/src/b.ts"]);
  expect(first[0]?.commitCount).toBe(2);
});

test("fixture: release branch naming is deterministic and idempotent", async () => {
  const fixture = await readJson("release-idempotency/config.json");
  const first = getReleaseBranchName(fixture.releaseBranchPrefix, fixture.label);
  const second = getReleaseBranchName(fixture.releaseBranchPrefix, fixture.label);
  expect(first).toBe(fixture.expectedBranch);
  expect(second).toBe(fixture.expectedBranch);
});
