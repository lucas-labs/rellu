import { mock } from 'bun:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

type Inputs = Record<string, string>;
type CoreMockState = {
  inputs: Inputs;
  getInput: ReturnType<typeof mock>;
  setOutput: ReturnType<typeof mock>;
  setFailed: ReturnType<typeof mock>;
  info: ReturnType<typeof mock>;
  warning: ReturnType<typeof mock>;
  error: ReturnType<typeof mock>;
  debug: ReturnType<typeof mock>;
  summaryAddRaw: ReturnType<typeof mock>;
  summaryWrite: ReturnType<typeof mock>;
};

const BASE_TARGET = {
  label: 'app-1',
  paths: ['apps/app1/**/*'],
  version: {
    file: 'apps/app1/package.json',
    type: 'node-package-json',
  },
} as const;

const coreState = {} as CoreMockState;

export const resetCoreMock = (inputs: Inputs = {}) => {
  coreState.inputs = inputs;
  coreState.getInput = mock((name: string) => coreState.inputs[name] ?? '');
  coreState.setOutput = mock((_name: string, _value: unknown) => {});
  coreState.setFailed = mock((_message: unknown) => {});
  coreState.info = mock((_message: string, ..._args: any[]) => {});
  coreState.warning = mock((_message: string, ..._args: any[]) => {});
  coreState.error = mock((_message: string, ..._args: any[]) => {});
  coreState.debug = mock((_message: string, ..._args: any[]) => {});
  coreState.summaryWrite = mock(() => Promise.resolve());
  coreState.summaryAddRaw = mock((_body: string, _overwrite?: boolean) => ({
    write: coreState.summaryWrite,
  }));

  return coreState;
};

resetCoreMock();

const coreModule = {
  getInput: (name: string) => coreState.getInput(name),
  setOutput: (name: string, value: unknown) => coreState.setOutput(name, value),
  setFailed: (message: unknown) => coreState.setFailed(message),
  info: (message: string, ...args: any[]) => coreState.info(message, ...args),
  warning: (message: string, ...args: any[]) => coreState.warning(message, ...args),
  error: (message: string, ...args: any[]) => coreState.error(message, ...args),
  debug: (message: string, ...args: any[]) => coreState.debug(message, ...args),
  summary: {
    addRaw: (body: string, overwrite?: boolean) => coreState.summaryAddRaw(body, overwrite),
  },
};

export const installCoreMock = async () => {
  await mock.module('@actions/core', () => coreModule);
  return coreState;
};

export const getCoreMock = () => coreState;

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

  await installCoreMock();
  resetCoreMock({
    'config-file': configPath || 'config.json',
    repo: 'owner/repo',
    'base-branch': 'main',
    ...inputs,
  });

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
