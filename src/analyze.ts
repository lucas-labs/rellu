import {
  parseConventionalCommit,
  resolveBumpFromCommits,
  normalizedCommitType,
  assertConventionalCommitValidity
} from "./commits.ts";
import { calculateNextVersion } from "./semver.ts";
import { readManifestVersion } from "./version-files.ts";
import { renderChangelog } from "./changelog.ts";
import { analyzeTargetImpacts } from "./targets.ts";
import { collectCommitsInRange, enrichCommitsWithGitHubUsernames, resolveGitRange } from "./git.ts";
import { applyNoBumpPolicy } from "./bump-policy.ts";

/**
 * @typedef {import("./config.ts").RelluConfig} RelluConfig
 */

/**
 * @param {{
 *   authorName: string;
 *   githubUsername: string;
 * }} commit
 */
function displayAuthor(commit) {
  if (commit.githubUsername) {
    return `@${commit.githubUsername}`;
  }
  return commit.authorName || "unknown";
}

/**
 * @param {RelluConfig} config
 * @param {{ info: (message: string) => void; warn: (message: string) => void }} logger
 */
export async function analyzeRepository(config, logger) {
  const range = await resolveGitRange(config.fromRef, config.toRef, logger);
  const rawCommits = await collectCommitsInRange(range.expression, logger);
  const commits = await enrichCommitsWithGitHubUsernames(
    rawCommits,
    config.repo,
    config.githubServerUrl,
    config.githubToken,
    logger
  );

  const commitsWithConventional = commits.map((commit) => ({
    ...commit,
    conventional: parseConventionalCommit(commit.subject, commit.body)
  }));

  const impacts = analyzeTargetImpacts(config.targets, commitsWithConventional);
  const targetByLabel = new Map(config.targets.map((target) => [target.label, target]));

  const results = [];
  for (const impact of impacts) {
    const target = targetByLabel.get(impact.label);
    if (!target) {
      continue;
    }
    const currentVersion = await readManifestVersion(target.version.file, target.version.type);

    const relevantParsed = impact.relevantCommits.map((commit) => {
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
    const bump = policyOutcome.bump;
    if (impact.changed && bumpFromCommits === "none") {
      logger.info(`Target ${target.label} has no bump-worthy commits. Applying no-bump policy "${config.noBumpPolicy}".`);
    }

    const changed = impact.changed;
    const nextVersion = policyOutcome.skipRelease ? currentVersion : calculateNextVersion(currentVersion, bump);

    const outputCommits = relevantParsed.map((commit) => ({
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

    results.push({
      label: target.label,
      changed,
      matchedFiles: impact.matchedFiles,
      commitCount: impact.commitCount,
      currentVersion,
      nextVersion,
      bump,
      commits: outputCommits,
      changelog: {
        markdown: changelogMarkdown
      },
      versionSource: target.version,
      skipRelease: policyOutcome.skipRelease
    });

    logger.info(
      `Target ${target.label}: changed=${String(changed)}, commits=${impact.commitCount}, bump=${bump}, nextVersion=${nextVersion}`
    );
  }

  return {
    range: range.expression,
    commitCount: commits.length,
    results
  };
}
