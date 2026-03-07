import { applyNoBumpPolicy } from "./bump-policy.js";
import { renderChangelog } from "./changelog.js";
import {
  assertConventionalCommitValidity,
  normalizedCommitType,
  parseConventionalCommit,
  resolveBumpFromCommits
} from "./commits.js";
import { collectCommitsInRange, enrichCommitsWithGitHubUsernames, resolveGitRangeWithStrategy } from "./git.js";
import { calculateNextVersion } from "./semver.js";
import { analyzeTargetImpacts } from "./targets.js";
import type {
  AnalyzeRepositoryResult,
  AnalyzedCommitOutput,
  Logger,
  ParsedConventionalCommit,
  RawCommit,
  RelluConfig,
  TargetConfig,
  TargetResult
} from "./types.js";
import { readManifestVersion } from "./version-files.js";

interface CommitWithConventional extends RawCommit {
  conventional: ParsedConventionalCommit;
}

function rangeResolutionKey(config: RelluConfig, target: TargetConfig): string {
  if (config.rangeStrategy === "latest-tag-with-prefix") {
    return `${config.rangeStrategy}:${config.toRef}:${target.tagPrefix ?? ""}`;
  }
  return `${config.rangeStrategy}:${config.fromRef}:${config.toRef}`;
}

function summarizeRanges(targetRanges: Array<{ label: string; expression: string }>): string {
  const uniqueExpressions = [...new Set(targetRanges.map((entry) => entry.expression))];
  if (uniqueExpressions.length === 1) {
    return uniqueExpressions[0] ?? "";
  }
  return targetRanges.map((entry) => `${entry.label}:${entry.expression}`).join(" | ");
}

export async function analyzeRepository(config: RelluConfig, logger: Logger): Promise<AnalyzeRepositoryResult> {
  const resolvedRanges = new Map<string, { from: string; to: string; expression: string }>();
  const commitsByRangeExpression = new Map<string, RawCommit[]>();
  const parsedCommitsByRangeExpression = new Map<string, CommitWithConventional[]>();
  const targetRanges: Array<{ label: string; expression: string }> = [];
  const uniqueCommitShas = new Set<string>();

  const results: TargetResult[] = [];
  for (const target of config.targets) {
    const key = rangeResolutionKey(config, target);
    let range = resolvedRanges.get(key);
    if (!range) {
      range = await resolveGitRangeWithStrategy(
        {
          strategy: config.rangeStrategy,
          fromRef: config.fromRef,
          toRef: config.toRef,
          targetLabel: target.label,
          ...(target.tagPrefix ? { tagPrefix: target.tagPrefix } : {})
        },
        logger
      );
      resolvedRanges.set(key, range);
    }
    targetRanges.push({ label: target.label, expression: range.expression });

    let commits = commitsByRangeExpression.get(range.expression);
    if (!commits) {
      const rawCommits = await collectCommitsInRange(range.expression, logger);
      commits = await enrichCommitsWithGitHubUsernames(
        rawCommits,
        config.repo,
        config.githubServerUrl,
        config.githubToken,
        logger
      );
      commitsByRangeExpression.set(range.expression, commits);
      for (const commit of commits) {
        uniqueCommitShas.add(commit.sha);
      }
    }

    let commitsWithConventional = parsedCommitsByRangeExpression.get(range.expression);
    if (!commitsWithConventional) {
      commitsWithConventional = commits.map((commit) => ({
        ...commit,
        conventional: parseConventionalCommit(commit.subject, commit.body)
      }));
      parsedCommitsByRangeExpression.set(range.expression, commitsWithConventional);
    }

    const impact = analyzeTargetImpacts([target], commitsWithConventional)[0];
    if (!impact) {
      continue;
    }
    const currentVersion = await readManifestVersion(target.version.file, target.version.type);

    const relevantParsed: CommitWithConventional[] = impact.relevantCommits.map((commit) => {
      const parsed = assertConventionalCommitValidity(
        commit.conventional,
        config.strictConventionalCommits,
        target.label,
        commit.sha,
        commit.subject,
        { isMerge: commit.isMerge }
      );
      const normalizedType = normalizedCommitType(parsed);
      return {
        ...commit,
        conventional: {
          ...parsed,
          type: normalizedType
        }
      };
    });

    const parsedForBump = relevantParsed.map((commit) => commit.conventional);
    const bumpFromCommits = resolveBumpFromCommits(parsedForBump, config.bumpRules);
    const policyOutcome = applyNoBumpPolicy({
      changed: impact.changed,
      bumpFromCommits,
      noBumpPolicy: config.noBumpPolicy
    });

    if (impact.changed && bumpFromCommits === "none") {
      logger.info(`Target ${target.label} has no bump-worthy commits. Applying no-bump policy "${config.noBumpPolicy}".`);
    }

    const nextVersion = policyOutcome.skipRelease
      ? currentVersion
      : calculateNextVersion(currentVersion, policyOutcome.bump);

    const outputCommits: AnalyzedCommitOutput[] = relevantParsed.map((commit) => ({
      sha: commit.sha,
      type: commit.conventional.type,
      scope: commit.conventional.scope,
      description: commit.conventional.description,
      isBreaking: commit.conventional.isBreaking,
      rawSubject: commit.subject,
      body: commit.body,
      author: {
        name: commit.authorName,
        username: commit.githubUsername || "",
        display: commit.authorDisplay
      }
    }));

    const changelogMarkdown = renderChangelog(
      outputCommits.map((entry) => ({
        sha: entry.sha,
        description: entry.description,
        scope: entry.scope,
        type: entry.type,
        displayAuthor: entry.author.display
      })),
      config.repo,
      config.githubServerUrl
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
        markdown: changelogMarkdown
      },
      versionSource: target.version,
      skipRelease: policyOutcome.skipRelease
    };

    results.push(result);
    logger.info(
      `Target ${target.label}: changed=${String(impact.changed)}, commits=${impact.commitCount}, bump=${policyOutcome.bump}, nextVersion=${nextVersion}`
    );
  }

  return {
    range: summarizeRanges(targetRanges),
    commitCount: uniqueCommitShas.size,
    results
  };
}
