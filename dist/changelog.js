/**
 * @typedef {{
 *   sha: string;
 *   description: string;
 *   scope: string | null;
 *   type: string | null;
 *   displayAuthor: string;
 * }} ChangelogCommit
 */

const DEFAULT_SECTIONS = new Map([
  ["feat", "Features"],
  ["fix", "Bug Fixes"],
  ["docs", "Documentation"],
  ["perf", "Performance"],
  ["refactor", "Refactoring"],
  ["build", "Build / CI"],
  ["ci", "Build / CI"],
  ["chore", "Chores"],
  ["test", "Tests"],
  ["style", "Other"],
  ["other", "Other"]
]);

/**
 * @param {string} sha
 * @param {string} repo
 * @param {string} githubServerUrl
 */
function formatSha(sha, repo, githubServerUrl) {
  const shortSha = sha.slice(0, 7);
  if (!repo) {
    return shortSha;
  }
  const webBase = githubServerUrl
    .replace(/api\.github\.com\/?$/u, "github.com")
    .replace(/\/api\/v3\/?$/u, "");
  return `[${shortSha}](${webBase}/${repo}/commit/${sha})`;
}

/**
 * @param {string | null} type
 * @returns {string}
 */
function sectionForType(type) {
  return DEFAULT_SECTIONS.get(type ?? "other") ?? "Other";
}

/**
 * @param {ChangelogCommit[]} commits
 * @param {string} repo
 * @param {string} githubServerUrl
 * @returns {string}
 */
export function renderChangelog(commits, repo, githubServerUrl) {
  /** @type {Map<string, string[]>} */
  const groups = new Map();

  for (const commit of commits) {
    const section = sectionForType(commit.type);
    const scopedDescription = commit.scope ? `${commit.scope}: ${commit.description}` : commit.description;
    const shaText = formatSha(commit.sha, repo, githubServerUrl);
    const entry = `- ${scopedDescription} (thanks ${commit.displayAuthor}) (${shaText})`;
    if (!groups.has(section)) {
      groups.set(section, []);
    }
    groups.get(section).push(entry);
  }

  const orderedSections = [
    "Features",
    "Bug Fixes",
    "Documentation",
    "Performance",
    "Refactoring",
    "Build / CI",
    "Chores",
    "Tests",
    "Other"
  ];

  /** @type {string[]} */
  const chunks = [];
  for (const section of orderedSections) {
    const entries = groups.get(section);
    if (!entries || entries.length === 0) {
      continue;
    }
    chunks.push(`## ${section}`);
    chunks.push(...entries);
    chunks.push("");
  }

  return chunks.length > 0 ? chunks.join("\n").trim() : "";
}
