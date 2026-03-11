import { type getOctokit } from '@actions/github';

export type Octokit = ReturnType<typeof getOctokit>;

export interface PullRequest {
  number: number;
  htmlUrl: string;
  title: string;
  headRef: string;
}

export interface RepoIdentifier {
  owner: string;
  name: string;
}
