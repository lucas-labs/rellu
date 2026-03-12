import { expect, mock, test } from 'bun:test';
import { loadConfig } from 'tests/mock/core.mock';

test('loadConfig maps the documented create-release-pr input and latest-tag default', async () => {
  try {
    const config = await loadConfig({
      queryKey: 'action-contract-inputs',
      inputs: {
        'create-release-pr': 'true',
      },
    });

    expect(config.inputs.createReleasePr).toBe(true);
    expect(config.inputs.rangeStrategy).toBe('latest-tag');
    expect(config.inputs.toRef).toBe('HEAD');
    expect(config.config.targets[0]?.releasePr).toBeUndefined();
  } finally {
    mock.restore();
  }
});

test('run emits the documented action outputs', async () => {
  const { buildActionOutputs } = await import('../../src/utils/output.ts');

  const baseResult = {
    label: 'app-1',
    changed: true,
    matchedFiles: ['apps/app1/src/index.ts'],
    commitCount: 2,
    currentVersion: '1.2.3',
    nextVersion: '1.2.4',
    bump: 'patch' as const,
    commits: [],
    changelog: {
      markdown: '## Bug Fixes\n- fix issue',
    },
    versionSource: {
      file: 'apps/app1/package.json',
      type: 'node-package-json' as const,
    },
    skipRelease: false,
  };

  const outputs = buildActionOutputs({
    range: 'abc123..def456',
    commitCount: 2,
    results: [
      {
        ...baseResult,
        releasePr: {
          enabled: true,
          action: 'updated' as const,
          branch: 'rellu/release/app-1',
          title: 'release(app-1): 🔖 v1.2.4',
          number: 123,
          url: 'https://github.com/lucas-labs/rellu/pull/123',
        },
      },
    ],
  });

  expect(outputs.countProcessed).toBe(1);
  expect(outputs.prUpdated).toBe(1);
  expect(outputs.prCreated).toBe(0);
  expect(outputs.changedTargets).toBe('["app-1"]');
  expect(outputs.hasChanges).toBe(true);

  const parsed = JSON.parse(outputs.resultJson);
  expect(parsed).toEqual({
    range: 'abc123..def456',
    commitCount: 2,
    results: [
      {
        ...baseResult,
        releasePr: {
          enabled: true,
          action: 'updated',
          branch: 'rellu/release/app-1',
          title: 'release(app-1): 🔖 v1.2.4',
          number: 123,
          url: 'https://github.com/lucas-labs/rellu/pull/123',
        },
      },
    ],
  });
});
