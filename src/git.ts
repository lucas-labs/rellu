import fs from "node:fs";
import type { Logger, RawCommit, ResolvedGitRange } from "./types.js";
import { runCommand } from "./utils/exec.js";
import { toPosixPath, uniqueSortedPosix } from "./utils/paths.js";

interface GitHubCommitResponse {
  author?: {
    login?: string | null;
  } | null;
}

interface GitHubRepoRef {
  owner: string;
  name: string;
}

function trimTrailingNewline(value: string): string {
  return value.replace(/\r?\n$/u, "");
}

async function resolveRef(ref: string): Promise<string> {
  const { stdout } = await runCommand("git", ["rev-parse", "--verify", ref]);
  return trimTrailingNewline(stdout).trim();
}

export async function resolveGitRange(fromRef: string, toRef: string, logger: Logger): Promise<ResolvedGitRange> {
  const to = await resolveRef(toRef || "HEAD");

  let from = fromRef;
  if (!from) {
    const firstCommit = await runCommand("git", ["rev-list", "--max-parents=0", to]);
    from = trimTrailingNewline(firstCommit.stdout)
      .split(/\r?\n/u)
      .filter(Boolean)[0] ?? "";
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

async function listCommitFiles(sha: string): Promise<string[]> {
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

async function readCommitMetadata(sha: string): Promise<Omit<RawCommit, "files" | "githubUsername">> {
  const format = ["%H", "%P", "%s", "%b", "--RELLU--", "%an", "%ae"].join("%n");
  const { stdout } = await runCommand("git", ["show", "-s", `--format=${format}`, sha]);
  const [meta = "", authorName = "", authorEmail = ""] = stdout.split("--RELLU--");
  const lines = meta.replace(/\r/g, "").split("\n");

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

export async function collectCommitsInRange(range: string, logger: Logger): Promise<RawCommit[]> {
  const { stdout } = await runCommand("git", ["rev-list", "--reverse", "--first-parent", range]);
  const shas = stdout
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);

  const commits: RawCommit[] = [];
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

function parseRepo(repo: string): GitHubRepoRef | null {
  const [owner, name] = repo.split("/");
  if (!owner || !name) {
    return null;
  }
  return { owner, name };
}

async function githubGet(apiBase: string, token: string, endpoint: string): Promise<GitHubCommitResponse> {
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
  return (await response.json()) as GitHubCommitResponse;
}

export async function enrichCommitsWithGitHubUsernames(
  commits: RawCommit[],
  repo: string,
  apiBase: string,
  token: string,
  logger: Logger
): Promise<RawCommit[]> {
  if (!token) {
    return commits;
  }
  const parsed = parseRepo(repo);
  if (!parsed) {
    return commits;
  }

  const updated: RawCommit[] = [];
  for (const commit of commits) {
    try {
      const payload = await githubGet(apiBase, token, `/repos/${parsed.owner}/${parsed.name}/commits/${commit.sha}`);
      const username = String(payload.author?.login ?? "").trim();
      updated.push({
        ...commit,
        githubUsername: username
      });
    } catch (error) {
      logger.warn(`Could not resolve GitHub username for commit ${commit.sha}: ${String(error)}`);
      updated.push(commit);
    }
  }
  return updated;
}
