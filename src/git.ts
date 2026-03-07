import fs from "node:fs";
import { createGitHubClient, parseRepoRef } from "./toolkit/github-client.js";
import type { Logger, RangeStrategy, RawCommit, ResolvedGitRange } from "./types.js";
import { runCommand } from "./utils/exec.js";
import { toPosixPath, uniqueSortedPosix } from "./utils/paths.js";

interface ResolveRangeWithStrategyOptions {
  strategy: RangeStrategy;
  fromRef: string;
  toRef: string;
  targetLabel: string;
  tagPrefix?: string;
}

function trimTrailingNewline(value: string): string {
  return value.replace(/\r?\n$/u, "");
}

function authorDisplay(authorName: string, githubUsername: string): string {
  if (githubUsername) {
    return `@${githubUsername}`;
  }
  return authorName || "unknown";
}

async function resolveRef(ref: string): Promise<string> {
  const { stdout } = await runCommand("git", ["rev-parse", "--verify", ref]);
  return trimTrailingNewline(stdout).trim();
}

async function resolveFirstCommit(toRefSha: string): Promise<string> {
  const firstCommit = await runCommand("git", ["rev-list", "--max-parents=0", toRefSha]);
  return (
    trimTrailingNewline(firstCommit.stdout)
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter(Boolean)[0] ?? ""
  );
}

async function listMergedTags(toRefSha: string): Promise<string[]> {
  const { stdout } = await runCommand("git", ["tag", "--merged", toRefSha, "--sort=-creatordate"]);
  return stdout
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
}

async function resolveTagCommit(tagName: string): Promise<string> {
  const { stdout } = await runCommand("git", ["rev-list", "-n", "1", tagName]);
  return trimTrailingNewline(stdout).trim();
}

export async function resolveGitRange(fromRef: string, toRef: string, logger: Logger): Promise<ResolvedGitRange> {
  const to = await resolveRef(toRef || "HEAD");

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

async function resolveLatestTagStart(
  toRefSha: string,
  logger: Logger,
  options: {
    targetLabel: string;
    tagPrefix?: string;
  }
): Promise<string> {
  const allTags = await listMergedTags(toRefSha);
  const matchingTags = options.tagPrefix
    ? allTags.filter((tagName) => tagName.startsWith(options.tagPrefix ?? ""))
    : allTags;
  const latestTag = matchingTags[0] ?? "";

  if (latestTag) {
    const tagCommit = await resolveTagCommit(latestTag);
    logger.info(
      options.tagPrefix
        ? `Resolved range start for target "${options.targetLabel}" from latest tag "${latestTag}" (prefix "${options.tagPrefix}").`
        : `Resolved range start from latest reachable tag "${latestTag}".`
    );
    return tagCommit;
  }

  const firstCommit = await resolveFirstCommit(toRefSha);
  if (!firstCommit) {
    throw new Error(`Unable to resolve first commit for ${toRefSha}.`);
  }

  logger.info(
    options.tagPrefix
      ? `No matching tag found for target "${options.targetLabel}" with prefix "${options.tagPrefix}". Falling back to first commit ${firstCommit}.`
      : `No reachable tags found for ${toRefSha}. Falling back to first commit ${firstCommit}.`
  );
  return firstCommit;
}

export async function resolveGitRangeWithStrategy(
  options: ResolveRangeWithStrategyOptions,
  logger: Logger
): Promise<ResolvedGitRange> {
  const to = await resolveRef(options.toRef || "HEAD");

  if (options.strategy === "explicit") {
    return resolveGitRange(options.fromRef, options.toRef, logger);
  }

  if (options.strategy === "latest-tag") {
    const from = await resolveLatestTagStart(to, logger, { targetLabel: options.targetLabel });
    logger.info(`Resolved git range for target "${options.targetLabel}" via latest-tag: ${from}..${to}`);
    return { from, to, expression: `${from}..${to}` };
  }

  if (!options.tagPrefix) {
    throw new Error(
      `Target "${options.targetLabel}" is missing tagPrefix for range-strategy latest-tag-with-prefix.`
    );
  }

  const from = await resolveLatestTagStart(to, logger, {
    targetLabel: options.targetLabel,
    tagPrefix: options.tagPrefix
  });
  logger.info(
    `Resolved git range for target "${options.targetLabel}" via latest-tag-with-prefix "${options.tagPrefix}": ${from}..${to}`
  );
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

async function readCommitMetadata(sha: string): Promise<Omit<RawCommit, "files" | "githubUsername" | "authorDisplay">> {
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
      githubUsername: "",
      authorDisplay: authorDisplay(metadata.authorName, "")
    });
  }

  logger.info(`Collected ${commits.length} commits from ${range}`);
  return commits;
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
  const parsed = parseRepoRef(repo);
  if (!parsed) {
    return commits;
  }
  const githubClient = createGitHubClient(token, apiBase);

  const updated: RawCommit[] = [];
  for (const commit of commits) {
    let resolvedUsername = "";

    try {
      resolvedUsername = (await githubClient.getCommitAuthorLogin(parsed, commit.sha)).trim();
    } catch (error) {
      logger.warn(`Could not resolve associated GitHub username for commit ${commit.sha}: ${String(error)}`);
    }

    if (!resolvedUsername && commit.authorEmail) {
      try {
        resolvedUsername = (await githubClient.getUserLoginByEmail(commit.authorEmail)).trim();
      } catch (error) {
        logger.warn(
          `Could not resolve GitHub username by email for commit ${commit.sha} (${commit.authorEmail}): ${String(error)}`
        );
      }
    }

    updated.push({
      ...commit,
      githubUsername: resolvedUsername,
      authorDisplay: authorDisplay(commit.authorName, resolvedUsername)
    });
  }
  return updated;
}
