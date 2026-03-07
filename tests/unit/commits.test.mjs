import test from "node:test";
import assert from "node:assert/strict";
import {
  parseConventionalCommit,
  resolveBumpFromCommits,
  normalizedCommitType,
  assertConventionalCommitValidity
} from "../../dist/commits.js";

test("parseConventionalCommit parses scope, bang, footers and breaking flag", () => {
  const parsed = parseConventionalCommit(
    "feat(api)!: redesign transport",
    "body text\nBREAKING CHANGE: old protocol removed\nRef: #123"
  );
  assert.equal(parsed.valid, true);
  assert.equal(parsed.type, "feat");
  assert.equal(parsed.scope, "api");
  assert.equal(parsed.isBreaking, true);
  assert.equal(parsed.footers.Ref, "#123");
});

test("invalid conventional commits become other in non-strict mode", () => {
  const parsed = parseConventionalCommit("updated files", "");
  assert.equal(parsed.valid, false);
  assert.equal(normalizedCommitType(parsed), "other");
  assert.doesNotThrow(() =>
    assertConventionalCommitValidity(parsed, false, "app-1", "abc123", "updated files")
  );
});

test("strict mode throws on invalid conventional commits", () => {
  const parsed = parseConventionalCommit("updated files", "");
  assert.throws(
    () => assertConventionalCommitValidity(parsed, true, "app-1", "abc123", "updated files"),
    /Invalid conventional commit/
  );
});

test("resolveBumpFromCommits uses highest-priority bump", () => {
  const commits = [
    parseConventionalCommit("fix: patch one", ""),
    parseConventionalCommit("feat: minor one", ""),
    parseConventionalCommit("chore: no bump", "")
  ];
  const bump = resolveBumpFromCommits(commits, {
    feat: "minor",
    fix: "patch",
    chore: "none",
    other: "none"
  });
  assert.equal(bump, "minor");
});
