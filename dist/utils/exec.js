import { spawn } from "node:child_process";

/**
 * @param {string} command
 * @param {string[]} args
 * @param {import("node:child_process").SpawnOptionsWithoutStdio=} options
 * @returns {Promise<{ stdout: string; stderr: string; code: number }>}
 */
export async function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { ...options, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on("data", (chunk) => {
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
