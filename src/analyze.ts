import { applyNoBumpPolicy } from "./bump-policy.js";
import { renderChangelog } from "./changelog.js";
import {
  assertConventionalCommitValidity,
  normalizedCommitType,
  parseConventionalCommit,
  resolveBumpFromCommits
} from "./commits.js";
import { collectCommitsInRange, enrichCommitsWithGitHubUsernames, resolveGitRange } from "./git.js";
import { calculateNextVersion } from "./semver.js";
import { analyzeTargetImpacts } from "./targets.js";
import type {
  AnalyzeRepositoryResult,
  AnalyzedCommitOutput,
  Logger,
  ParsedConventionalCommit,
  RawCommit,
  RelluConfig,
  TargetResult
} from "./types.js";
import { readManifestVersion } from "./version-files.js";

interface CommitWithConventional extends RawCommit {
  conventional: ParsedConventionalCommit;
}

function displayAuthor(commit: Pick<RawCommit, "authorName" | "githubUsername">): string {
  if (commit.githubUsername) {
    return `@${commit.githubUsername}`;
  }
  return commit.authorName || "unknown";
}

export async function analyzeRepository(config: RelluConfig, logger: Logger): Promise<AnalyzeRepositoryResult> {
  const range = await resolveGitRange(config.fromRef, config.toRef, logger);
  const rawCommits = await collectCommitsInRange(range.expression, logger);
  const commits = await enrichCommitsWithGitHubUsernames(
    rawCommits,
    config.repo,
    config.githubServerUrl,
    config.githubToken,
    logger
  );

  const commitsWithConventional: CommitWithConventional[] = commits.map((commit) => ({
    ...commit,
    conventional: parseConventionalCommit(commit.subject, commit.body)
  }));

  const impacts = analyzeTargetImpacts(config.targets, commitsWithConventional);
  const targetByLabel = new Map(config.targets.map((target) => [target.label, target] as const));

  const results: TargetResult[] = [];
  for (const impact of impacts) {
    const target = targetByLabel.get(impact.label);
    if (!target) {
      continue;
    }
    const currentVersion = await readManifestVersion(target.version.file, target.version.type);

    const relevantParsed: CommitWithConventional[] = impact.relevantCommits.map((commit) => {
      const parsed = assertConventionalCommitValidity(
        commit.conventional,
        config.strictConventionalCommits,
        target.label,
        commit.sha,
        commit.subject
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
        display: displayAuthor(commit)
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
    range: range.expression,
    commitCount: commits.length,
    results
  };
}
