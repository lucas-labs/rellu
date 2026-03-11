const RESERVED_BRANCH_NAMES = new Set([
  'main',
  'master',
  'develop',
  'development',
  'dev',
  'trunk',
  'production',
  'prod',
  'staging',
  'stage',
]);

const INVALID_REF_PATTERN = /[\s~^:?*[\\]/u;
const SAFE_SEGMENT_PATTERN = /^[A-Za-z0-9._-]+$/u;

const throwErr = (branch: string, targetLabel: string, reason: string): never => {
  throw new Error(
    `Security validation failed for release branch "${branch}" (target "${targetLabel}"): ${reason}. ` +
      `Use an automation-owned release namespace prefix such as "rellu/release".`,
  );
};

const normalizePrefix = (prefix: string): string => {
  return prefix.trim().replace(/\/+$/u, '');
};

const hasReleaseNamespace = (prefix: string): boolean => {
  return prefix
    .split('/')
    .map((segment) => segment.toLowerCase())
    .some((segment) => segment.startsWith('release'));
};

const check = (options: {
  branch: string;
  branchPrefix: string;
  targetLabel: string;
}): void => {
  const { branch, branchPrefix, targetLabel } = options;
  const normalizedPrefix = normalizePrefix(branchPrefix);

  if (!branch.trim()) {
    throwErr(branch, targetLabel, 'resolved branch is empty');
  }

  if (!targetLabel.trim()) {
    throwErr(branch, targetLabel, 'target label is empty');
  }

  if (!normalizedPrefix) {
    throwErr(branch, targetLabel, 'release branch prefix is empty');
  }

  const expectedBranch = `${normalizedPrefix}/${targetLabel}`;
  if (branch !== expectedBranch) {
    throwErr(
      branch,
      targetLabel,
      `resolved branch does not match expected "${expectedBranch}" from configured prefix and target label`,
    );
  }

  if (!normalizedPrefix.includes('/')) {
    throwErr(
      branch,
      targetLabel,
      'prefix must include a namespace segment (for example "rellu/release")',
    );
  }

  if (!hasReleaseNamespace(normalizedPrefix)) {
    throwErr(branch, targetLabel, 'prefix must include a release namespace segment');
  }

  if (branch.startsWith('refs/')) {
    throwErr(branch, targetLabel, 'branch must not include refs/* prefixes');
  }

  if (branch.includes('//')) {
    throwErr(branch, targetLabel, 'branch must not contain empty path segments');
  }

  if (branch.includes('..') || branch.includes('@{')) {
    throwErr(branch, targetLabel, 'branch contains prohibited git ref sequences');
  }

  if (INVALID_REF_PATTERN.test(branch)) {
    throwErr(branch, targetLabel, 'branch contains invalid git ref characters');
  }

  const segments = branch.split('/');
  for (const segment of segments) {
    if (!segment || segment === '.' || segment === '..') {
      throwErr(branch, targetLabel, 'branch contains invalid path segments');
    }
    if (segment.endsWith('.lock')) {
      throwErr(branch, targetLabel, 'branch segments cannot end with .lock');
    }
    if (!SAFE_SEGMENT_PATTERN.test(segment)) {
      throwErr(branch, targetLabel, 'branch contains unsupported characters');
    }
  }

  if (targetLabel.includes('/')) {
    throwErr(
      branch,
      targetLabel,
      'target label must map to a single branch segment (no slashes)',
    );
  }

  if (RESERVED_BRANCH_NAMES.has(branch.toLowerCase())) {
    throwErr(branch, targetLabel, 'branch resolves to a protected or default branch name');
  }
};

const safety = { check };
export default safety;
