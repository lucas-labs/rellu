interface ChangelogCommit {
  sha: string;
  description: string;
  scope: string | null;
  type: string | null;
  displayAuthor: string;
}

const DEFAULT_SECTIONS = new Map<string, string>([
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

function sectionForType(type: string | null): string {
  return DEFAULT_SECTIONS.get(type ?? "other") ?? "Other";
}

export function renderChangelog(commits: ChangelogCommit[], repo: string, githubServerUrl: string): string {
  const groups = new Map<string, string[]>();

  for (const commit of commits) {
    const section = sectionForType(commit.type);
    const scopedDescription = commit.scope ? `${commit.scope}: ${commit.description}` : commit.description;
    const shaText = formatSha(commit.sha, repo, githubServerUrl);
    const entry = `- ${scopedDescription} (thanks ${commit.displayAuthor}) (${shaText})`;
    if (!groups.has(section)) {
      groups.set(section, []);
    }
    groups.get(section)?.push(entry);
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
