import { getOctokit } from '@actions/github';
import { createPr, listPullRequsts, updatePr } from './operations/pr';
import { parseRepoIdentifier } from './operations/repo';
import { getUserLoginByEmail, getCommitAuthorLogin, enrichCommit } from './operations/commit';
import type { RelluActionInputs } from '../config/schema';

const CACHE: Record<string, ReturnType<typeof makeClient>> = {};

const makeClient = (token: string) => {
  const gh = getOctokit(token);
  return {
    pr: {
      /** lists pull requests in the given repo, optionally filtered by head ref */
      list: listPullRequsts(gh),
      /** creates a pr with the given title and body, and returns its number and url */
      create: createPr(gh),
      /** updates a pr's title and/or body */
      update: updatePr(gh),
    },
    repo: {
      /** parses an identifier of the form "owner/repo" into its components */
      parseIdentifier: parseRepoIdentifier,
    },
    commit: {
      /** gets the gh username of the author of a commit, if it can be resolved */
      getAuthor: getCommitAuthorLogin(gh),
      /** gets the gh username associated with an email address, if any */
      getUserByEmail: getUserLoginByEmail(gh),
      /** enriches a list of commits with github information (username, etc) */
      enrich: enrichCommit(gh),
    },
  };
};

/** returns an authenticated client with convenient methods for interacting with github */
const getGh = (inputs: RelluActionInputs) => {
  const token = inputs.githubToken;
  if (!token) {
    throw new Error(
      'GitHub token is required to interact with the GitHub API. Set the "github-token" input.',
    );
  }

  if (CACHE[token]) {
    return CACHE[token];
  }

  const client = makeClient(token);

  CACHE[token] = client;
  return client;
};

export default getGh;
