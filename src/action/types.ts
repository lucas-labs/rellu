import type { BumpLevel, ManifestType } from './config/schema';

export interface ChangelogData {
  markdown: string;
}

export interface VersionSource {
  file: string;
  type: ManifestType;
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
  emoji: string | null;
  isBreaking: boolean;
  rawSubject: string;
  body: string;
  author: CommitAuthorOutput;
}

export interface ReleasePrInfo {
  enabled: boolean;
  action: 'created' | 'updated' | 'none';
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
