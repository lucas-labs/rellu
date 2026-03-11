import type { RangeStrategy } from '@/action/config/schema';
import { authorDisplay } from '@/action/github/operations/commit';
import cmd from '@/utils/cmd';
import fs from 'node:fs';
import { resolveLatestTagStart } from './tag';
import { commitMetadata, listCommitFiles, type RawCommit } from './commit/commands';
import { log } from '@/utils/logger';

export interface ResolveRangeWithStrategyOptions {
  strategy: RangeStrategy;
  fromRef?: string | undefined;
  toRef: string;
  targetLabel: string;
  tagPrefix?: string | undefined;
}

export interface ResolvedGitRange {
  from: string;
  to: string;
  expression: string;
}

/** resolves a git ref (branch, tag, or commit-ish) to its corresponding commit SHA. */
export const resolveRef = async (ref: string) => {
  const { stdout } = await cmd.exec('git', ['rev-parse', '--verify', ref]);
  return stdout.trim();
};

/** resolves the first commit in the history leading to the given ref */
export const resolveFirstCommit = async (toRefSha: string) => {
  const firstCommit = await cmd.exec('git', ['rev-list', '--max-parents=0', toRefSha]);
  return (
    firstCommit.stdout
      .trim()
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter(Boolean)[0] ?? ''
  );
};

/** resolves a git range (e.g. "abc123..def456") to its corresponding commit SHAs */
export const resolveExplicitGitRange = async (
  fromRef: string,
  toRef: string,
): Promise<ResolvedGitRange> => {
  const to = await resolveRef(toRef || 'HEAD');

  let from = fromRef;
  if (!from) {
    from = await resolveFirstCommit(to);
  }
  if (!from) {
    throw new Error("Unable to resolve from-ref. Set input 'from-ref' explicitly.");
  }

  try {
    from = await resolveRef(from);
  } catch (error) {
    if (fs.existsSync('.git/shallow')) {
      throw new Error(
        `Failed to resolve from-ref "${fromRef}". Repository appears shallow. ` +
          'Use actions/checkout with fetch-depth: 0.',
      );
    }
    throw error;
  }

  log.info(`Resolved git range: ${from}..${to}`);
  return { from, to, expression: `${from}..${to}` };
};

/**
 * resolves a git range based on the specified strategy (explicit, latest-tag, or
 * latest-tag-with-prefix)
 */
export const resolveRange = async (
  options: ResolveRangeWithStrategyOptions,
): Promise<ResolvedGitRange> => {
  if (options.strategy === 'explicit') {
    if (!options.fromRef) {
      throw new Error(
        `Range strategy "explicit" requires a from-ref. Set input 'from-ref' explicitly.`,
      );
    }
    return resolveExplicitGitRange(options.fromRef, options.toRef);
  }

  const to = await resolveRef(options.toRef || 'HEAD');

  if (options.strategy === 'latest-tag') {
    const from = await resolveLatestTagStart(to, {
      targetLabel: options.targetLabel,
    });
    log.info(
      `Resolved git range for target "${options.targetLabel}" via latest-tag: ${from}..${to}`,
    );
    return { from, to, expression: `${from}..${to}` };
  }

  if (!options.tagPrefix) {
    throw new Error(
      `Target "${options.targetLabel}" is missing tagPrefix for range-strategy latest-tag-with-prefix.`,
    );
  }

  const from = await resolveLatestTagStart(to, {
    targetLabel: options.targetLabel,
    tagPrefix: options.tagPrefix,
  });
  log.info(
    `Resolved git range for target "${options.targetLabel}" via latest-tag-with-prefix "${options.tagPrefix}": ${from}..${to}`,
  );
  return { from, to, expression: `${from}..${to}` };
};

/** collects commits in the given git range, including their metadata and changed files */
export const collectCommitsInRange = async (range: string): Promise<RawCommit[]> => {
  const { stdout } = await cmd.exec('git', ['rev-list', '--reverse', '--first-parent', range]);
  const shas = stdout
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);

  const commits: RawCommit[] = [];
  for (const sha of shas) {
    const metadata = await commitMetadata(sha);
    const files = await listCommitFiles(sha);
    commits.push({
      ...metadata,
      files,
      githubUsername: '',
      authorDisplay: authorDisplay(metadata.authorName, ''),
    });
  }

  log.info(`Collected ${commits.length} commits from ${range}`);
  return commits;
};
