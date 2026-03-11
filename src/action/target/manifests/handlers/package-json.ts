import type { ManifestVersioningHandler } from './types';

interface JsonRecord {
  [key: string]: unknown;
}

function parsePackageJson(text: string): JsonRecord {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(`Invalid JSON pakage.json: ${String(error)}`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Expected JSON object in package.json`);
  }
  return parsed as JsonRecord;
}

const read = async (text: string): Promise<string> => {
  const parsed = parsePackageJson(text);
  const version = String(parsed.version ?? '').trim();
  if (!version) {
    throw new Error(`Target manifest "${text}" missing package.json version field`);
  }
  return version;
};

const update = async (text: string, nextVersion: string): Promise<string> => {
  const versionPattern = /^(\s*"version"\s*:\s*")([^"]+)(")/m;
  if (!versionPattern.test(text)) {
    throw new Error(`Target manifest missing package.json version field`);
  }
  const updated = text.replace(versionPattern, `$1${nextVersion}$3`);
  return updated;
};

const packageJsonHandler: ManifestVersioningHandler = { read, update };
export default packageJsonHandler;
