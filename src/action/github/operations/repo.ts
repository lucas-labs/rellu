import type { RepoIdentifier } from '../types';

export function parseRepoIdentifier(repo: string): RepoIdentifier | null {
  const parts = repo.split('/');
  if (parts.length !== 2) {
    return null;
  }

  const [rawOwner = '', rawName = ''] = parts;
  const owner = rawOwner.trim();
  const name = rawName.trim();
  if (!owner || !name) {
    return null;
  }
  return { owner, name };
}
