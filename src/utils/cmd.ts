import { getExecOutput, type ExecOptions } from '@actions/exec';

export interface CommandResult {
  stdout: string;
  stderr: string;
  code: number;
}

export interface CommandOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  silent?: boolean;
}

const normalizeEnv = (
  env: NodeJS.ProcessEnv | undefined,
): Record<string, string> | undefined => {
  if (!env) {
    return undefined;
  }
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined) {
      normalized[key] = value;
    }
  }
  return normalized;
};

const exec = async (
  command: string,
  args: string[] = [],
  options: CommandOptions = {},
): Promise<CommandResult> => {
  const execOptions: ExecOptions = {
    ignoreReturnCode: true,
    silent: options.silent ?? true,
  };
  if (options.cwd) {
    execOptions.cwd = options.cwd;
  }
  const env = normalizeEnv(options.env);
  if (env) {
    execOptions.env = env;
  }

  const output = await getExecOutput(command, args, {
    ...execOptions,
  });

  const result: CommandResult = {
    stdout: output.stdout,
    stderr: output.stderr,
    code: output.exitCode,
  };

  if (result.code !== 0) {
    const message = [
      `Command failed: ${command} ${args.join(' ')}`,
      result.stderr.trim() ? `stderr: ${result.stderr.trim()}` : '',
      result.stdout.trim() ? `stdout: ${result.stdout.trim()}` : '',
    ]
      .filter(Boolean)
      .join('\n');
    throw new Error(message);
  }

  return result;
};

const cmd = { exec };
export default cmd;
