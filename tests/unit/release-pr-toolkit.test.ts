import { expect, mock, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

test("release PR management uses toolkit GitHub client and syncs metadata", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "rellu-release-pr-test-"));
  const manifestPath = path.join(tempDir, "package.json");
  await fs.writeFile(manifestPath, JSON.stringify({ name: "app-1", version: "1.2.3" }, null, 2), "utf8");
  try {
    const runCommandMock = mock(async (_command: string, args: string[]) => {
      if (args[0] === "status") {
        return { stdout: ` M ${manifestPath}\n`, stderr: "", code: 0 };
      }
      return { stdout: "", stderr: "", code: 0 };
    });

    const listPullsMock = mock(async () => [
      {
        number: 42,
        htmlUrl: "https://example.local/pull/42",
        title: "release(app-1): v1.2.4",
        headRef: "rellu/release/app-1"
      }
    ]);
    const updatePullMock = mock(async (_repo, pullNumber: number, options: { title?: string; body?: string }) => ({
      number: pullNumber,
      htmlUrl: "https://example.local/pull/42",
      title: String(options.title ?? ""),
      headRef: "rellu/release/app-1"
    }));
    const createPullMock = mock(async () => {
      throw new Error("createPull should not be called when existing PR is found");
    });

    const createGitHubClientMock = mock(() => ({
      listPulls: listPullsMock,
      updatePull: updatePullMock,
      createPull: createPullMock,
      getCommitAuthorLogin: mock(async () => ""),
      getUserLoginByEmail: mock(async () => "")
    }));
    const parseRepoRefMock = mock(() => ({ owner: "acme", name: "rellu" }));

    mock.module("../../src/utils/exec.ts", () => ({
      runCommand: runCommandMock
    }));
    mock.module("../../src/toolkit/github-client.ts", () => ({
      createGitHubClient: createGitHubClientMock,
      parseRepoRef: parseRepoRefMock
    }));

    const { maybeManageReleasePrs } = await import("../../src/release-pr.ts");

    const outcome = await maybeManageReleasePrs(
      {
        createReleasePrs: true,
        releaseBranchPrefix: "rellu/release",
        baseBranch: "main",
        repo: "acme/rellu",
        githubServerUrl: "https://api.github.com",
        githubToken: "token-123"
      },
      [
        {
          label: "app-1",
          changed: true,
          matchedFiles: [manifestPath],
          commitCount: 1,
          currentVersion: "1.2.3",
          nextVersion: "1.2.4",
          bump: "patch",
          commits: [],
          changelog: { markdown: "## Bug Fixes\n- fix" },
          versionSource: { file: manifestPath, type: "node-package-json" },
          skipRelease: false
        }
      ],
      {
        info: () => {},
        warn: () => {},
        error: () => {}
      }
    );

    expect(createGitHubClientMock).toHaveBeenCalledWith("token-123", "https://api.github.com");
    expect(listPullsMock).toHaveBeenCalled();
    expect(updatePullMock).toHaveBeenCalledWith(
      { owner: "acme", name: "rellu" },
      42,
      {
        title: "release(app-1): v1.2.4",
        body: "## Bug Fixes\n- fix"
      }
    );
    expect(outcome.anyCreatedOrUpdated).toBe(true);
    expect(outcome.updatedResults[0]?.releasePr?.number).toBe(42);
    expect(outcome.updatedResults[0]?.releasePr?.title).toBe("release(app-1): v1.2.4");
  } finally {
    mock.restore();
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});
