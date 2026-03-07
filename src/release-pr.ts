import { runCommand } from "./utils/exec.ts";
import { writeManifestVersion } from "./version-files.ts";

/**
 * @typedef {{
 *   label: string;
 *   changed: boolean;
 *   bump: "major" | "minor" | "patch" | "none";
 *   currentVersion: string;
 *   nextVersion: string;
 *   changelog: { markdown: string };
 *   versionSource: { file: string; type: "node-package-json" | "rust-cargo-toml" | "python-pyproject-toml" };
 *   skipRelease?: boolean;
 *   releasePr?: {
 *     enabled: boolean;
 *     branch: string;
 *     title: string;
 *     number?: number;
 *     url?: string;
 *   };
 * }} TargetResult
 *
 * @typedef {{
 *   createReleasePrs: boolean;
 *   releaseBranchPrefix: string;
 *   baseBranch: string;
 *   repo: string;
 *   githubServerUrl: string;
 *   githubToken: string;
 * }} ReleaseConfig
 */

/**
 * @param {string} repo
 * @returns {{ owner: string; name: string } | null}
 */
function parseRepo(repo) {
  const [owner, name] = repo.split("/");
  if (!owner || !name) {
    return null;
  }
  return { owner, name };
}

/**
 * @param {string} apiBase
 * @param {string} token
 * @param {"GET" | "POST" | "PATCH"} method
 * @param {string} endpoint
 * @param {any=} body
 * @returns {Promise<any>}
 */
async function githubRequest(apiBase, token, method, endpoint, body = undefined) {
  const response = await fetch(`${apiBase.replace(/\/+$/u, "")}${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "rellu-action",
      "Content-Type": "application/json"
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GitHub API ${method} ${endpoint} failed (${response.status}): ${errorText}`);
  }
  if (response.status === 204) {
    return null;
  }
  return response.json();
}

/**
 * @param {string} prefix
 * @param {string} label
 */
export function getReleaseBranchName(prefix, label) {
  return `${prefix.replace(/\/+$/u, "")}/${label}`;
}

/**
 * @param {{ owner: string; name: string }} repo
 * @param {string} apiBase
 * @param {string} token
 * @param {string} branch
 * @param {string} base
 * @param {string} titlePrefix
 */
async function findOpenReleasePr(repo, apiBase, token, branch, base, titlePrefix) {
  const params = new URLSearchParams({
    state: "open",
    head: `${repo.owner}:${branch}`,
    base
  });
  const byBranch = await githubRequest(
    apiBase,
    token,
    "GET",
    `/repos/${repo.owner}/${repo.name}/pulls?${params.toString()}`
  );
  if (Array.isArray(byBranch) && byBranch.length > 0) {
    return byBranch[0];
  }

  const openPulls = await githubRequest(
    apiBase,
    token,
    "GET",
    `/repos/${repo.owner}/${repo.name}/pulls?state=open&base=${encodeURIComponent(base)}&per_page=100`
  );
  if (!Array.isArray(openPulls)) {
    return null;
  }
  return (
    openPulls.find(
      (pull) => String(pull?.head?.ref ?? "") === branch || String(pull?.title ?? "").startsWith(titlePrefix)
    ) ?? null
  );
}

/**
 * @param {string} baseBranch
 * @param {string} branch
 * @param {TargetResult} target
 * @param {{ info: (message: string) => void }} logger
 */
async function regenerateReleaseBranch(baseBranch, branch, target, logger) {
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

/**
 * @param {TargetResult} target
 * @param {ReleaseConfig} config
 * @param {{ owner: string; name: string }} repo
 * @param {{ info: (message: string) => void }} logger
 */
async function createOrUpdateReleasePr(target, config, repo, logger) {
  const branch = getReleaseBranchName(config.releaseBranchPrefix, target.label);
  const title = `release(${target.label}): v${target.nextVersion}`;
  const body = target.changelog.markdown || "_No changelog entries._";

  await regenerateReleaseBranch(config.baseBranch, branch, target, logger);

  const existing = await findOpenReleasePr(repo, config.githubServerUrl, config.githubToken, branch, config.baseBranch, `release(${target.label})`);
  if (existing) {
    const updated = await githubRequest(
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

  const created = await githubRequest(
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

/**
 * @param {ReleaseConfig} config
 * @param {TargetResult[]} results
 * @param {{ info: (message: string) => void; warn: (message: string) => void }} logger
 */
export async function maybeManageReleasePrs(config, results, logger) {
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
  const updatedResults = [];

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

    logger.info(`Managing release PR for ${result.label} on branch ${getReleaseBranchName(config.releaseBranchPrefix, result.label)}`);
    const releasePr = await createOrUpdateReleasePr(result, config, repo, logger);
    updatedResults.push({ ...result, releasePr });
    anyCreatedOrUpdated = true;
  }

  return { updatedResults, anyCreatedOrUpdated };
}
