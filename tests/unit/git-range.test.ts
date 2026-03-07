import { expect, mock, test } from "bun:test";

function createLogger() {
  const info = mock((_message: string) => {});
  const warn = mock((_message: string) => {});
  const error = mock((_message: string) => {});
  return { info, warn, error };
}

test("resolveGitRangeWithStrategy resolves explicit refs deterministically", async () => {
  const runCommandMock = mock(async (_command: string, args: string[]) => {
    if (args[0] === "rev-parse" && args[2] === "HEAD") {
      return { stdout: "to-sha\n", stderr: "", code: 0 };
    }
    if (args[0] === "rev-parse" && args[2] === "origin/main~10") {
      return { stdout: "from-sha\n", stderr: "", code: 0 };
    }
    throw new Error(`Unexpected command args: ${args.join(" ")}`);
  });

  try {
    mock.module("../../src/utils/exec.ts", () => ({
      runCommand: runCommandMock
    }));
    const { resolveGitRangeWithStrategy } = await import("../../src/git.ts?git-range-explicit");
    const logger = createLogger();

    const range = await resolveGitRangeWithStrategy(
      {
        strategy: "explicit",
        fromRef: "origin/main~10",
        toRef: "HEAD",
        targetLabel: "app-1"
      },
      logger
    );

    expect(range).toEqual({
      from: "from-sha",
      to: "to-sha",
      expression: "from-sha..to-sha"
    });
  } finally {
    mock.restore();
  }
});

test("resolveGitRangeWithStrategy resolves latest matching tag for target prefix", async () => {
  const runCommandMock = mock(async (_command: string, args: string[]) => {
    if (args[0] === "rev-parse" && args[2] === "HEAD") {
      return { stdout: "to-sha\n", stderr: "", code: 0 };
    }
    if (args[0] === "tag" && args[1] === "--merged") {
      return {
        stdout: "app-2@v2.0.0\napp-1@v1.3.0\napp-1@v1.2.0\n",
        stderr: "",
        code: 0
      };
    }
    if (args[0] === "rev-list" && args[1] === "-n" && args[3] === "app-1@v1.3.0") {
      return { stdout: "from-sha\n", stderr: "", code: 0 };
    }
    throw new Error(`Unexpected command args: ${args.join(" ")}`);
  });

  try {
    mock.module("../../src/utils/exec.ts", () => ({
      runCommand: runCommandMock
    }));
    const { resolveGitRangeWithStrategy } = await import("../../src/git.ts?git-range-prefix");
    const logger = createLogger();

    const range = await resolveGitRangeWithStrategy(
      {
        strategy: "latest-tag-with-prefix",
        fromRef: "",
        toRef: "HEAD",
        targetLabel: "app-1",
        tagPrefix: "app-1@v"
      },
      logger
    );

    expect(range).toEqual({
      from: "from-sha",
      to: "to-sha",
      expression: "from-sha..to-sha"
    });
  } finally {
    mock.restore();
  }
});

test("latest-tag-with-prefix falls back to first commit when no tag matches", async () => {
  const runCommandMock = mock(async (_command: string, args: string[]) => {
    if (args[0] === "rev-parse" && args[2] === "HEAD") {
      return { stdout: "to-sha\n", stderr: "", code: 0 };
    }
    if (args[0] === "tag" && args[1] === "--merged") {
      return {
        stdout: "app-2@v2.0.0\napp-2@v1.9.0\n",
        stderr: "",
        code: 0
      };
    }
    if (args[0] === "rev-list" && args[1] === "--max-parents=0") {
      return { stdout: "root-sha\n", stderr: "", code: 0 };
    }
    throw new Error(`Unexpected command args: ${args.join(" ")}`);
  });

  try {
    mock.module("../../src/utils/exec.ts", () => ({
      runCommand: runCommandMock
    }));
    const { resolveGitRangeWithStrategy } = await import("../../src/git.ts?git-range-fallback");
    const logger = createLogger();

    const range = await resolveGitRangeWithStrategy(
      {
        strategy: "latest-tag-with-prefix",
        fromRef: "",
        toRef: "HEAD",
        targetLabel: "app-1",
        tagPrefix: "app-1@v"
      },
      logger
    );

    expect(range).toEqual({
      from: "root-sha",
      to: "to-sha",
      expression: "root-sha..to-sha"
    });
    const messages = logger.info.mock.calls.map((call) => String(call[0]));
    expect(messages.some((message) => message.includes("No matching tag found for target \"app-1\""))).toBe(true);
  } finally {
    mock.restore();
  }
});
