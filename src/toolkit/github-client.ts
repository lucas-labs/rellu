import { getOctokit } from "@actions/github";
import type {
  GitHubClient,
  GitHubCreatePullOptions,
  GitHubListPullsOptions,
  GitHubPullRequest,
  GitHubRepoRef,
  GitHubUpdatePullOptions
} from "../types.js";

function normalizeApiBase(apiBase: string): string {
  return apiBase.replace(/\/+$/u, "");
}

function toPullRequest(data: {
  number: number;
  html_url: string;
  title?: string | null;
  head?: {
    ref?: string | null;
  } | null;
}): GitHubPullRequest {
  return {
    number: data.number,
    htmlUrl: data.html_url,
    title: String(data.title ?? ""),
    headRef: String(data.head?.ref ?? "")
  };
}

export function parseRepoRef(repo: string): GitHubRepoRef | null {
  const [owner, name] = repo.split("/");
  if (!owner || !name) {
    return null;
  }
  return { owner, name };
}

export function createGitHubClient(token: string, apiBase: string): GitHubClient {
  const octokit = getOctokit(token, { baseUrl: normalizeApiBase(apiBase) });

  return {
    async listPulls(repo: GitHubRepoRef, options: GitHubListPullsOptions): Promise<GitHubPullRequest[]> {
      const response = await octokit.rest.pulls.list({
        owner: repo.owner,
        repo: repo.name,
        state: options.state ?? "open",
        base: options.base,
        per_page: options.perPage ?? 100,
        ...(options.head ? { head: options.head } : {})
      });
      return response.data.map((pull) => toPullRequest(pull));
    },
    async createPull(repo: GitHubRepoRef, options: GitHubCreatePullOptions): Promise<GitHubPullRequest> {
      const response = await octokit.rest.pulls.create({
        owner: repo.owner,
        repo: repo.name,
        title: options.title,
        head: options.head,
        base: options.base,
        body: options.body
      });
      return toPullRequest(response.data);
    },
    async updatePull(
      repo: GitHubRepoRef,
      pullNumber: number,
      options: GitHubUpdatePullOptions
    ): Promise<GitHubPullRequest> {
      const response = await octokit.rest.pulls.update({
        owner: repo.owner,
        repo: repo.name,
        pull_number: pullNumber,
        ...(options.title !== undefined ? { title: options.title } : {}),
        ...(options.body !== undefined ? { body: options.body } : {})
      });
      return toPullRequest(response.data);
    },
    async getCommitAuthorLogin(repo: GitHubRepoRef, sha: string): Promise<string> {
      const response = await octokit.rest.repos.getCommit({
        owner: repo.owner,
        repo: repo.name,
        ref: sha
      });
      return String(response.data.author?.login ?? "");
    },
    async getUserLoginByEmail(email: string): Promise<string> {
      const response = await octokit.rest.search.users({
        q: `${email} in:email`,
        per_page: 1
      });
      return String(response.data.items[0]?.login ?? "");
    }
  };
}
