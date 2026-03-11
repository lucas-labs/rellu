import cmd from '@/utils/cmd';
import { log } from '@/utils/logger';
import { resolveCommit } from './commit/commands';
import { resolveFirstCommit } from './range';

/** lists tags that are reachable from the given ref, sorted by creation date (newest first) */
export const listMergedTags = async (toRefSha: string) => {
  const { stdout } = await cmd.exec('git', [
    'tag',
    '--merged',
    toRefSha,
    '--sort=-creatordate',
  ]);
  return stdout
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
};

/**
 * resolves the git range start by finding the latest reachable tag from the given ref,
 * optionally filtered by a prefix. Falls back to the first commit if no matching tag is found.
 */
export const resolveLatestTagStart = async (
  toRefSha: string,
  options: {
    targetLabel: string;
    tagPrefix?: string;
  },
) => {
  const allTags = await listMergedTags(toRefSha);
  const matchingTags = options.tagPrefix
    ? allTags.filter((tagName) => tagName.startsWith(options.tagPrefix ?? ''))
    : allTags;
  const latestTag = matchingTags[0] ?? '';

  if (latestTag) {
    const tagCommit = await resolveCommit(latestTag);
    log.info(
      options.tagPrefix
        ? `Resolved range start for target "${options.targetLabel}" from latest tag "${latestTag}" (prefix "${options.tagPrefix}").`
        : `Resolved range start from latest reachable tag "${latestTag}".`,
    );
    return tagCommit;
  }

  const firstCommit = await resolveFirstCommit(toRefSha);
  if (!firstCommit) {
    throw new Error(`Unable to resolve first commit for ${toRefSha}.`);
  }

  log.info(
    options.tagPrefix
      ? `No matching tag found for target "${options.targetLabel}" with prefix "${options.tagPrefix}". Falling back to first commit ${firstCommit}.`
      : `No reachable tags found for ${toRefSha}. Falling back to first commit ${firstCommit}.`,
  );
  return firstCommit;
};
