import { expect, mock, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

function setWorkspaceRoot(workspaceRoot: string): () => void {
  const previous = process.env.GITHUB_WORKSPACE;
  process.env.GITHUB_WORKSPACE = workspaceRoot;
  return () => {
    if (previous === undefined) {
      delete process.env.GITHUB_WORKSPACE;
      return;
    }
    process.env.GITHUB_WORKSPACE = previous;
  };
}

test("release PR management uses toolkit GitHub client and syncs metadata", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "rellu-release-pr-test-"));
  const manifestPath = path.join(tempDir, "package.json");
  const restoreWorkspace = setWorkspaceRoot(tempDir);
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
    mock.module("../../src/toolkit/io-client.ts", () => ({
      ensureParentDirectory: mock(async () => {})
    }));
    mock.module("../../src/toolkit/github-client.ts", () => ({
      createGitHubClient: createGitHubClientMock,
      parseRepoRef: parseRepoRefMock
    }));

    const queryKey = "release-pr-existing-open";
    const { maybeManageReleasePrs } = await import(`../../src/release-pr.ts?${queryKey}`);

    const outcome = await maybeManageReleasePrs(
      {
        createReleasePrs: true,
        releaseBranchPrefix: "rellu/release",
        baseBranch: "main",
        repo: "acme/rellu",
        githubServerUrl: "https://api.github.com",
        githubToken: "token-123",
        targets: [
          {
            label: "app-1",
            paths: ["apps/app1/**/*"],
            version: {
              file: manifestPath,
              type: "node-package-json"
            },
            releasePr: {
              enabled: true
            }
          }
        ]
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
    restoreWorkspace();
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test("release PR management marks non-releasable targets with disabled releasePr metadata", async () => {
  try {
    const runCommandMock = mock(async () => ({ stdout: "", stderr: "", code: 0 }));
    const createGitHubClientMock = mock(() => ({
      listPulls: mock(async () => []),
      updatePull: mock(async () => {
        throw new Error("updatePull should not be called for non-releasable targets");
      }),
      createPull: mock(async () => {
        throw new Error("createPull should not be called for non-releasable targets");
      }),
      getCommitAuthorLogin: mock(async () => ""),
      getUserLoginByEmail: mock(async () => "")
    }));
    const parseRepoRefMock = mock(() => ({ owner: "acme", name: "rellu" }));

    mock.module("../../src/utils/exec.ts", () => ({
      runCommand: runCommandMock
    }));
    mock.module("../../src/toolkit/io-client.ts", () => ({
      ensureParentDirectory: mock(async () => {})
    }));
    mock.module("../../src/toolkit/github-client.ts", () => ({
      createGitHubClient: createGitHubClientMock,
      parseRepoRef: parseRepoRefMock
    }));

    const queryKey = "release-pr-skipped-target";
    const { maybeManageReleasePrs } = await import(`../../src/release-pr.ts?${queryKey}`);
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
          matchedFiles: ["apps/app1/src/index.ts"],
          commitCount: 1,
          currentVersion: "1.2.3",
          nextVersion: "1.2.3",
          bump: "none",
          commits: [],
          changelog: { markdown: "## No Releases" },
          versionSource: { file: "apps/app1/package.json", type: "node-package-json" },
          skipRelease: true
        }
      ],
      {
        info: () => {},
        warn: () => {},
        error: () => {}
      }
    );

    expect(outcome.anyCreatedOrUpdated).toBe(false);
    expect(outcome.updatedResults[0]?.releasePr).toEqual({ enabled: false });
    expect(outcome.updatedResults[0]?.releasePr?.branch).toBeUndefined();
    expect(outcome.updatedResults[0]?.releasePr?.number).toBeUndefined();
    expect(createGitHubClientMock).toHaveBeenCalledTimes(1);
    expect(runCommandMock).toHaveBeenCalledTimes(0);
  } finally {
    mock.restore();
  }
});

test("release PR management uses sanitized changelog markdown for PR body updates", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "rellu-release-pr-sanitized-body-"));
  const manifestPath = path.join(tempDir, "package.json");
  const restoreWorkspace = setWorkspaceRoot(tempDir);
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
    const createGitHubClientMock = mock(() => ({
      listPulls: listPullsMock,
      updatePull: updatePullMock,
      createPull: mock(async () => {
        throw new Error("createPull should not be called when existing PR is found");
      }),
      getCommitAuthorLogin: mock(async () => ""),
      getUserLoginByEmail: mock(async () => "")
    }));
    const parseRepoRefMock = mock(() => ({ owner: "acme", name: "rellu" }));

    mock.module("../../src/utils/exec.ts", () => ({
      runCommand: runCommandMock
    }));
    mock.module("../../src/toolkit/io-client.ts", () => ({
      ensureParentDirectory: mock(async () => {})
    }));
    mock.module("../../src/toolkit/github-client.ts", () => ({
      createGitHubClient: createGitHubClientMock,
      parseRepoRef: parseRepoRefMock
    }));

    const queryKey = "release-pr-sanitized-body";
    const { maybeManageReleasePrs } = await import(`../../src/release-pr.ts?${queryKey}`);
    const sanitizedMarkdown =
      "## Bug Fixes\n- api: escape \\[link\\]\\(url\\) and ping \\@team (thanks \\@alice\\(bot\\)) ([abc1234](...))";

    await maybeManageReleasePrs(
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
          commits: [
            {
              sha: "abc1234",
              type: "fix",
              scope: "api",
              description: "escape [link](url) and ping @team",
              isBreaking: false,
              rawSubject: "fix(api): escape [link](url) and ping @team",
              body: "",
              author: {
                name: "Alice",
                username: "alice",
                display: "@alice(bot)"
              }
            }
          ],
          changelog: { markdown: sanitizedMarkdown },
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

    expect(updatePullMock).toHaveBeenCalledWith(
      { owner: "acme", name: "rellu" },
      42,
      {
        title: "release(app-1): v1.2.4",
        body: sanitizedMarkdown
      }
    );
  } finally {
    mock.restore();
    restoreWorkspace();
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test("release PR management honors per-target releasePr.enabled opt-out while globally enabled", async () => {
  try {
    const runCommandMock = mock(async () => ({ stdout: "", stderr: "", code: 0 }));
    const listPullsMock = mock(async () => []);
    const updatePullMock = mock(async () => {
      throw new Error("updatePull should not be called when target releasePr.enabled=false");
    });
    const createPullMock = mock(async () => {
      throw new Error("createPull should not be called when target releasePr.enabled=false");
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
    mock.module("../../src/toolkit/io-client.ts", () => ({
      ensureParentDirectory: mock(async () => {})
    }));
    mock.module("../../src/toolkit/github-client.ts", () => ({
      createGitHubClient: createGitHubClientMock,
      parseRepoRef: parseRepoRefMock
    }));

    const queryKey = "release-pr-target-opt-out";
    const { maybeManageReleasePrs } = await import(`../../src/release-pr.ts?${queryKey}`);
    const outcome = await maybeManageReleasePrs(
      {
        createReleasePrs: true,
        releaseBranchPrefix: "rellu/release",
        baseBranch: "main",
        repo: "acme/rellu",
        githubServerUrl: "https://api.github.com",
        githubToken: "token-123",
        targets: [
          {
            label: "app-1",
            paths: ["apps/app1/**/*"],
            version: {
              file: "apps/app1/package.json",
              type: "node-package-json"
            },
            releasePr: {
              enabled: false
            }
          }
        ]
      },
      [
        {
          label: "app-1",
          changed: true,
          matchedFiles: ["apps/app1/src/index.ts"],
          commitCount: 1,
          currentVersion: "1.2.3",
          nextVersion: "1.2.4",
          bump: "patch",
          commits: [],
          changelog: { markdown: "## Bug Fixes\n- fix" },
          versionSource: { file: "apps/app1/package.json", type: "node-package-json" },
          skipRelease: false
        }
      ],
      {
        info: () => {},
        warn: () => {},
        error: () => {}
      }
    );

    expect(outcome.anyCreatedOrUpdated).toBe(false);
    expect(outcome.updatedResults[0]?.releasePr).toEqual({ enabled: false });
    expect(runCommandMock).toHaveBeenCalledTimes(0);
    expect(listPullsMock).toHaveBeenCalledTimes(0);
    expect(createGitHubClientMock).toHaveBeenCalledTimes(1);
  } finally {
    mock.restore();
  }
});

test("release PR management uses per-target branchPrefix and baseBranch overrides", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "rellu-release-pr-override-"));
  const manifestPath = path.join(tempDir, "package.json");
  const restoreWorkspace = setWorkspaceRoot(tempDir);
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
        headRef: "custom/release/app-1"
      }
    ]);
    const updatePullMock = mock(async (_repo, pullNumber: number, options: { title?: string; body?: string }) => ({
      number: pullNumber,
      htmlUrl: "https://example.local/pull/42",
      title: String(options.title ?? ""),
      headRef: "custom/release/app-1"
    }));
    const createGitHubClientMock = mock(() => ({
      listPulls: listPullsMock,
      updatePull: updatePullMock,
      createPull: mock(async () => {
        throw new Error("createPull should not be called when existing PR is found");
      }),
      getCommitAuthorLogin: mock(async () => ""),
      getUserLoginByEmail: mock(async () => "")
    }));
    const parseRepoRefMock = mock(() => ({ owner: "acme", name: "rellu" }));

    mock.module("../../src/utils/exec.ts", () => ({
      runCommand: runCommandMock
    }));
    mock.module("../../src/toolkit/io-client.ts", () => ({
      ensureParentDirectory: mock(async () => {})
    }));
    mock.module("../../src/toolkit/github-client.ts", () => ({
      createGitHubClient: createGitHubClientMock,
      parseRepoRef: parseRepoRefMock
    }));

    const queryKey = "release-pr-target-prefix-base-override";
    const { maybeManageReleasePrs } = await import(`../../src/release-pr.ts?${queryKey}`);
    const outcome = await maybeManageReleasePrs(
      {
        createReleasePrs: true,
        releaseBranchPrefix: "rellu/release",
        baseBranch: "main",
        repo: "acme/rellu",
        githubServerUrl: "https://api.github.com",
        githubToken: "token-123",
        targets: [
          {
            label: "app-1",
            paths: ["apps/app1/**/*"],
            version: {
              file: manifestPath,
              type: "node-package-json"
            },
            releasePr: {
              enabled: true,
              branchPrefix: "custom/release",
              baseBranch: "release-main"
            }
          }
        ]
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

    expect(outcome.anyCreatedOrUpdated).toBe(true);
    expect(outcome.updatedResults[0]?.releasePr?.branch).toBe("custom/release/app-1");

    const fetchCalls = runCommandMock.mock.calls.filter((call) => call[1]?.[0] === "fetch");
    expect(fetchCalls.some((call) => call[1]?.[2] === "release-main")).toBe(true);

    const checkoutCalls = runCommandMock.mock.calls.filter((call) => call[1]?.[0] === "checkout");
    expect(checkoutCalls.some((call) => call[1]?.[2] === "custom/release/app-1")).toBe(true);
    expect(checkoutCalls.some((call) => call[1]?.[3] === "origin/release-main")).toBe(true);

    expect(listPullsMock).toHaveBeenCalledWith(
      { owner: "acme", name: "rellu" },
      {
        state: "open",
        head: "acme:custom/release/app-1",
        base: "release-main",
        perPage: 100
      }
    );
    expect(updatePullMock).toHaveBeenCalled();
  } finally {
    mock.restore();
    restoreWorkspace();
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test("release PR management fails fast on malformed repository slug", async () => {
  try {
    const createGitHubClientMock = mock(() => ({
      listPulls: mock(async () => []),
      updatePull: mock(async () => {
        throw new Error("updatePull should not be called for malformed repo");
      }),
      createPull: mock(async () => {
        throw new Error("createPull should not be called for malformed repo");
      }),
      getCommitAuthorLogin: mock(async () => ""),
      getUserLoginByEmail: mock(async () => "")
    }));
    const parseRepoRefMock = mock(() => null);

    mock.module("../../src/toolkit/github-client.ts", () => ({
      createGitHubClient: createGitHubClientMock,
      parseRepoRef: parseRepoRefMock
    }));
    mock.module("../../src/toolkit/io-client.ts", () => ({
      ensureParentDirectory: mock(async () => {})
    }));

    const queryKey = "release-pr-invalid-repo";
    const { maybeManageReleasePrs } = await import(`../../src/release-pr.ts?${queryKey}`);
    await expect(
      maybeManageReleasePrs(
        {
          createReleasePrs: true,
          releaseBranchPrefix: "rellu/release",
          baseBranch: "main",
          repo: "acme/rellu/extra",
          githubServerUrl: "https://api.github.com",
          githubToken: "token-123"
        },
        [],
        {
          info: () => {},
          warn: () => {},
          error: () => {}
        }
      )
    ).rejects.toThrow(/Expected format "owner\/name"/);
    expect(createGitHubClientMock).toHaveBeenCalledTimes(0);
  } finally {
    mock.restore();
  }
});

test("release PR management blocks force-push when resolved branch is not automation-owned", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "rellu-release-pr-unsafe-branch-"));
  const manifestPath = path.join(tempDir, "package.json");
  const restoreWorkspace = setWorkspaceRoot(tempDir);
  await fs.writeFile(manifestPath, JSON.stringify({ name: "app-1", version: "1.2.3" }, null, 2), "utf8");

  try {
    const runCommandMock = mock(async (_command: string, args: string[]) => {
      if (args[0] === "status") {
        return { stdout: ` M ${manifestPath}\n`, stderr: "", code: 0 };
      }
      return { stdout: "", stderr: "", code: 0 };
    });
    const createGitHubClientMock = mock(() => ({
      listPulls: mock(async () => {
        throw new Error("listPulls should not be reached when branch safety fails");
      }),
      updatePull: mock(async () => {
        throw new Error("updatePull should not be reached when branch safety fails");
      }),
      createPull: mock(async () => {
        throw new Error("createPull should not be reached when branch safety fails");
      }),
      getCommitAuthorLogin: mock(async () => ""),
      getUserLoginByEmail: mock(async () => "")
    }));
    const parseRepoRefMock = mock(() => ({ owner: "acme", name: "rellu" }));

    mock.module("../../src/utils/exec.ts", () => ({
      runCommand: runCommandMock
    }));
    mock.module("../../src/toolkit/io-client.ts", () => ({
      ensureParentDirectory: mock(async () => {})
    }));
    mock.module("../../src/toolkit/github-client.ts", () => ({
      createGitHubClient: createGitHubClientMock,
      parseRepoRef: parseRepoRefMock
    }));

    const queryKey = "release-pr-unsafe-branch-force-push-block";
    const { maybeManageReleasePrs } = await import(`../../src/release-pr.ts?${queryKey}`);

    await expect(
      maybeManageReleasePrs(
        {
          createReleasePrs: true,
          releaseBranchPrefix: "main",
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
      )
    ).rejects.toThrow(/Security validation failed for release branch/);

    const pushCalls = runCommandMock.mock.calls.filter(
      (call) => call[1]?.[0] === "push" && String(call[1]?.[2] ?? "").startsWith("+")
    );
    expect(pushCalls.length).toBe(0);
    expect(createGitHubClientMock).toHaveBeenCalledTimes(1);
  } finally {
    mock.restore();
    restoreWorkspace();
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});
