import { log } from '@/utils/logger';
import type { RelluConfig } from '../config/schema';
import git from '../git';
import getGh from '../github';
import type { PullRequest, RepoIdentifier } from '../github/types';
import manifests from '../target/manifests';
import type { ReleasePrInfo, TargetResult } from '../types';
import safety from './safety';

interface TargetReleaseSettings {
  enabled: boolean;
  releaseBranchPrefix: string;
  baseBranch: string;
}

export const getReleaseBranchName = (prefix: string, label: string): string => {
  return `${prefix.replace(/\/+$/u, '')}/${label}`;
};

const findOpenReleasePr = async (
  repo: RepoIdentifier,
  branch: string,
  base: string,
  title: string,
  gh: ReturnType<typeof getGh>,
): Promise<PullRequest | null> => {
  const byBranch = await gh.pr.list(repo, {
    state: 'open',
    head: `${repo.owner}:${branch}`,
    base,
    perPage: 100,
  });
  if (Array.isArray(byBranch) && byBranch.length > 0) {
    return byBranch[0] ?? null;
  }

  const openPulls = await gh.pr.list(repo, {
    state: 'open',
    base,
    perPage: 100,
  });

  return (
    openPulls.find(
      (pull) =>
        String(pull.headRef ?? '') === branch || String(pull.title ?? '').startsWith(title),
    ) ?? null
  );
};

const makeCommitMessage = (pattern: string, targetLabel: string, version: string): string => {
  return pattern.replace(/\{target\}/gu, targetLabel).replace(/\{version\}/gu, version);
};

const regenerateReleaseBranch = async (
  relluConfig: RelluConfig,
  baseBranch: string,
  branch: string,
  releaseBranchPrefix: string,
  target: TargetResult,
) => {
  const { inputs } = relluConfig;

  // safety check to prevent force-pushing to protected branches or other unintended targets
  safety.check({ branch, branchPrefix: releaseBranchPrefix, targetLabel: target.label });

  // create or update the release branch
  await git.branch.prepare(baseBranch, branch, { shouldSetUser: true });

  // update version in the manifest file
  await manifests.write(
    target.versionSource.file,
    target.versionSource.type,
    target.nextVersion,
    {
      targetLabel: target.label,
    },
  );

  await git.add(target.versionSource.file);
  const wasModified = await git.isFileModified(target.versionSource.file);

  if (!wasModified) {
    log.info(
      `No version file changes for ${target.label}; branch regeneration skipped commit.`,
    );
    return;
  }

  // commit the version update
  const commitMessage = makeCommitMessage(
    inputs.releaseCommitMessagePattern,
    target.label,
    target.nextVersion,
  );

  await git.commit(commitMessage, { verify: false });
  await git.push('origin', branch, { force: true });

  log.info(
    `Regenerated release branch ${branch} with version update commit and pushed to origin.`,
  );
};

const createOrUpdateReleasePr = async (
  target: TargetResult,
  settings: TargetReleaseSettings,
  relluConfig: RelluConfig,
): Promise<ReleasePrInfo> => {
  const { inputs } = relluConfig;
  const gh = getGh(inputs);

  const repo = gh.repo.parseIdentifier(inputs.repo);
  if (!repo) {
    throw new Error(
      `Invalid repository slug "${inputs.repo}". Expected format "owner/name" with exactly two non-empty segments.`,
    );
  }

  const branch = getReleaseBranchName(settings.releaseBranchPrefix, target.label);
  const sanitizedChangelogMarkdown = target.changelog.markdown;
  const body = sanitizedChangelogMarkdown || '_No changelog entries._';
  const title = makeCommitMessage(
    inputs.releaseCommitMessagePattern,
    target.label,
    target.nextVersion,
  );

  // create or update the release branch with the version update commit
  await regenerateReleaseBranch(
    relluConfig,
    settings.baseBranch,
    branch,
    settings.releaseBranchPrefix,
    target,
  );

  const existing = await findOpenReleasePr(
    repo,
    branch,
    settings.baseBranch,
    makeCommitMessage(inputs.releaseCommitMessagePattern, target.label, target.currentVersion),
    gh,
  );

  // if the PR already exists, update its title and body in case the version or changelog has
  // changed; otherwise create a new PR

  if (existing) {
    const updated = await gh.pr.update(repo, existing.number, {
      title,
      body,
    });

    log.info(`Updated existing release PR #${existing.number} for target ${target.label}.`);
    return {
      enabled: true,
      action: 'updated',
      branch,
      title,
      number: updated.number,
      url: updated.htmlUrl,
    };
  }

  const created = await gh.pr.create(repo, {
    title,
    head: branch,
    base: settings.baseBranch,
    body,
  });

  log.info(`Created new release PR #${created.number} for target ${target.label}.`);
  return {
    enabled: true,
    action: 'created',
    branch,
    title,
    number: created.number,
    url: created.htmlUrl,
  };
};

const getTargetReleaseSettings = (
  relluConfig: RelluConfig,
  targetLabel: string,
): TargetReleaseSettings => {
  const { config, inputs } = relluConfig;

  const targetSettings = config.targets?.find(
    (target) => target.label === targetLabel,
  )?.releasePr;

  return {
    enabled: targetSettings?.enabled ?? true,
    releaseBranchPrefix: targetSettings?.branchPrefix ?? inputs.releaseBranchPrefix,
    baseBranch: targetSettings?.baseBranch ?? inputs.baseBranch,
  };
};

export const maybeManageReleasePr = async (
  relluConfig: RelluConfig,
  target: TargetResult,
): Promise<TargetResult> => {
  const settings = getTargetReleaseSettings(relluConfig, target.label);

  if (!settings.enabled) {
    log.info(`Skipping release PR for ${target.label}: target releasePr.enabled=false.`);
    return { ...target, releasePr: { enabled: false, action: 'none' } };
  }

  const isReleasable = target.changed && target.nextVersion !== target.currentVersion;

  if (!isReleasable || target.skipRelease) {
    if (target.changed) {
      log.warn(
        `Skipping release PR for ${target.label}: non-releasable target under current policy.`,
      );
    }
    return { ...target, releasePr: { enabled: !target.skipRelease, action: 'none' } };
  }

  log.info(
    `Managing release PR for ${target.label} on branch ${getReleaseBranchName(settings.releaseBranchPrefix, target.label)}`,
  );

  try {
    const releasePr = await createOrUpdateReleasePr(target, settings, relluConfig);
    return { ...target, releasePr };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(
        `Failed managing release PR for target "${target.label}": ${error.message}`,
        {
        cause: error,
        },
      );
    }

    throw new Error(
      `Failed managing release PR for target "${target.label}": ${String(error)}`,
    );
  }
};
