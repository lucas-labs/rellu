import { expect, mock, test } from "bun:test";

test("parseRepoRef accepts exact owner/name repository slug", async () => {
  try {
    mock.module("@actions/github", () => ({
      getOctokit: () => {
        throw new Error("getOctokit should not be called in parseRepoRef tests");
      }
    }));

    const queryKey = "repo-ref-valid";
    const { parseRepoRef } = await import(`../../src/toolkit/github-client.ts?${queryKey}`);
    expect(parseRepoRef("acme/rellu")).toEqual({ owner: "acme", name: "rellu" });
    expect(parseRepoRef(" acme / rellu ")).toEqual({ owner: "acme", name: "rellu" });
  } finally {
    mock.restore();
  }
});

test("parseRepoRef rejects malformed repository slugs", async () => {
  try {
    mock.module("@actions/github", () => ({
      getOctokit: () => {
        throw new Error("getOctokit should not be called in parseRepoRef tests");
      }
    }));

    const queryKey = "repo-ref-invalid";
    const { parseRepoRef } = await import(`../../src/toolkit/github-client.ts?${queryKey}`);
    expect(parseRepoRef("")).toBeNull();
    expect(parseRepoRef("acme")).toBeNull();
    expect(parseRepoRef("/rellu")).toBeNull();
    expect(parseRepoRef("acme/")).toBeNull();
    expect(parseRepoRef("acme/rellu/extra")).toBeNull();
  } finally {
    mock.restore();
  }
});
