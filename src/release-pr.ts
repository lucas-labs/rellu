import { createGitHubClient, parseRepoRef } from "./toolkit/github-client.js";
import type { GitHubClient, GitHubPullRequest, GitHubRepoRef, Logger, ReleaseConfig, ReleasePrInfo, TargetResult } from "./types.js";
import { runCommand } from "./utils/exec.js";
import { writeManifestVersion } from "./version-files.js";

export function getReleaseBranchName(prefix: string, label: string): string {
  return `${prefix.replace(/\/+$/u, "")}/${label}`;
}

async function findOpenReleasePr(
  githubClient: GitHubClient,
  repo: GitHubRepoRef,
  branch: string,
  base: string,
  titlePrefix: string
): Promise<GitHubPullRequest | null> {
  const byBranch = await githubClient.listPulls(repo, {
    state: "open",
    head: `${repo.owner}:${branch}`,
    base,
    perPage: 100
  });
  if (Array.isArray(byBranch) && byBranch.length > 0) {
    return byBranch[0] ?? null;
  }

  const openPulls = await githubClient.listPulls(repo, {
    state: "open",
    base,
    perPage: 100
  });

  return (
    openPulls.find(
      (pull) => String(pull.headRef ?? "") === branch || String(pull.title ?? "").startsWith(titlePrefix)
    ) ?? null
  );
}

async function regenerateReleaseBranch(
  baseBranch: string,
  branch: string,
  target: TargetResult,
  logger: Logger
): Promise<void> {
  await runCommand("git", ["fetch", "origin", baseBranch]);
  await runCommand("git", ["checkout", "-B", branch, `origin/${baseBranch}`]);
  await runCommand("git", ["config", "user.name", "rellu[bot]"]);
  await runCommand("git", ["config", "user.email", "rellu-bot@users.noreply.github.com"]);

  await writeManifestVersion(target.versionSource.file, target.versionSource.type, target.nextVersion);

  await runCommand("git", ["add", target.versionSource.file]);
  const status = await runCommand("git", ["status", "--porcelain", "--", target.versionSource.file]);
  if (!status.stdout.trim()) {
    logger.info(`No version file changes for ${target.label}; branch regeneration skipped commit.`);
    return;
  }

  const commitMessage = `release(${target.label}): v${target.nextVersion}`;
  await runCommand("git", ["commit", "-m", commitMessage, "--no-verify"]);
  await runCommand("git", ["push", "origin", `+${branch}`]);
}

async function createOrUpdateReleasePr(
  githubClient: GitHubClient,
  target: TargetResult,
  config: ReleaseConfig,
  repo: GitHubRepoRef,
  logger: Logger
): Promise<ReleasePrInfo> {
  const branch = getReleaseBranchName(config.releaseBranchPrefix, target.label);
  const title = `release(${target.label}): v${target.nextVersion}`;
  const body = target.changelog.markdown || "_No changelog entries._";

  await regenerateReleaseBranch(config.baseBranch, branch, target, logger);

  const existing = await findOpenReleasePr(githubClient, repo, branch, config.baseBranch, `release(${target.label})`);

  if (existing) {
    const updated = await githubClient.updatePull(repo, existing.number, { title, body });
    return {
      enabled: true,
      branch,
      title,
      number: updated.number,
      url: updated.htmlUrl
    };
  }

  const created = await githubClient.createPull(repo, {
    title,
    head: branch,
    base: config.baseBranch,
    body
  });

  return {
    enabled: true,
    branch,
    title,
    number: created.number,
    url: created.htmlUrl
  };
}

export async function maybeManageReleasePrs(
  config: ReleaseConfig,
  results: TargetResult[],
  logger: Logger
): Promise<{ updatedResults: TargetResult[]; anyCreatedOrUpdated: boolean }> {
  if (!config.createReleasePrs) {
    return { updatedResults: results, anyCreatedOrUpdated: false };
  }

  const repo = parseRepoRef(config.repo);
  if (!repo) {
    throw new Error(
      `Invalid repository slug "${config.repo}". Expected format "owner/name" with exactly two non-empty segments.`
    );
  }
  if (!config.githubToken) {
    logger.warn("Release PR mode enabled but GITHUB_TOKEN is missing. Skipping PR automation.");
    return { updatedResults: results, anyCreatedOrUpdated: false };
  }

  const githubClient = createGitHubClient(config.githubToken, config.githubServerUrl);

  let anyCreatedOrUpdated = false;
  const updatedResults: TargetResult[] = [];

  for (const result of results) {
    const isReleasable = result.changed && result.nextVersion !== result.currentVersion && !result.skipRelease;
    if (!isReleasable) {
      if (result.changed) {
        logger.warn(`Skipping release PR for ${result.label}: non-releasable target under current policy.`);
      }
      updatedResults.push({
        ...result,
        releasePr: {
          enabled: false
        }
      });
      continue;
    }

    logger.info(
      `Managing release PR for ${result.label} on branch ${getReleaseBranchName(config.releaseBranchPrefix, result.label)}`
    );
    try {
      const releasePr = await createOrUpdateReleasePr(githubClient, result, config, repo, logger);
      updatedResults.push({ ...result, releasePr });
      anyCreatedOrUpdated = true;
    } catch (error) {
      throw new Error(`Failed managing release PR for target "${result.label}": ${String(error)}`);
    }
  }

  return { updatedResults, anyCreatedOrUpdated };
}
