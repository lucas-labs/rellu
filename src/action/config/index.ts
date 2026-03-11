import { getInput as coreGetInput } from '@actions/core';
import configFileLoader from './config-file';
import {
  RelluConfigSchema,
  type NoBumpPolicy,
  type RangeStrategy,
  type RelluConfig,
} from './schema';

/** same as getInput but returns undefined if the input is not set (instead of empty string) */
const getInput = (name: string) => {
  const value = coreGetInput(name);
  return value || undefined;
};

const load = (): RelluConfig => {
  const configPath = getInput('config-file') || '.github/rellu.json';
  const configFile = configFileLoader.load(configPath);

  return RelluConfigSchema.parse({
    config: configFile,
    inputs: {
      configPath: getInput('config-file'),
      fromRef: getInput('from-ref'),
      toRef: getInput('to-ref'),
      createReleasePr: getInput('create-release-pr') === 'true',
      noBumpPolicy: getInput('no-bump-policy') as NoBumpPolicy,
      rangeStrategy: getInput('range-strategy') as RangeStrategy,
      releaseBranchPrefix: getInput('release-branch-prefix'),
      strictConventionalCommits: getInput('strict-conventional-commits') === 'true',
      baseBranch: getInput('base-branch'),
      githubToken: getInput('github-token'),
      repo: getInput('repo'),
      releaseCommitMessagePattern:
        getInput('release-commit-message-pattern') || 'release({target}): 🔖 v{version}',
    },
  });
};

const configuration = {
  load,
};

export default configuration;
