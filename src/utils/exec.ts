import { spawn, type SpawnOptionsWithoutStdio } from "node:child_process";
import type { CommandResult } from "../types.js";

export function runCommand(
  command: string,
  args: string[],
  options: SpawnOptionsWithoutStdio = {}
): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { ...options, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer | string) => {
      stdout += String(chunk);
    });

    child.stderr.on("data", (chunk: Buffer | string) => {
      stderr += String(chunk);
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      const exitCode = Number(code ?? 0);
      if (exitCode !== 0) {
        const message = [
          `Command failed: ${command} ${args.join(" ")}`,
          stderr.trim() ? `stderr: ${stderr.trim()}` : "",
          stdout.trim() ? `stdout: ${stdout.trim()}` : ""
        ]
          .filter(Boolean)
          .join("\n");
        reject(new Error(message));
        return;
      }

      resolve({ stdout, stderr, code: exitCode });
    });
  });
}
