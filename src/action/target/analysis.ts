import { log } from '@/utils/logger';
import {
  type ConfigFile,
  type RelluConfig,
  type Target,
  type RelluActionInputs,
  type BumpLevel,
  defaultBumpRules,
  type NoBumpPolicy,
} from '../config/schema';
import git, { type RawCommit } from '../git';
import getGh from '../github';
import type { Commit } from '../git/operations/read/commit/commands';
import type { AnalyzedCommitOutput, TargetResult } from '../types';
import { analyzeTargetImpacts } from './impacts';
import manifests from './manifests';
import semver from '@/utils/semver';
import { renderChangelog } from '../changelog';

export const applyNoBumpPolicy = ({
  changed,
  bumpFromCommits,
  noBumpPolicy,
}: {
  changed: boolean;
  bumpFromCommits: BumpLevel;
  noBumpPolicy: NoBumpPolicy;
}): {
  bump: BumpLevel;
  skipRelease: boolean;
} => {
  if (!changed) {
    return {
      bump: 'none',
      skipRelease: true,
    };
  }

  if (bumpFromCommits !== 'none') {
    return {
      bump: bumpFromCommits,
      skipRelease: false,
    };
  }

  if (noBumpPolicy === 'patch') {
    return {
      bump: 'patch',
      skipRelease: false,
    };
  }

  if (noBumpPolicy === 'keep') {
    return {
      bump: 'none',
      skipRelease: false,
    };
  }

  return {
    bump: 'none',
    skipRelease: true,
  };
};

const rangeResolutionKey = (config: RelluActionInputs, target: Target): string => {
  if (config.rangeStrategy === 'latest-tag-with-prefix') {
    return `${config.rangeStrategy}:${config.toRef}${target.tagPrefix ? `:${target.tagPrefix}` : ''}`;
  }
  return `${config.rangeStrategy}:${config.fromRef}:${config.toRef}`;
};

const summarizeRanges = (
  targetRanges: Array<{ label: string; expression: string }>,
): string => {
  const uniqueExpressions = [...new Set(targetRanges.map((entry) => entry.expression))];
  if (uniqueExpressions.length === 1) {
    return uniqueExpressions[0] ?? '';
  }
  return targetRanges.map((entry) => `${entry.label}:${entry.expression}`).join(' | ');
};

const analyze = async (rellu: RelluConfig) => {
  const { config, inputs } = rellu;

  const ranges = new Map<string, { from: string; to: string; expression: string }>();
  const targetRanges: Array<{ label: string; expression: string }> = [];
  const commitsByRangeExpression = new Map<string, RawCommit[]>();
  const parsedCommitsByRangeExpression = new Map<string, Commit[]>();
  const uniqueCommitShas = new Set<string>();
  const results: TargetResult[] = [];

  const gh = getGh(inputs);

  for (const target of config.targets) {
    const key = rangeResolutionKey(inputs, target);

    // resolve range for target based on strategy
    let range = ranges.get(key);
    if (!range) {
      range = await git.range.resolve({
        strategy: inputs.rangeStrategy,
        fromRef: inputs.fromRef,
        toRef: inputs.toRef,
        targetLabel: target.label,
        ...(target.tagPrefix ? { tagPrefix: target.tagPrefix } : {}),
      });
      ranges.set(key, range);
    }

    // add target with resolved range to the list of target ranges
    targetRanges.push({ label: target.label, expression: range.expression });

    // collect commits for the range
    let commits = commitsByRangeExpression.get(range.expression);
    if (!commits) {
      const rawCommits = await git.range.collectCommits(range.expression);
      commits = await gh.commit.enrich(rawCommits, inputs.repo);
      commitsByRangeExpression.set(range.expression, commits);
      for (const commit of commits) {
        uniqueCommitShas.add(commit.sha);
      }
    }

    // try to parse commits for the range into structured conventional commits
    let commitsWithConventional = parsedCommitsByRangeExpression.get(range.expression);
    if (!commitsWithConventional) {
      commitsWithConventional = commits.map((commit) => ({
        ...commit,
        conventional: git.commits.conventional.parse(commit.subject, commit.body),
      }));
      parsedCommitsByRangeExpression.set(range.expression, commitsWithConventional);
    }

    // analyze target impact based on commits with conventional commit parsing
    // this will determine which commits are relevant for the target and what the overall
    // impact is (changed or not, bump level, etc.)
    const impact = analyzeTargetImpacts([target], commitsWithConventional)[0];
    if (!impact) {
      continue;
    }
    const currentVersion = await manifests.read(target.version.file, target.version.type, {
      targetLabel: target.label,
    });

    // for the commits that are relevant for the target, assert their conventional commit
    // validity
    const relevantParsed: Commit[] = impact.relevantCommits.map((commit) => {
      const parsed = git.commits.conventional.valid(
        commit.conventional,
        inputs.strictConventionalCommits,
        target.label,
        commit.sha,
        commit.subject,
        { isMerge: commit.isMerge },
      );
      return { ...commit, conventional: parsed };
    });

    // determine the next version based on the commits' conventional parsing and the configured
    // bump rules, and apply the no-bump policy if necessary

    const parsedForBump = relevantParsed.map((commit) => commit.conventional);
    const bumpFromCommits = git.commits.conventional.resolveBump(
      parsedForBump,
      config.bumpRules ?? defaultBumpRules,
    );
    const policyOutcome = applyNoBumpPolicy({
      changed: impact.changed,
      bumpFromCommits,
      noBumpPolicy: inputs.noBumpPolicy,
    });

    if (impact.changed && bumpFromCommits === 'none') {
      log.info(
        `Target ${target.label} has no bump-worthy commits. Applying no-bump policy "${inputs.noBumpPolicy}".`,
      );
    }

    const nextVersion = policyOutcome.skipRelease
      ? currentVersion
      : semver.next(currentVersion, policyOutcome.bump);

    const outputCommits: AnalyzedCommitOutput[] = relevantParsed.map((commit) => ({
      sha: commit.sha,
      type: commit.conventional.type,
      scope: commit.conventional.scope,
      description: commit.conventional.description,
      emoji: commit.conventional.emoji,
      isBreaking: commit.conventional.isBreaking,
      rawSubject: commit.subject,
      body: commit.body,
      author: {
        name: commit.authorName,
        username: commit.githubUsername || '',
        display: commit.authorDisplay,
      },
    }));

    // generate changelog for the target based on the relevant commits and their conventional
    // parsing
    const changelogMarkdown = renderChangelog(
      outputCommits.map((entry) => ({
        sha: entry.sha,
        description: entry.description,
        scope: entry.scope,
        type: entry.type,
        displayAuthor: entry.author.display,
      })),
      inputs.repo,
      config.changelog,
    );

    const result: TargetResult = {
      label: target.label,
      changed: impact.changed,
      matchedFiles: impact.matchedFiles,
      commitCount: impact.commitCount,
      currentVersion,
      nextVersion,
      bump: policyOutcome.bump,
      commits: outputCommits,
      changelog: {
        markdown: changelogMarkdown,
      },
      versionSource: target.version,
      skipRelease: policyOutcome.skipRelease,
    };

    results.push(result);
    log.info(
      `Target ${target.label}: changed=${String(impact.changed)}, commits=${impact.commitCount}, bump=${policyOutcome.bump}, nextVersion=${nextVersion}`,
    );
  }

  return {
    range: summarizeRanges(targetRanges),
    commitCount: uniqueCommitShas.size,
    results,
  };
};

export default analyze;
