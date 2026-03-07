/**
 * @typedef {"major" | "minor" | "patch" | "none"} BumpLevel
 * @typedef {"skip" | "keep" | "patch"} NoBumpPolicy
 */

/**
 * @param {{ changed: boolean; bumpFromCommits: BumpLevel; noBumpPolicy: NoBumpPolicy }} input
 */
export function applyNoBumpPolicy(input) {
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
