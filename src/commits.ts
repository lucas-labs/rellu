import type { BumpLevel, ParsedConventionalCommit } from "./types.js";

const HEADER_REGEX = /^([a-zA-Z][\w-]*)(?:\(([^)]+)\))?(!)?:\s+(.+)$/u;

function detectEmoji(text: string): string {
  const match = text.match(/\p{Extended_Pictographic}/u);
  return match ? match[0] : "";
}

function parseFooters(body: string): Record<string, string> {
  const footers: Record<string, string> = {};
  for (const line of body.split(/\r?\n/u)) {
    const match = line.match(/^([A-Za-z-]+):\s+(.+)$/u);
    if (!match) {
      continue;
    }
    const [, key, value] = match;
    if (key && value) {
      footers[key] = value.trim();
    }
  }
  return footers;
}

export function parseConventionalCommit(subject: string, body: string): ParsedConventionalCommit {
  const trimmedSubject = subject.trim();
  const header = trimmedSubject.match(HEADER_REGEX);
  const footerMap = parseFooters(body);
  const hasBreakingFooter = /(^|\n)BREAKING CHANGE:\s+/u.test(body);

  if (!header) {
    return {
      type: null,
      scope: null,
      description: trimmedSubject,
      emoji: detectEmoji(trimmedSubject),
      isBreaking: hasBreakingFooter,
      rawSubject: trimmedSubject,
      body,
      footers: footerMap,
      valid: false
    };
  }

  const [, type = "", scope = "", bang = "", description = ""] = header;
  return {
    type: type.toLowerCase(),
    scope: scope || null,
    description: description.trim(),
    emoji: detectEmoji(description),
    isBreaking: bang === "!" || hasBreakingFooter,
    rawSubject: trimmedSubject,
    body,
    footers: footerMap,
    valid: true
  };
}

export function normalizedCommitType(parsed: ParsedConventionalCommit): string {
  if (!parsed.valid || !parsed.type) {
    return "other";
  }
  return parsed.type;
}

export function assertConventionalCommitValidity(
  parsed: ParsedConventionalCommit,
  strict: boolean,
  targetLabel: string,
  sha: string,
  subject: string
): ParsedConventionalCommit {
  if (!parsed.valid && strict) {
    throw new Error(`Invalid conventional commit for target "${targetLabel}" in strict mode: ${sha} "${subject}"`);
  }
  return parsed;
}

export function resolveBumpFromCommits(
  commits: ParsedConventionalCommit[],
  bumpRules: Record<string, BumpLevel>
): BumpLevel {
  let highest: BumpLevel = "none";

  for (const commit of commits) {
    const bump: BumpLevel = commit.isBreaking
      ? "major"
      : (bumpRules[normalizedCommitType(commit)] ?? bumpRules.other ?? "none");

    if (bump === "major") {
      return "major";
    }
    if (bump === "minor") {
      highest = "minor";
    } else if (bump === "patch" && highest === "none") {
      highest = "patch";
    }
  }

  return highest;
}
