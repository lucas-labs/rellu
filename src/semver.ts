import type { BumpLevel } from "./types.js";

interface ParsedSemver {
  major: number;
  minor: number;
  patch: number;
}

export function parseSemver(version: string): ParsedSemver {
  const match = version.trim().match(/^(\d+)\.(\d+)\.(\d+)$/u);
  if (!match) {
    throw new Error(`Invalid semantic version "${version}"`);
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3])
  };
}

export function calculateNextVersion(currentVersion: string, bump: BumpLevel): string {
  const parsed = parseSemver(currentVersion);
  switch (bump) {
    case "major":
      return `${parsed.major + 1}.0.0`;
    case "minor":
      return `${parsed.major}.${parsed.minor + 1}.0`;
    case "patch":
      return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}`;
    case "none":
      return `${parsed.major}.${parsed.minor}.${parsed.patch}`;
    default: {
      const exhaustiveCheck: never = bump;
      throw new Error(`Unsupported bump level "${String(exhaustiveCheck)}"`);
    }
  }
}
