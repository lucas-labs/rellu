import { expect, mock, test } from "bun:test";

function createLogger() {
  return {
    info: (_message: string) => {},
    warn: (_message: string) => {},
    error: (_message: string) => {}
  };
}

test("enrichCommitsWithGitHubUsernames applies association -> email -> author-name fallback", async () => {
  const getCommitAuthorLoginMock = mock(async (_repo: { owner: string; name: string }, sha: string) => {
    if (sha === "c1") {
      return "octocat";
    }
    return "";
  });
  const getUserLoginByEmailMock = mock(async (email: string) => {
    if (email === "dev2@example.com") {
      return "dev-two";
    }
    return "";
  });

  try {
    mock.module("../../src/toolkit/github-client.ts", () => ({
      parseRepoRef: () => ({ owner: "acme", name: "rellu" }),
      createGitHubClient: () => ({
        listPulls: async () => [],
        createPull: async () => ({ number: 1, htmlUrl: "", title: "", headRef: "" }),
        updatePull: async () => ({ number: 1, htmlUrl: "", title: "", headRef: "" }),
        getCommitAuthorLogin: getCommitAuthorLoginMock,
        getUserLoginByEmail: getUserLoginByEmailMock
      })
    }));
    const { enrichCommitsWithGitHubUsernames } = await import("../../src/git.ts?author-resolution");

    const commits = [
      {
        sha: "c1",
        parents: [],
        subject: "fix: one",
        body: "",
        authorName: "Dev One",
        authorEmail: "dev1@example.com",
        files: ["apps/app1/src/a.ts"],
        isMerge: false,
        githubUsername: "",
        authorDisplay: "Dev One"
      },
      {
        sha: "c2",
        parents: [],
        subject: "fix: two",
        body: "",
        authorName: "Dev Two",
        authorEmail: "dev2@example.com",
        files: ["apps/app1/src/b.ts"],
        isMerge: false,
        githubUsername: "",
        authorDisplay: "Dev Two"
      },
      {
        sha: "c3",
        parents: [],
        subject: "fix: three",
        body: "",
        authorName: "Jane Doe",
        authorEmail: "missing@example.com",
        files: ["apps/app1/src/c.ts"],
        isMerge: false,
        githubUsername: "",
        authorDisplay: "Jane Doe"
      }
    ];

    const enriched = await enrichCommitsWithGitHubUsernames(
      commits,
      "acme/rellu",
      "https://api.github.com",
      "token-123",
      createLogger()
    );

    expect(enriched[0]?.githubUsername).toBe("octocat");
    expect(enriched[0]?.authorDisplay).toBe("@octocat");

    expect(enriched[1]?.githubUsername).toBe("dev-two");
    expect(enriched[1]?.authorDisplay).toBe("@dev-two");

    expect(enriched[2]?.githubUsername).toBe("");
    expect(enriched[2]?.authorDisplay).toBe("Jane Doe");

    expect(getCommitAuthorLoginMock).toHaveBeenCalledTimes(3);
    expect(getUserLoginByEmailMock).toHaveBeenCalledTimes(2);

    const { renderChangelog } = await import("../../src/changelog.ts");
    const changelog = renderChangelog(
      enriched.map((commit) => ({
        sha: commit.sha,
        description: commit.subject,
        scope: null,
        type: "fix",
        displayAuthor: commit.authorDisplay
      })),
      "acme/rellu",
      "https://api.github.com"
    );
    expect(changelog).toContain("thanks @octocat");
    expect(changelog).toContain("thanks @dev-two");
    expect(changelog).toContain("thanks Jane Doe");
  } finally {
    mock.restore();
  }
});
