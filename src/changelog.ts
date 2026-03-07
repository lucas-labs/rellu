import type { ChangelogConfig } from "./types.js";
import { escapeMarkdownText } from "./utils/markdown.js";

interface ChangelogCommit {
  sha: string;
  description: string;
  scope: string | null;
  type: string | null;
  displayAuthor: string;
}

export const DEFAULT_CHANGELOG_CATEGORY_MAP: Readonly<Record<string, string>> = Object.freeze({
  feat: "Features",
  fix: "Bug Fixes",
  docs: "Documentation",
  perf: "Performance",
  refactor: "Refactoring",
  build: "Build / CI",
  ci: "Build / CI",
  chore: "Chores",
  test: "Tests",
  style: "Other",
  other: "Other"
});

export const DEFAULT_CHANGELOG_SECTION_ORDER: ReadonlyArray<string> = Object.freeze([
  "Features",
  "Bug Fixes",
  "Documentation",
  "Performance",
  "Refactoring",
  "Build / CI",
  "Chores",
  "Tests",
  "Other"
]);

function formatSha(sha: string, repo: string, githubServerUrl: string): string {
  const shortSha = sha.slice(0, 7);
  if (!repo) {
    return shortSha;
  }
  const webBase = githubServerUrl
    .replace(/api\.github\.com\/?$/u, "github.com")
    .replace(/\/api\/v3\/?$/u, "");
  return `[${shortSha}](${webBase}/${repo}/commit/${sha})`;
}

function sectionForType(type: string | null, categoryMap: Record<string, string>): string {
  const key = (type ?? "other").toLowerCase();
  return categoryMap[key] ?? categoryMap.other ?? "Other";
}

export function renderChangelog(
  commits: ChangelogCommit[],
  repo: string,
  githubServerUrl: string,
  config?: ChangelogConfig
): string {
  const categoryMap = config?.categoryMap ?? (DEFAULT_CHANGELOG_CATEGORY_MAP as Record<string, string>);
  const sectionOrder = config?.sectionOrder ?? [...DEFAULT_CHANGELOG_SECTION_ORDER];
  const groups = new Map<string, string[]>();

  for (const commit of commits) {
    const section = sectionForType(commit.type, categoryMap);
    const escapedDescription = escapeMarkdownText(commit.description);
    const escapedScope = commit.scope ? escapeMarkdownText(commit.scope) : null;
    const escapedDisplayAuthor = escapeMarkdownText(commit.displayAuthor);
    const scopedDescription = escapedScope ? `${escapedScope}: ${escapedDescription}` : escapedDescription;
    const shaText = formatSha(commit.sha, repo, githubServerUrl);
    const entry = `- ${scopedDescription} (thanks ${commit.displayAuthor}) (${shaText})`;
    if (!groups.has(section)) {
      groups.set(section, []);
    }
    groups.get(section)?.push(entry);
  }

  const orderedSet = new Set(sectionOrder);
  const fallbackSections = [...groups.keys()].filter((section) => !orderedSet.has(section)).sort((a, b) => a.localeCompare(b));
  const orderedSections = [...sectionOrder, ...fallbackSections];

  const chunks: string[] = [];
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
