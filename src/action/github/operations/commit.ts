import type { RawCommit } from '@/action/git';
import type { Octokit, RepoIdentifier } from '../types';
import { parseRepoIdentifier } from './repo';
import { log } from '@/utils/logger';

export const getCommitAuthorLogin = (gh: Octokit) => {
  return async (repo: RepoIdentifier, sha: string) => {
    const response = await gh.rest.repos.getCommit({
      owner: repo.owner,
      repo: repo.name,
      ref: sha,
    });
    return String(response.data.author?.login ?? '');
  };
};

const LOGIN_CACHE: Record<string, string> = {};

export const getUserLoginByEmail = (gh: Octokit) => {
  return async (email: string) => {
    if (LOGIN_CACHE[email]) {
      return LOGIN_CACHE[email];
    }

    const response = await gh.rest.search.users({
      q: `${email} in:email`,
      per_page: 1,
    });

    LOGIN_CACHE[email] = String(response.data.items[0]?.login ?? '');
    return LOGIN_CACHE[email];
  };
};

export const authorDisplay = (authorName: string, githubUsername: string): string => {
  if (githubUsername) {
    return `@${githubUsername}`;
  }
  return authorName || 'unknown';
};

export const enrichCommit = (gh: Octokit) => {
  return async (commits: RawCommit[], repo: string) => {
    const parsed = parseRepoIdentifier(repo);
    if (!parsed) {
      return commits;
    }

    const updated: RawCommit[] = [];
    for (const commit of commits) {
      let resolvedUsername = '';

      try {
        resolvedUsername = (await getCommitAuthorLogin(gh)(parsed, commit.sha)).trim();
      } catch (error) {
        log.warn(
          `Could not resolve associated GitHub username for commit ${commit.sha}: ${String(error)}`,
        );
      }

      if (!resolvedUsername && commit.authorEmail) {
        try {
          resolvedUsername = (await getUserLoginByEmail(gh)(commit.authorEmail)).trim();
        } catch (error) {
          log.warn(
            `Could not resolve GitHub username by email for commit ${commit.sha} (${commit.authorEmail}): ${String(error)}`,
          );
        }
      }

      updated.push({
        ...commit,
        githubUsername: resolvedUsername,
        authorDisplay: authorDisplay(commit.authorName, resolvedUsername),
      });
    }
    return updated;
  };
};
