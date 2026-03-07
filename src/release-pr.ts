import type { Logger, ReleaseConfig, ReleasePrInfo, TargetResult } from "./types.js";
import { runCommand } from "./utils/exec.js";
import { writeManifestVersion } from "./version-files.js";

interface GitHubRepoRef {
  owner: string;
  name: string;
}

interface GitHubPullRequest {
  number: number;
  html_url: string;
  title: string;
  head?: {
    ref?: string;
  };
}

function parseRepo(repo: string): GitHubRepoRef | null {
  const [owner, name] = repo.split("/");
  if (!owner || !name) {
    return null;
  }
  return { owner, name };
}

async function githubRequest<TResponse>(
  apiBase: string,
  token: string,
  method: "GET" | "POST" | "PATCH",
  endpoint: string,
  body?: unknown
): Promise<TResponse> {
  const requestInit: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "rellu-action",
      "Content-Type": "application/json"
    },
    body: body === undefined ? null : JSON.stringify(body)
  };

  const response = await fetch(`${apiBase.replace(/\/+$/u, "")}${endpoint}`, {
    ...requestInit
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GitHub API ${method} ${endpoint} failed (${response.status}): ${errorText}`);
  }
  if (response.status === 204) {
    return null as TResponse;
  }
  return (await response.json()) as TResponse;
}

export function getReleaseBranchName(prefix: string, label: string): string {
  return `${prefix.replace(/\/+$/u, "")}/${label}`;
}

async function findOpenReleasePr(
  repo: GitHubRepoRef,
  apiBase: string,
  token: string,
  branch: string,
  base: string,
  titlePrefix: string
): Promise<GitHubPullRequest | null> {
  const params = new URLSearchParams({
    state: "open",
    head: `${repo.owner}:${branch}`,
    base
  });

  const byBranch = await githubRequest<GitHubPullRequest[]>(
    apiBase,
    token,
    "GET",
    `/repos/${repo.owner}/${repo.name}/pulls?${params.toString()}`
  );
  if (Array.isArray(byBranch) && byBranch.length > 0) {
    return byBranch[0] ?? null;
  }

  const openPulls = await githubRequest<GitHubPullRequest[]>(
    apiBase,
    token,
    "GET",
    `/repos/${repo.owner}/${repo.name}/pulls?state=open&base=${encodeURIComponent(base)}&per_page=100`
  );

  return (
    openPulls.find(
      (pull) =>
        String(pull.head?.ref ?? "") === branch || String(pull.title ?? "").startsWith(titlePrefix)
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
  target: TargetResult,
  config: ReleaseConfig,
  repo: GitHubRepoRef,
  logger: Logger
): Promise<ReleasePrInfo> {
  const branch = getReleaseBranchName(config.releaseBranchPrefix, target.label);
  const title = `release(${target.label}): v${target.nextVersion}`;
  const body = target.changelog.markdown || "_No changelog entries._";

  await regenerateReleaseBranch(config.baseBranch, branch, target, logger);

  const existing = await findOpenReleasePr(
    repo,
    config.githubServerUrl,
    config.githubToken,
    branch,
    config.baseBranch,
    `release(${target.label})`
  );

  if (existing) {
    const updated = await githubRequest<GitHubPullRequest>(
      config.githubServerUrl,
      config.githubToken,
      "PATCH",
      `/repos/${repo.owner}/${repo.name}/pulls/${existing.number}`,
      { title, body }
    );
    return {
      enabled: true,
      branch,
      title,
      number: updated.number,
      url: updated.html_url
    };
  }

  const created = await githubRequest<GitHubPullRequest>(
    config.githubServerUrl,
    config.githubToken,
    "POST",
    `/repos/${repo.owner}/${repo.name}/pulls`,
    {
      title,
      head: branch,
      base: config.baseBranch,
      body
    }
  );

  return {
    enabled: true,
    branch,
    title,
    number: created.number,
    url: created.html_url
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

  const repo = parseRepo(config.repo);
  if (!repo) {
    logger.warn("Release PR mode enabled but repository slug is missing. Skipping PR automation.");
    return { updatedResults: results, anyCreatedOrUpdated: false };
  }
  if (!config.githubToken) {
    logger.warn("Release PR mode enabled but GITHUB_TOKEN is missing. Skipping PR automation.");
    return { updatedResults: results, anyCreatedOrUpdated: false };
  }

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
          enabled: true,
          branch: getReleaseBranchName(config.releaseBranchPrefix, result.label),
          title: `release(${result.label}): v${result.nextVersion}`
        }
      });
      continue;
    }

    logger.info(
      `Managing release PR for ${result.label} on branch ${getReleaseBranchName(config.releaseBranchPrefix, result.label)}`
    );
    const releasePr = await createOrUpdateReleasePr(result, config, repo, logger);
    updatedResults.push({ ...result, releasePr });
    anyCreatedOrUpdated = true;
  }

  return { updatedResults, anyCreatedOrUpdated };
}
