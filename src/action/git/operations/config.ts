import cmd from '@/utils/cmd';

export const set = async (key: string, value: string, global = false) => {
  const args = ['config'];
  if (global) {
    args.push('--global');
  }
  args.push(key, value);
  await cmd.exec('git', args);
};

export const setUser = async (name: string, email: string, global = false) => {
  await set('user.name', name, global);
  await set('user.email', email, global);
};
