import type { BumpLevel } from '@/action/config/schema';
import type { ConventionalCommit } from './commands';

const HEADER_REGEX = /^([a-zA-Z][\w-]*)(?:\(([^)]+)\))?(!)?:\s+(.+)$/u;

const EMOJI_REGEX = /\p{Extended_Pictographic}/u;

const extractEmoji = (text: string): { emoji: string | undefined; desc: string } => {
  const match = text.match(EMOJI_REGEX);

  if (!match) {
    return { desc: text, emoji: undefined };
  }

  const emoji = match[0];
  const cleaned = text.replace(new RegExp(`^${emoji}\\s*`, 'u'), '');

  return {
    emoji,
    desc: cleaned.trim(),
  };
};

const parseFooters = (body: string): Record<string, string> => {
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
};

export const assertConventionalCommitValidity = (
  parsed: ConventionalCommit,
  strict: boolean,
  targetLabel: string,
  sha: string,
  subject: string,
  options: {
    isMerge: boolean;
  },
): ConventionalCommit => {
  if (!parsed.valid && strict && !options.isMerge) {
    throw new Error(
      `Invalid conventional commit for target "${targetLabel}" in strict mode: ${sha} "${subject}"`,
    );
  }
  return parsed;
};

export const resolveBumpFromCommits = (
  commits: ConventionalCommit[],
  bumpRules: Record<string, BumpLevel>,
): BumpLevel => {
  let highest: BumpLevel = 'none';

  for (const commit of commits) {
    const bump: BumpLevel = commit.isBreaking
      ? 'major'
      : (bumpRules[commit.type] ?? bumpRules.other ?? 'none');

    if (bump === 'major') {
      return 'major';
    }
    if (bump === 'minor') {
      highest = 'minor';
    } else if (bump === 'patch' && highest === 'none') {
      highest = 'patch';
    }
  }

  return highest;
};

export const parseConventionalCommit = (subject: string, body: string): ConventionalCommit => {
  const trimmedSubject = subject.trim();
  const header = trimmedSubject.match(HEADER_REGEX);
  const footerMap = parseFooters(body);
  const hasBreakingFooter = /(^|\n)BREAKING CHANGE:\s+/u.test(body);

  if (!header) {
    const { emoji, desc } = extractEmoji(trimmedSubject);
    return {
      type: 'other',
      scope: null,
      description: desc,
      emoji: emoji || '',
      isBreaking: hasBreakingFooter,
      rawSubject: trimmedSubject,
      body,
      footers: footerMap,
      valid: false,
    };
  }

  const [, type = '', scope = '', bang = '', description = ''] = header;
  const { emoji, desc } = extractEmoji(description);
  return {
    type: type || 'other',
    scope: scope || null,
    description: desc,
    emoji: emoji || '',
    isBreaking: bang === '!' || hasBreakingFooter,
    rawSubject: trimmedSubject,
    body,
    footers: footerMap,
    valid: true,
  };
};
