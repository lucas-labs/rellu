import { expect, mock, test } from 'bun:test';
import { loadConfig } from 'tests/mock/core.mock';

test('loadConfig accepts standard advanced glob syntax in target paths', async () => {
  try {
    const queryKey = 'config-glob-valid';
    const { config } = await loadConfig({
      queryKey,
      config: {
        targets: [
          {
            label: 'app-1',
            paths: ['apps/{web,admin}/src/**', 'packages/lib-[ab]/**'],
            version: {
              file: 'apps/app1/package.json',
              type: 'node-package-json',
            },
            releasePr: { enabled: true },
          },
        ],
      },
    });

    expect(config.targets[0]?.paths).toEqual([
      'apps/{web,admin}/src/**',
      'packages/lib-[ab]/**',
    ]);
  } finally {
    mock.restore();
  }
});

test('loadConfig fails fast on invalid target path glob with target label and pattern', async () => {
  try {
    const queryKey = 'config-glob-invalid';
    const configOverrides = {
      targets: [
        {
          label: 'app-1',
          paths: ['apps/[web/src/**'],
          version: {
            file: 'apps/app1/package.json',
            type: 'node-package-json',
          },
          releasePr: { enabled: true },
        },
      ],
    };

    expect(() =>
      loadConfig({
        queryKey,
        config: configOverrides,
      }),
    ).toThrow(/Invalid glob pattern in target paths/);
  } finally {
    mock.restore();
  }
});
