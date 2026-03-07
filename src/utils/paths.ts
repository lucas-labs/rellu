/**
 * @param {string} value
 * @returns {string}
 */
export function toPosixPath(value) {
  return value.replace(/\\/g, "/");
}

/**
 * @param {string} value
 * @returns {string}
 */
function escapeRegex(value) {
  return value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}

/**
 * Converts a glob with *, **, ? into a path regex.
 * @param {string} glob
 * @returns {RegExp}
 */
export function globToRegExp(glob) {
  const normalized = toPosixPath(glob.trim());
  if (!normalized) {
    throw new Error("Glob cannot be empty");
  }

  let pattern = "^";
  for (let i = 0; i < normalized.length; i += 1) {
    const char = normalized[i];
    const next = normalized[i + 1];

    if (char === "*" && next === "*") {
      const nextNext = normalized[i + 2];
      if (nextNext === "/") {
        pattern += "(?:.*/)?";
        i += 2;
      } else {
        pattern += ".*";
        i += 1;
      }
      continue;
    }

    if (char === "*") {
      pattern += "[^/]*";
      continue;
    }

    if (char === "?") {
      pattern += "[^/]";
      continue;
    }

    pattern += escapeRegex(char);
  }
  pattern += "$";
  return new RegExp(pattern);
}

/**
 * @param {string} filePath
 * @param {string} glob
 * @returns {boolean}
 */
export function isGlobMatch(filePath, glob) {
  const normalizedFile = toPosixPath(filePath);
  return globToRegExp(glob).test(normalizedFile);
}

/**
 * @param {string[]} files
 * @returns {string[]}
 */
export function uniqueSortedPosix(files) {
  return [...new Set(files.map(toPosixPath))].sort();
}
