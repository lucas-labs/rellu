export type ManifestType = "node-package-json" | "rust-cargo-toml" | "python-pyproject-toml";

export type BumpLevel = "major" | "minor" | "patch" | "none";

export type NoBumpPolicy = "skip" | "keep" | "patch";
export type RangeStrategy = "explicit" | "latest-tag" | "latest-tag-with-prefix";

export interface ChangelogConfig {
  categoryMap: Record<string, string>;
  sectionOrder: string[];
}

export interface VersionSource {
  file: string;
  type: ManifestType;
}

export interface TargetConfig {
  label: string;
  paths: string[];
  version: VersionSource;
  tagPrefix?: string;
}

export interface RelluConfig {
  rangeStrategy: RangeStrategy;
  fromRef: string;
  toRef: string;
  strictConventionalCommits: boolean;
  bumpRules: Record<string, BumpLevel>;
  noBumpPolicy: NoBumpPolicy;
  createReleasePrs: boolean;
  releaseBranchPrefix: string;
  baseBranch: string;
  repo: string;
  githubServerUrl: string;
  githubToken: string;
  changelog: ChangelogConfig;
  targets: TargetConfig[];
}

export interface Logger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

export interface CoreClient {
  getInput(name: string): string;
  setOutput(name: string, value: string): void;
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  setFailed(message: string): void;
}

export interface CommandResult {
  stdout: string;
  stderr: string;
  code: number;
}

export interface CommandOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  silent?: boolean;
}

export interface ResolvedGitRange {
  from: string;
  to: string;
  expression: string;
}

export interface RawCommit {
  sha: string;
  parents: string[];
  subject: string;
  body: string;
  authorName: string;
  authorEmail: string;
  files: string[];
  isMerge: boolean;
  githubUsername: string;
  authorDisplay: string;
}

export interface ParsedConventionalCommit {
  type: string | null;
  scope: string | null;
  description: string;
  emoji: string;
  isBreaking: boolean;
  rawSubject: string;
  body: string;
  footers: Record<string, string>;
  valid: boolean;
}

export interface CommitAuthorOutput {
  name: string;
  username: string;
  display: string;
}

export interface AnalyzedCommitOutput {
  sha: string;
  type: string | null;
  scope: string | null;
  description: string;
  isBreaking: boolean;
  rawSubject: string;
  body: string;
  author: CommitAuthorOutput;
}

export interface ChangelogData {
  markdown: string;
}

export interface ReleasePrInfo {
  enabled: boolean;
  branch?: string;
  title?: string;
  number?: number;
  url?: string;
}

export interface TargetResult {
  label: string;
  changed: boolean;
  matchedFiles: string[];
  commitCount: number;
  currentVersion: string;
  nextVersion: string;
  bump: BumpLevel;
  commits: AnalyzedCommitOutput[];
  changelog: ChangelogData;
  versionSource: VersionSource;
  skipRelease: boolean;
  releasePr?: ReleasePrInfo;
}

export interface AnalyzeRepositoryResult {
  range: string;
  commitCount: number;
  results: TargetResult[];
}

export interface NoBumpPolicyOutcome {
  bump: BumpLevel;
  skipRelease: boolean;
}

export type CommitLike = {
  sha: string;
  files: string[];
};

export interface TargetImpact<TCommit extends CommitLike> {
  label: string;
  changed: boolean;
  matchedFiles: string[];
  commitCount: number;
  relevantCommits: TCommit[];
}

export interface ReleaseConfig {
  createReleasePrs: boolean;
  releaseBranchPrefix: string;
  baseBranch: string;
  repo: string;
  githubServerUrl: string;
  githubToken: string;
}

export interface GitHubRepoRef {
  owner: string;
  name: string;
}

export interface GitHubPullRequest {
  number: number;
  htmlUrl: string;
  title: string;
  headRef: string;
}

export interface GitHubListPullsOptions {
  base: string;
  state?: "open" | "closed" | "all";
  head?: string;
  perPage?: number;
}

export interface GitHubCreatePullOptions {
  title: string;
  head: string;
  base: string;
  body: string;
}

export interface GitHubUpdatePullOptions {
  title?: string;
  body?: string;
}

export interface GitHubClient {
  listPulls(repo: GitHubRepoRef, options: GitHubListPullsOptions): Promise<GitHubPullRequest[]>;
  createPull(repo: GitHubRepoRef, options: GitHubCreatePullOptions): Promise<GitHubPullRequest>;
  updatePull(
    repo: GitHubRepoRef,
    pullNumber: number,
    options: GitHubUpdatePullOptions
  ): Promise<GitHubPullRequest>;
  getCommitAuthorLogin(repo: GitHubRepoRef, sha: string): Promise<string>;
  getUserLoginByEmail(email: string): Promise<string>;
}
