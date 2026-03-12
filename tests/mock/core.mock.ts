import { mock } from 'bun:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

type Inputs = Record<string, string>;
const BASE_TARGET = {
  label: 'app-1',
  paths: ['apps/app1/**/*'],
  version: {
    file: 'apps/app1/package.json',
    type: 'node-package-json',
  },
} as const;

export async function writeConfigFile(
  config: Record<string, unknown>,
): Promise<{ configPath: string; cleanup: () => Promise<void> }> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rellu-config-changelog-'));
  const configPath = path.join(tempDir, 'config.json');
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');

  return {
    configPath,
    cleanup: async () => {
      await fs.rm(tempDir, { recursive: true, force: true });
    },
  };
}

export async function mockCore(inputs: Inputs, configOverrides: Record<string, unknown> = {}) {
  const { configPath, cleanup } = await writeConfigFile({
    targets: [BASE_TARGET],
    ...configOverrides,
  });

  await mock.module('@actions/core', () => ({
    getInput: (name: string) => {
      const i: Inputs = {
        'config-file': configPath || 'config.json',
        repo: 'owner/repo',
        'base-branch': 'main',
        ...inputs,
      };
      return i[name] ?? '';
    },
  }));

  return cleanup;
}

export async function loadConfig({
  inputs = {},
  config = {},
  queryKey,
}: {
  inputs?: Inputs;
  config?: any;
  queryKey: string;
}) {
  const cleanup = await mockCore(inputs, config);
  try {
    const configuration = (await import(`../../src/action/config/index.ts?${queryKey}`))
      .default;
    return configuration.load();
  } finally {
    mock.restore();
    await cleanup();
  }
}
