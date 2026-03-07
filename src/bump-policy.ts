import type { BumpLevel, NoBumpPolicy, NoBumpPolicyOutcome } from "./types.js";

interface ApplyNoBumpPolicyInput {
  changed: boolean;
  bumpFromCommits: BumpLevel;
  noBumpPolicy: NoBumpPolicy;
}

export function applyNoBumpPolicy(input: ApplyNoBumpPolicyInput): NoBumpPolicyOutcome {
  if (!input.changed) {
    return {
      bump: "none",
      skipRelease: true
    };
  }

  if (input.bumpFromCommits !== "none") {
    return {
      bump: input.bumpFromCommits,
      skipRelease: false
    };
  }

  if (input.noBumpPolicy === "patch") {
    return {
      bump: "patch",
      skipRelease: false
    };
  }

  if (input.noBumpPolicy === "keep") {
    return {
      bump: "none",
      skipRelease: false
    };
  }

  return {
    bump: "none",
    skipRelease: true
  };
}
