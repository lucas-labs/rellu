import { expect, test } from "bun:test";
import { validateAutomationOwnedReleaseBranch } from "../../src/release-branch-safety.ts";

test("allows automation-owned release branch with namespaced release prefix", () => {
  expect(() =>
    validateAutomationOwnedReleaseBranch({
      branch: "rellu/release/app-1",
      branchPrefix: "rellu/release",
      targetLabel: "app-1"
    })
  ).not.toThrow();
});

test("rejects unsafe prefix without release namespace", () => {
  expect(() =>
    validateAutomationOwnedReleaseBranch({
      branch: "main/app-1",
      branchPrefix: "main",
      targetLabel: "app-1"
    })
  ).toThrow(/prefix must include a namespace segment/i);
});

test("rejects branch names containing disallowed git ref characters", () => {
  expect(() =>
    validateAutomationOwnedReleaseBranch({
      branch: "rellu/release/app 1",
      branchPrefix: "rellu/release",
      targetLabel: "app 1"
    })
  ).toThrow(/invalid git ref characters/i);
});

test("rejects target labels that expand to multiple path segments", () => {
  expect(() =>
    validateAutomationOwnedReleaseBranch({
      branch: "rellu/release/app/1",
      branchPrefix: "rellu/release",
      targetLabel: "app/1"
    })
  ).toThrow(/single branch segment/i);
});

