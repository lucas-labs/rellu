import { expect, test } from "bun:test";
import {
  assertConventionalCommitValidity,
  normalizedCommitType,
  parseConventionalCommit,
  resolveBumpFromCommits
} from "../../src/commits.ts";

test("parseConventionalCommit parses scope, bang, footers and breaking flag", () => {
  const parsed = parseConventionalCommit(
    "feat(api)!: redesign transport",
    "body text\nBREAKING CHANGE: old protocol removed\nRef: #123"
  );
  expect(parsed.valid).toBe(true);
  expect(parsed.type).toBe("feat");
  expect(parsed.scope).toBe("api");
  expect(parsed.isBreaking).toBe(true);
  expect(parsed.footers.Ref).toBe("#123");
});

test("invalid conventional commits become other in non-strict mode", () => {
  const parsed = parseConventionalCommit("updated files", "");
  expect(parsed.valid).toBe(false);
  expect(normalizedCommitType(parsed)).toBe("other");
  expect(() =>
    assertConventionalCommitValidity(parsed, false, "app-1", "abc123", "updated files", { isMerge: false })
  ).not.toThrow();
});

test("strict mode throws on invalid conventional commits", () => {
  const parsed = parseConventionalCommit("updated files", "");
  expect(() =>
    assertConventionalCommitValidity(parsed, true, "app-1", "abc123", "updated files", { isMerge: false })
  ).toThrow(/Invalid conventional commit/);
});

test("strict mode ignores invalid merge subjects", () => {
  const parsed = parseConventionalCommit("Merge pull request #123 from feature/x", "");
  expect(() =>
    assertConventionalCommitValidity(parsed, true, "app-1", "abc123", parsed.rawSubject, { isMerge: true })
  ).not.toThrow();
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
  expect(bump).toBe("minor");
});
