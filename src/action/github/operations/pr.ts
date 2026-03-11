import type { PullRequest, RepoIdentifier } from '../types';
import type { Octokit } from '../types';

export interface GitHubUpdatePullOptions {
  title?: string;
  body?: string;
}

export interface GitHubListPullsOptions {
  base: string;
  state?: 'open' | 'closed' | 'all';
  head?: string;
  perPage?: number;
}

export interface GitHubCreatePullOptions {
  title: string;
  head: string;
  base: string;
  body: string;
}

const toPr = (data: {
  number: number;
  html_url: string;
  title?: string | null;
  head?: {
    ref?: string | null;
  } | null;
}): PullRequest => {
  return {
    number: data.number,
    htmlUrl: data.html_url,
    title: String(data.title ?? ''),
    headRef: String(data.head?.ref ?? ''),
  };
};

export const listPullRequsts = (gh: Octokit) => {
  return async (repo: RepoIdentifier, options: GitHubListPullsOptions) => {
    const response = await gh.rest.pulls.list({
      owner: repo.owner,
      repo: repo.name,
      state: options.state ?? 'open',
      base: options.base,
      per_page: options.perPage ?? 100,
      ...(options.head ? { head: options.head } : {}),
    });
    return response.data.map((pull) => toPr(pull));
  };
};

export const createPr = (gh: Octokit) => {
  return async (repo: RepoIdentifier, options: GitHubCreatePullOptions) => {
    const response = await gh.rest.pulls.create({
      owner: repo.owner,
      repo: repo.name,
      title: options.title,
      head: options.head,
      base: options.base,
      body: options.body,
    });
    return toPr(response.data);
  };
};

export const updatePr = (gh: Octokit) => {
  return async (
    repo: RepoIdentifier,
    pullNumber: number,
    options: GitHubUpdatePullOptions,
  ) => {
    const response = await gh.rest.pulls.update({
      owner: repo.owner,
      repo: repo.name,
      pull_number: pullNumber,
      ...(options.title !== undefined ? { title: options.title } : {}),
      ...(options.body !== undefined ? { body: options.body } : {}),
    });
    return toPr(response.data);
  };
};
