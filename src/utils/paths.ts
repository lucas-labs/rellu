export function toPosixPath(value: string): string {
  return value.replace(/\\/g, "/");
}

function escapeRegex(value: string): string {
  return value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}

export function globToRegExp(glob: string): RegExp {
  const normalized = toPosixPath(glob.trim());
  if (!normalized) {
    throw new Error("Glob cannot be empty");
  }

  let pattern = "^";
  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index] ?? "";
    const next = normalized[index + 1];

    if (char === "*" && next === "*") {
      const nextNext = normalized[index + 2];
      if (nextNext === "/") {
        pattern += "(?:.*/)?";
        index += 2;
      } else {
        pattern += ".*";
        index += 1;
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

export function isGlobMatch(filePath: string, glob: string): boolean {
  return globToRegExp(glob).test(toPosixPath(filePath));
}

export function uniqueSortedPosix(files: string[]): string[] {
  return [...new Set(files.map(toPosixPath))].sort();
}
