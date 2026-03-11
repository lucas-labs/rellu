import {
  type RawCommit,
  commitMetadata,
  listCommitFiles,
  resolveCommit,
} from './operations/read/commit/commands';
import {
  assertConventionalCommitValidity,
  resolveBumpFromCommits,
  parseConventionalCommit,
} from './operations/read/commit/parsing';
import {
  type ResolvedGitRange,
  type ResolveRangeWithStrategyOptions,
  collectCommitsInRange,
  resolveExplicitGitRange,
  resolveFirstCommit,
  resolveRef,
  resolveRange,
} from './operations/read/range';
import { setUser, set } from './operations/config';
import { addFiles, commitChanges, isFileModified, pushBranch } from './operations/commiting';
import { prepareBranch } from './operations/branch';
import { listMergedTags, resolveLatestTagStart } from './operations/read/tag';

/** client for peforming git operations */
const git = {
  /** git configuration operations */
  config: {
    /** sets git user.name and user.email */
    setUser,
    /** sets an arbitrary git config key to a value */
    set,
  },
  /** git commits operations */
  commits: {
    /** resolves the commit SHA that a ref (tag, branch) points to */
    resolve: resolveCommit,
    /** retrieves metadata for a given commit SHA, including author info and message */
    metadata: commitMetadata,
    /** lists files changed in a given commit SHA */
    listFiles: listCommitFiles,
    /** operations to work with conventional commits */
    conventional: {
      /** parses a commit message into its conventional commit components if possible */
      parse: parseConventionalCommit,
      /** asserts that a commit meets the validity requirements based on config */
      valid: assertConventionalCommitValidity,
      /** determines the version bump implied by a set of commits based on config */
      resolveBump: resolveBumpFromCommits,
    },
  },
  /** operations to resolve git ranges and collect commits */
  range: {
    /**
     * resolves a git range based on the specified strategy (explicit, latest-tag, or
     * latest-tag-with-prefix)
     */
    resolve: resolveRange,
    /** resolves a git range (e.g. "abc123..def456") to its corresponding commit SHAs */
    resolveExplicit: resolveExplicitGitRange,
    /** resolves the first commit in the history leading to the given ref */
    resolveFirstCommit,
    /**  resolves a git ref (branch, tag, or commit-ish) to its corresponding commit SHA. */
    resolveRef,
    /** collects commits in a given git range, including their metadata and changed files */
    collectCommits: collectCommitsInRange,
  },
  /** git tag operations */
  tag: {
    /** lists reachable tags from the given ref, sorted by creation date (newest first) */
    listMerged: listMergedTags,
    /**
     * resolves the git range start by finding the latest reachable tag from the given ref,
     * optionally filtered by a prefix. Falls back to the first commit if no matching tag is
     * found.
     */
    resolveLatestTagStart,
  },
  /** git branch operations */
  branch: {
    /** prepares a branch by creating it or updating it from the specified base and pushing it to origin */
    prepare: prepareBranch,
  },
  add: addFiles,
  commit: commitChanges,
  isFileModified,
  push: pushBranch,
};

export type { ResolvedGitRange, ResolveRangeWithStrategyOptions, RawCommit };
export default git;
