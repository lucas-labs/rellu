import picomatch from "picomatch";

export function toPosixPath(value: string): string {
  return value.replace(/\\/g, "/");
}

const globMatcherCache = new Map<string, (input: string) => boolean>();

function normalizeGlob(glob: string): string {
  const normalized = toPosixPath(glob.trim());
  if (!normalized) {
    throw new Error("Glob cannot be empty");
  }
  return normalized;
}

function createGlobMatcher(glob: string): (input: string) => boolean {
  const normalized = normalizeGlob(glob);
  try {
    return picomatch(normalized, {
      dot: true,
      posixSlashes: true,
      strictBrackets: true
    });
  } catch (error) {
    throw new Error(`Invalid glob syntax "${normalized}": ${error instanceof Error ? error.message : String(error)}`);
  }
}

function getGlobMatcher(glob: string): (input: string) => boolean {
  const normalized = normalizeGlob(glob);
  const cached = globMatcherCache.get(normalized);
  if (cached) {
    return cached;
  }

  const matcher = createGlobMatcher(normalized);
  globMatcherCache.set(normalized, matcher);
  return matcher;
}

export function validateGlobPattern(glob: string): void {
  createGlobMatcher(glob);
}

export function isGlobMatch(filePath: string, glob: string): boolean {
  return getGlobMatcher(glob)(toPosixPath(filePath));
}

export function uniqueSortedPosix(files: string[]): string[] {
  return [...new Set(files.map(toPosixPath))].sort();
}
