import cmd from '@/utils/cmd';
import pathUtils from '@/utils/paths';

export interface RawCommit {
  sha: string;
  parents: string[];
  subject: string;
  body: string;
  authorName: string;
  authorEmail: string;
  files: string[];
  isMerge: boolean;
  githubUsername: string;
  authorDisplay: string;
}

export interface ConventionalCommit {
  type: string;
  scope: string | null;
  description: string;
  emoji: string;
  isBreaking: boolean;
  rawSubject: string;
  body: string;
  footers: Record<string, string>;
  valid: boolean;
}

export type Commit = RawCommit & {
  conventional: ConventionalCommit;
};

/** resolves the commit SHA that a ref (tag, branch) points to */
export const resolveCommit = async (ref: string) => {
  const { stdout } = await cmd.exec('git', ['rev-list', '-n', '1', ref]);
  return stdout.trim();
};

/** lists files changed in a given commit SHA */
export const listCommitFiles = async (sha: string) => {
  const { stdout } = await cmd.exec('git', [
    'diff-tree',
    '--no-commit-id',
    '--name-only',
    '-r',
    '--first-parent',
    '-m',
    sha,
  ]);
  return pathUtils.dedupAndSort(
    stdout
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter(Boolean),
  );
};

/** retrieves metadata for a given commit SHA, including author info and message */
export const commitMetadata = async (
  sha: string,
): Promise<Omit<RawCommit, 'files' | 'githubUsername' | 'authorDisplay'>> => {
  const format = ['%H', '%P', '%s', '%b', '--RELLU--', '%an', '--RELLU--', '%ae'].join('%n');
  const { stdout } = await cmd.exec('git', ['show', '-s', `--format=${format}`, sha]);
  const [meta = '', authorName = '', authorEmail = ''] = stdout.split('--RELLU--');
  const lines = meta.replace(/\r/g, '').split('\n');

  const parsedSha = (lines.shift() ?? '').trim();
  const parents = (lines.shift() ?? '').trim().split(' ').filter(Boolean);
  const subject = lines.shift() ?? '';
  const body = lines.join('\n').trim();

  return {
    sha: parsedSha || sha,
    parents,
    subject,
    body,
    authorName: authorName.trim(),
    authorEmail: authorEmail.trim(),
    isMerge: parents.length > 1,
  };
};
