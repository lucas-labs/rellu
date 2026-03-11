import cmd from '@/utils/cmd';

export const addFiles = async (...filePaths: string[]) => {
  await cmd.exec('git', ['add', ...filePaths]);
};

export const isFileModified = async (filePath: string): Promise<boolean> => {
  const { stdout } = await cmd.exec('git', ['status', '--porcelain', '--', filePath]);
  const status = stdout.trim();
  return !!status;
};

export const commitChanges = async (
  message: string,
  { verify }: { verify: boolean } = { verify: true },
) => {
  const args = ['commit', '-m', message];
  if (!verify) {
    args.push('--no-verify');
  }
  await cmd.exec('git', args);
};

export const pushBranch = async (
  remote: string,
  branch: string,
  { force }: { force: boolean } = { force: false },
) => {
  branch = force ? `+${branch}` : branch;
  await cmd.exec('git', ['push', remote, branch]);
};
