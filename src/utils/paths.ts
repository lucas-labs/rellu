import picomatch from 'picomatch';
import path, { win32, posix } from 'node:path';

const globMatcherCache = new Map<string, (input: string) => boolean>();

const toPosixPath = (value: string) => {
  return value.replaceAll(win32.sep, posix.sep);
};

const normalizeGlob = (glob: string): string => {
  const normalized = toPosixPath(glob.trim());
  if (!normalized) {
    throw new Error('Glob cannot be empty');
  }
  return normalized;
};

const createGlobMatcher = (glob: string): ((input: string) => boolean) => {
  const normalized = normalizeGlob(glob);
  try {
    return picomatch(normalized, {
      dot: true,
      posixSlashes: true,
      strictBrackets: true,
    });
  } catch (error) {
    throw new Error(
      `Invalid glob syntax "${normalized}": ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

const getGlobMatcher = (glob: string): ((input: string) => boolean) => {
  const normalized = normalizeGlob(glob);
  const cached = globMatcherCache.get(normalized);
  if (cached) {
    return cached;
  }

  const matcher = createGlobMatcher(normalized);
  globMatcherCache.set(normalized, matcher);
  return matcher;
};

const validateGlobPattern = (glob: string): void => {
  createGlobMatcher(glob);
};

const isGlobMatch = (filePath: string, glob: string): boolean => {
  return getGlobMatcher(glob)(toPosixPath(filePath));
};

const uniqueSortedPosix = (files: string[]): string[] => {
  return [...new Set(files.map(toPosixPath))].sort();
};

const glob = {
  /** checks if the given file path matches the provided glob pattern. */
  match: isGlobMatch,
  /** validates the syntax of a glob pattern, throwing an error if it's invalid. */
  validate: validateGlobPattern,
};

export interface WorkspacePathOptions {
  workspaceRoot?: string;
  targetLabel?: string;
}

const resolveManifestPathInWorkspace = (
  filePath: string,
  options: WorkspacePathOptions = {},
): string => {
  const resolveWorkspaceRoot = (workspaceRoot?: string): string => {
    const rawRoot =
      workspaceRoot?.trim() || process.env.GITHUB_WORKSPACE?.trim() || process.cwd();
    return path.resolve(rawRoot);
  };

  const manifestPathValidationError = (
    configuredPath: string,
    targetLabel: string | undefined,
    reason: string,
  ): Error => {
    const targetPrefix = targetLabel ? ` for target "${targetLabel}"` : '';
    return new Error(
      `Manifest path validation failed${targetPrefix} for configured path "${configuredPath}": ${reason}`,
    );
  };

  const configuredPath = String(filePath ?? '');
  if (!configuredPath.trim()) {
    throw manifestPathValidationError(configuredPath, options.targetLabel, 'path is empty');
  }

  const workspaceRoot = resolveWorkspaceRoot(options.workspaceRoot);
  const resolvedPath = path.resolve(workspaceRoot, configuredPath);
  const relative = path.relative(workspaceRoot, resolvedPath);
  const isOutsideWorkspace = relative.startsWith('..') || path.isAbsolute(relative);

  if (isOutsideWorkspace) {
    throw manifestPathValidationError(
      configuredPath,
      options.targetLabel,
      `resolved path "${resolvedPath}" is outside workspace root "${workspaceRoot}"`,
    );
  }

  return resolvedPath;
};

const pathUtils = {
  /** converts a file path to POSIX format (using forward slashes). */
  asPosix: toPosixPath,
  /** takes an array of file paths, converts them to POSIX format, removes duplicates, and returns a sorted array. */
  dedupAndSort: uniqueSortedPosix,
  /** glob matching utilities for file paths, including pattern validation and matching. */
  glob,
  /** utils for manifest paths */
  manifests: {
    resolveInWorkspace: resolveManifestPathInWorkspace,
  },
};

export default pathUtils;
