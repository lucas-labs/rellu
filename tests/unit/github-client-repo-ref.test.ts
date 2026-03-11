import { expect, mock, test } from 'bun:test';

test('parseRepoIdentifier accepts exact owner/name repository slug', async () => {
  try {
    await mock.module('@actions/github', () => ({
      getOctokit: () => {
        throw new Error('getOctokit should not be called in parseRepoIdentifier tests');
      },
    }));

    const queryKey = 'repo-ref-valid';
    const { parseRepoIdentifier } = await import(
      `../../src/action/github/operations/repo.ts?${queryKey}`
    );
    expect(parseRepoIdentifier('acme/rellu')).toEqual({
      owner: 'acme',
      name: 'rellu',
    });
    expect(parseRepoIdentifier(' acme / rellu ')).toEqual({
      owner: 'acme',
      name: 'rellu',
    });
  } finally {
    mock.restore();
  }
});

test('parseRepoIdentifier rejects malformed repository slugs', async () => {
  try {
    await mock.module('@actions/github', () => ({
      getOctokit: () => {
        throw new Error('getOctokit should not be called in parseRepoIdentifier tests');
      },
    }));

    const queryKey = 'repo-ref-invalid';
    const { parseRepoIdentifier } = await import(
      `../../src/action/github/operations/repo.ts?${queryKey}`
    );
    expect(parseRepoIdentifier('')).toBeNull();
    expect(parseRepoIdentifier('acme')).toBeNull();
    expect(parseRepoIdentifier('/rellu')).toBeNull();
    expect(parseRepoIdentifier('acme/')).toBeNull();
    expect(parseRepoIdentifier('acme/rellu/extra')).toBeNull();
  } finally {
    mock.restore();
  }
});
