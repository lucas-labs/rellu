import { getExecOutput, type ExecOptions } from "@actions/exec";
import type { CommandOptions, CommandResult } from "../types.js";

function normalizeEnv(env: NodeJS.ProcessEnv | undefined): Record<string, string> | undefined {
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
}

export async function runCommand(
  command: string,
  args: string[],
  options: CommandOptions = {}
): Promise<CommandResult> {
  const execOptions: ExecOptions = {
    ignoreReturnCode: true,
    silent: options.silent ?? true
  };
  if (options.cwd) {
    execOptions.cwd = options.cwd;
  }
  const normalizedEnv = normalizeEnv(options.env);
  if (normalizedEnv) {
    execOptions.env = normalizedEnv;
  }

  const output = await getExecOutput(command, args, {
    ...execOptions
  });

  const result: CommandResult = {
    stdout: output.stdout,
    stderr: output.stderr,
    code: output.exitCode
  };

  if (result.code !== 0) {
    const message = [
      `Command failed: ${command} ${args.join(" ")}`,
      result.stderr.trim() ? `stderr: ${result.stderr.trim()}` : "",
      result.stdout.trim() ? `stdout: ${result.stdout.trim()}` : ""
    ]
      .filter(Boolean)
      .join("\n");
    throw new Error(message);
  }

  return result;
}
