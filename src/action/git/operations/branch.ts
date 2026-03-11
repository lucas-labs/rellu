import cmd from '@/utils/cmd';
import { setUser } from './config';

export const prepareBranch = async (
  baseBranch: string,
  branch: string,
  { shouldSetUser }: { shouldSetUser: boolean } = { shouldSetUser: false },
) => {
  await cmd.exec('git', ['fetch', 'origin', baseBranch]);
  await cmd.exec('git', ['checkout', '-B', branch, `origin/${baseBranch}`]);
  if (shouldSetUser) {
    await setUser('rellu[bot]', 'rellu-bot@users.noreply.github.com');
  }
};
