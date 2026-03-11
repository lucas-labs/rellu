import { expect, test, describe } from 'bun:test';
import { applyNoBumpPolicy } from '../../src/action/target/analysis.ts';
import { next, parse } from '../../src/utils/semver.ts';

describe('next', () => {
  test('applies semantic bump rules for stable releases', () => {
    expect(next('1.2.3', 'major')).toBe('2.0.0');
    expect(next('1.2.3', 'minor')).toBe('1.3.0');
    expect(next('1.2.3', 'patch')).toBe('1.2.4');
    expect(next('1.2.3', 'none')).toBe('1.2.3');
  });

  test('starts prereleases from a stable version when bump includes a tag', () => {
    expect(next('1.2.3', 'major', 'beta')).toBe('2.0.0-beta.0');
    expect(next('1.2.3', 'minor', 'beta')).toBe('1.3.0-beta.0');
    expect(next('1.2.3', 'patch', 'alpha')).toBe('1.2.4-alpha.0');
  });

  test('release finalizes a prerelease into a stable version', () => {
    expect(next('1.3.0-beta.4', 'release')).toBe('1.3.0');
    expect(next('2.0.0-rc.0', 'release')).toBe('2.0.0');
  });

  test('release fails for stable versions', () => {
    expect(() => next('1.3.0', 'release')).toThrow(/not a prerelease/u);
  });

  test('fails when trying to use pre on a stable version', () => {
    expect(() => next('1.2.3', 'pre')).toThrow(
      /Cannot increment prerelease for stable version/u,
    );
    expect(() => next('1.2.3', 'pre', 'beta')).toThrow(
      /Cannot increment prerelease for stable version/u,
    );
  });

  test('increments current prerelease when bump is pre and no tag is passed', () => {
    expect(next('1.3.0-beta.0', 'pre')).toBe('1.3.0-beta.1');
    expect(next('1.3.0-beta.12', 'pre')).toBe('1.3.0-beta.13');
  });

  test('increments current prerelease when bump is pre and same tag is passed', () => {
    expect(next('1.3.0-beta.0', 'pre', 'beta')).toBe('1.3.0-beta.1');
    expect(next('1.3.0-alpha.9', 'pre', 'alpha')).toBe('1.3.0-alpha.10');
  });

  test('switches prerelease channel and resets counter when bump is pre and tag changes', () => {
    expect(next('1.3.0-beta.0', 'pre', 'alpha')).toBe('1.3.0-alpha.0');
    expect(next('1.3.0-alpha.12', 'pre', 'beta')).toBe('1.3.0-beta.0');
    expect(next('2.0.0-rc.7', 'pre', 'gold')).toBe('2.0.0-gold.0');
  });

  test('creates the next release line even when current version is already prerelease', () => {
    expect(next('1.3.0-beta.4', 'major')).toBe('2.0.0');
    expect(next('1.3.0-beta.4', 'minor')).toBe('1.4.0');
    expect(next('1.3.0-beta.4', 'patch')).toBe('1.3.1');

    expect(next('1.3.0-beta.4', 'major', 'alpha')).toBe('2.0.0-alpha.0');
    expect(next('1.3.0-beta.4', 'minor', 'alpha')).toBe('1.4.0-alpha.0');
    expect(next('1.3.0-beta.4', 'patch', 'alpha')).toBe('1.3.1-alpha.0');
  });

  test('none is a strict no-op even for prereleases', () => {
    expect(next('1.3.0-beta.4', 'none')).toBe('1.3.0-beta.4');
  });
});

describe('parse', () => {
  test('parses a stable semver version', () => {
    expect(parse('1.2.3')).toEqual({
      major: 1,
      minor: 2,
      patch: 3,
    });
  });

  test('parses a prerelease semver version', () => {
    expect(parse('1.3.0-beta.12')).toEqual({
      major: 1,
      minor: 3,
      patch: 0,
      prerelease: {
        tag: 'beta',
        num: 12,
      },
    });
  });

  test('parses prerelease tags with dots', () => {
    expect(parse('2.0.0-alpha.preview.3')).toEqual({
      major: 2,
      minor: 0,
      patch: 0,
      prerelease: {
        tag: 'alpha.preview',
        num: 3,
      },
    });
  });

  test('trims surrounding whitespace', () => {
    expect(parse('  1.2.3-rc.4  ')).toEqual({
      major: 1,
      minor: 2,
      patch: 3,
      prerelease: {
        tag: 'rc',
        num: 4,
      },
    });
  });

  test('throws for invalid stable versions', () => {
    expect(() => parse('1.2')).toThrow(/Invalid semantic version/u);
    expect(() => parse('v1.2.3')).toThrow(/Invalid semantic version/u);
    expect(() => parse('1.2.3.4')).toThrow(/Invalid semantic version/u);
  });

  test('throws for invalid prerelease versions', () => {
    expect(() => parse('1.2.3-alpha')).toThrow(/Invalid prerelease/u);
    expect(() => parse('1.2.3-alpha.beta')).toThrow(/Invalid prerelease/u);
    expect(() => parse('1.2.3-alpha.x')).toThrow(/Invalid prerelease/u);
  });
});

test('applyNoBumpPolicy skip marks target non-releasable', () => {
  const outcome = applyNoBumpPolicy({
    changed: true,
    bumpFromCommits: 'none',
    noBumpPolicy: 'skip',
  });
  expect(outcome.bump).toBe('none');
  expect(outcome.skipRelease).toBe(true);
});

test('applyNoBumpPolicy patch forces patch release', () => {
  const outcome = applyNoBumpPolicy({
    changed: true,
    bumpFromCommits: 'none',
    noBumpPolicy: 'patch',
  });
  expect(outcome.bump).toBe('patch');
  expect(outcome.skipRelease).toBe(false);
});
