import { mock } from 'bun:test';

export const mockIo = async () => {
  await mock.module('../../src/utils/io.ts', () => ({
    default: {
      ensureParentDir: mock(async (_filePath: string) => {}),
    },
  }));
};
