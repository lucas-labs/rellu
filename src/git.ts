import fs from "node:fs";
import { runCommand } from "./utils/exec.ts";
import { toPosixPath, uniqueSortedPosix } from "./utils/paths.ts";

/**
 * @typedef {{
 *   sha: string;
 *   parents: string[];
 *   subject: string;
 *   body: string;
 *   authorName: string;
 *   authorEmail: string;
 *   files: string[];
 *   isMerge: boolean;
 *   githubUsername: string;
 * }} RawCommit
 */

/**
 * @param {string} value
 * @returns {string}
 */
function trimTrailingNewline(value) {
  return value.replace(/\r?\n$/u, "");
}

/**
 * @param {string} ref
 * @returns {Promise<string>}
 */
async function resolveRef(ref) {
  const { stdout } = await runCommand("git", ["rev-parse", "--verify", ref]);
  return trimTrailingNewline(stdout).trim();
}

/**
 * @param {string} fromRef
 * @param {string} toRef
 * @param {{ info: (msg: string) => void }} logger
 */
export async function resolveGitRange(fromRef, toRef, logger) {
  const to = await resolveRef(toRef || "HEAD");

  let from = fromRef;
  if (!from) {
    const firstCommit = await runCommand("git", ["rev-list", "--max-parents=0", to]);
    from = trimTrailingNewline(firstCommit.stdout).split(/\r?\n/u).filter(Boolean)[0] ?? "";
  }
  if (!from) {
    throw new Error("Unable to resolve from-ref. Set input 'from-ref' explicitly.");
  }

  try {
    from = await resolveRef(from);
  } catch (error) {
    if (fs.existsSync(".git/shallow")) {
      throw new Error(
        `Failed to resolve from-ref "${fromRef}". Repository appears shallow. ` +
          "Use actions/checkout with fetch-depth: 0."
      );
    }
    throw error;
  }

  logger.info(`Resolved git range: ${from}..${to}`);
  return { from, to, expression: `${from}..${to}` };
}

/**
 * @param {string} sha
 * @returns {Promise<string[]>}
 */
async function listCommitFiles(sha) {
  const { stdout } = await runCommand("git", [
    "diff-tree",
    "--no-commit-id",
    "--name-only",
    "-r",
    "--first-parent",
    "-m",
    sha
  ]);
  return uniqueSortedPosix(
    stdout
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter(Boolean)
      .map(toPosixPath)
  );
}

/**
 * @param {string} sha
 * @returns {Promise<Omit<RawCommit, "files" | "githubUsername">>}
 */
async function readCommitMetadata(sha) {
  const format = ["%H", "%P", "%s", "%b", "--RELLU--", "%an", "%ae"].join("%n");
  const { stdout } = await runCommand("git", ["show", "-s", `--format=${format}`, sha]);
  const [meta, authorName = "", authorEmail = ""] = stdout.split("--RELLU--");
  const lines = (meta ?? "").replace(/\r/g, "").split("\n");
  const parsedSha = (lines.shift() ?? "").trim();
  const parents = (lines.shift() ?? "")
    .trim()
    .split(" ")
    .filter(Boolean);
  const subject = lines.shift() ?? "";
  const body = lines.join("\n").trim();

  return {
    sha: parsedSha || sha,
    parents,
    subject,
    body,
    authorName: authorName.trim(),
    authorEmail: authorEmail.trim(),
    isMerge: parents.length > 1
  };
}

/**
 * @param {string} range
 * @param {{ info: (msg: string) => void }} logger
 * @returns {Promise<RawCommit[]>}
 */
export async function collectCommitsInRange(range, logger) {
  const { stdout } = await runCommand("git", ["rev-list", "--reverse", "--first-parent", range]);
  const shas = stdout
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);

  /** @type {RawCommit[]} */
  const commits = [];
  for (const sha of shas) {
    const metadata = await readCommitMetadata(sha);
    const files = await listCommitFiles(sha);
    commits.push({
      ...metadata,
      files,
      githubUsername: ""
    });
  }

  logger.info(`Collected ${commits.length} commits from ${range}`);
  return commits;
}

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
 * @param {string} endpoint
 * @returns {Promise<any>}
 */
async function githubGet(apiBase, token, endpoint) {
  const response = await fetch(`${apiBase.replace(/\/+$/u, "")}${endpoint}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "rellu-action"
    }
  });
  if (!response.ok) {
    throw new Error(`GitHub API request failed (${response.status}) for ${endpoint}`);
  }
  return response.json();
}

/**
 * @param {RawCommit[]} commits
 * @param {string} repo
 * @param {string} apiBase
 * @param {string} token
 * @param {{ warn: (msg: string) => void }} logger
 * @returns {Promise<RawCommit[]>}
 */
export async function enrichCommitsWithGitHubUsernames(commits, repo, apiBase, token, logger) {
  if (!token) {
    return commits;
  }
  const parsed = parseRepo(repo);
  if (!parsed) {
    return commits;
  }

  const updated = [...commits];
  for (let index = 0; index < updated.length; index += 1) {
    const commit = updated[index];
    try {
      const payload = await githubGet(
        apiBase,
        token,
        `/repos/${parsed.owner}/${parsed.name}/commits/${commit.sha}`
      );
      const username = String(payload?.author?.login ?? "").trim();
      updated[index] = {
        ...commit,
        githubUsername: username
      };
    } catch (error) {
      logger.warn(`Could not resolve GitHub username for commit ${commit.sha}: ${String(error)}`);
    }
  }
  return updated;
}
