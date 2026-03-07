/**
 * @typedef {"major" | "minor" | "patch" | "none"} BumpLevel
 *
 * @typedef {{
 *   type: string | null;
 *   scope: string | null;
 *   description: string;
 *   emoji: string;
 *   isBreaking: boolean;
 *   rawSubject: string;
 *   body: string;
 *   footers: Record<string, string>;
 *   valid: boolean;
 * }} ParsedConventionalCommit
 */

/** @type {RegExp} */
const HEADER_REGEX = /^([a-zA-Z][\w-]*)(?:\(([^)]+)\))?(!)?:\s+(.+)$/u;

/**
 * @param {string} text
 * @returns {string}
 */
function detectEmoji(text) {
  const match = text.match(/\p{Extended_Pictographic}/u);
  return match ? match[0] : "";
}

/**
 * @param {string} body
 * @returns {Record<string, string>}
 */
function parseFooters(body) {
  /** @type {Record<string, string>} */
  const footers = {};
  for (const line of body.split(/\r?\n/u)) {
    const match = line.match(/^([A-Za-z-]+):\s+(.+)$/u);
    if (!match) {
      continue;
    }
    const [, key, value] = match;
    footers[key] = value.trim();
  }
  return footers;
}

/**
 * @param {string} subject
 * @param {string} body
 * @returns {ParsedConventionalCommit}
 */
export function parseConventionalCommit(subject, body) {
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

  const [, type, scope = "", bang = "", description = ""] = header;
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

/**
 * @param {ParsedConventionalCommit} parsed
 * @returns {string}
 */
export function normalizedCommitType(parsed) {
  if (!parsed.valid || !parsed.type) {
    return "other";
  }
  return parsed.type;
}

/**
 * @param {ParsedConventionalCommit} parsed
 * @param {boolean} strict
 * @param {string} targetLabel
 * @param {string} sha
 * @param {string} subject
 */
export function assertConventionalCommitValidity(parsed, strict, targetLabel, sha, subject) {
  if (!parsed.valid && strict) {
    throw new Error(
      `Invalid conventional commit for target "${targetLabel}" in strict mode: ${sha} "${subject}"`
    );
  }
  return parsed;
}

/**
 * @param {ParsedConventionalCommit[]} commits
 * @param {Record<string, BumpLevel>} bumpRules
 * @returns {BumpLevel}
 */
export function resolveBumpFromCommits(commits, bumpRules) {
  /** @type {BumpLevel} */
  let highest = "none";

  for (const commit of commits) {
    /** @type {BumpLevel} */
    const bump = commit.isBreaking
      ? "major"
      : bumpRules[normalizedCommitType(commit)] ?? bumpRules.other ?? "none";

    if (bump === "major") {
      return "major";
    }
    if (bump === "minor" && highest !== "major") {
      highest = "minor";
    } else if (bump === "patch" && highest === "none") {
      highest = "patch";
    }
  }

  return highest;
}
