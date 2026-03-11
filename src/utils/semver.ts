interface ParsedSemver {
  major: number;
  minor: number;
  patch: number;
  prerelease?:
    | {
        tag: string;
        num: number;
      }
    | undefined;
}

export const parse = (version: string): ParsedSemver => {
  const match = version.trim().match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/u);

  if (!match) {
    throw new Error(`Invalid semantic version "${version}"`);
  }

  let prerelease: ParsedSemver['prerelease'];

  if (match[4]) {
    const parts = match[4].split('.');
    const last = parts.at(-1);

    if (!last || !/^\d+$/u.test(last) || parts.length < 2) {
      throw new Error(`Invalid prerelease "${match[4]}". Expected format like "alpha.0"`);
    }

    prerelease = {
      tag: parts.slice(0, -1).join('.'),
      num: Number(last),
    };
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease,
  };
};

function format(version: ParsedSemver): string {
  const base = `${version.major}.${version.minor}.${version.patch}`;
  if (!version.prerelease) {
    return base;
  }
  return `${base}-${version.prerelease.tag}.${version.prerelease.num}`;
}

const bumpStable = (parsed: ParsedSemver, bump: 'major' | 'minor' | 'patch'): ParsedSemver => {
  switch (bump) {
    case 'major':
      return { major: parsed.major + 1, minor: 0, patch: 0 };
    case 'minor':
      return { major: parsed.major, minor: parsed.minor + 1, patch: 0 };
    case 'patch':
      return { major: parsed.major, minor: parsed.minor, patch: parsed.patch + 1 };
  }
};

export const next = (
  currentVersion: string | ParsedSemver,
  bump: 'major' | 'minor' | 'patch' | 'none' | 'pre' | 'release',
  prereleaseTag?: string,
): string => {
  if (typeof currentVersion !== 'string') {
    return format(currentVersion);
  }
  const parsed = parse(currentVersion);

  switch (bump) {
    case 'none':
      return currentVersion.trim();

    case 'pre': {
      if (!parsed.prerelease) {
        throw new Error(`Cannot increment prerelease for stable version "${currentVersion}"`);
      }

      if (!prereleaseTag || prereleaseTag === parsed.prerelease.tag) {
        return format({
          ...parsed,
          prerelease: {
            tag: parsed.prerelease.tag,
            num: parsed.prerelease.num + 1,
          },
        });
      }

      return format({
        ...parsed,
        prerelease: {
          tag: prereleaseTag,
          num: 0,
        },
      });
    }

    case 'major':
    case 'minor':
    case 'patch': {
      const bumped = bumpStable(parsed, bump);

      if (!prereleaseTag) {
        return format(bumped);
      }

      return format({
        ...bumped,
        prerelease: {
          tag: prereleaseTag,
          num: 0,
        },
      });
    }

    case 'release': {
      if (!parsed.prerelease) {
        throw new Error(
          `Cannot release stable version "${currentVersion}" because it is not a prerelease`,
        );
      }
      return `${parsed.major}.${parsed.minor}.${parsed.patch}`;
    }

    default: {
      const exhaustiveCheck = bump;
      throw new Error(`Unsupported bump level "${String(exhaustiveCheck)}"`);
    }
  }
};

const semver = { parse, next, format };
export default semver;
