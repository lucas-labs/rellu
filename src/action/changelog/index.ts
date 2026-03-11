interface ChangelogCommit {
  sha: string;
  description: string;
  scope: string | null;
  type: string | null;
  displayAuthor: string;
}

export interface ChangelogConfig {
  categoryMap: Record<string, string>;
  sectionOrder: string[];
}

export const DEFAULT_CHANGELOG_CATEGORY_MAP: Readonly<Record<string, string>> = Object.freeze({
  feat: 'Features',
  fix: 'Bug Fixes',
  docs: 'Documentation',
  perf: 'Performance',
  refactor: 'Refactoring',
  ci: 'CI',
  chore: 'Chores',
  test: 'Tests',
  build: 'Other',
  style: 'Other',
  other: 'Other',
});

export const DEFAULT_CHANGELOG_SECTION_ORDER: ReadonlyArray<string> = Object.freeze([
  'Features',
  'Bug Fixes',
  'Documentation',
  'Performance',
  'Refactoring',
  'CI',
  'Chores',
  'Tests',
  'Other',
]);

const CATEGORY_TITLE_LABELS = {
  Features: '✨ Features',
  'Bug Fixes': '🐛 Bug Fixes',
  Documentation: '📚 Documentation',
  Performance: '🐎 Performance',
  Refactoring: '🔨 Refactoring',
  CI: '♾️ CI',
  Chores: '🧹 Chores',
  Tests: '✅ Tests',
  Other: '🔧 Other',
} as const;

const MARKDOWN_ESCAPABLE_PATTERN = /([\\`*_{}\[\]()#+.!|>@])/gu;

export function escapeMarkdownText(value: string): string {
  return value.replace(MARKDOWN_ESCAPABLE_PATTERN, '\\$1');
}

function formatSha(sha: string, repo: string, onGithub = true): string {
  const shortSha = sha.slice(0, 7);
  if (!repo) {
    return shortSha;
  }

  if (onGithub) {
    const webBase = 'https://github.com';
    return `[${shortSha}](${webBase}/${repo}/commit/${sha})`;
  } else {
    return shortSha;
  }
}

function sectionForType(type: string | null, categoryMap: Record<string, string>): string {
  const key = (type ?? 'other').toLowerCase();
  return categoryMap[key] ?? categoryMap.other ?? 'Other';
}

export function renderChangelog(
  commits: ChangelogCommit[],
  repo: string,
  config?: ChangelogConfig,
): string {
  const categoryMap =
    config?.categoryMap ?? (DEFAULT_CHANGELOG_CATEGORY_MAP as Record<string, string>);
  const sectionOrder = config?.sectionOrder ?? [...DEFAULT_CHANGELOG_SECTION_ORDER];
  const groups = new Map<string, string[]>();

  for (const commit of commits) {
    const section = sectionForType(commit.type, categoryMap);
    const escapedDescription = escapeMarkdownText(commit.description);
    const escapedScope = commit.scope ? escapeMarkdownText(commit.scope) : null;
    const scopedDescription = escapedScope
      ? `${escapedScope}: ${escapedDescription}`
      : escapedDescription;
    const shaText = formatSha(commit.sha, repo);
    const entry = `- ${scopedDescription} (thanks ${commit.displayAuthor}) (${shaText})`;
    if (!groups.has(section)) {
      groups.set(section, []);
    }
    groups.get(section)?.push(entry);
  }

  const orderedSet = new Set(sectionOrder);
  const fallbackSections = [...groups.keys()]
    .filter((section) => !orderedSet.has(section))
    .sort((a, b) => a.localeCompare(b));
  const orderedSections = [...sectionOrder, ...fallbackSections];

  const chunks: string[] = [];
  for (const section of orderedSections) {
    const entries = groups.get(section);
    if (!entries || entries.length === 0) {
      continue;
    }
    const title =
      CATEGORY_TITLE_LABELS[section as keyof typeof CATEGORY_TITLE_LABELS] ?? section;
    chunks.push(`## ${title}`);
    chunks.push(...entries);
    chunks.push('');
  }

  return chunks.length > 0 ? chunks.join('\n').trim() : '';
}
