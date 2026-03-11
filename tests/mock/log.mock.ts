import { mock } from 'bun:test';

export const getMockedLogger = () => {
  const log = {
    info: mock((_message: string, ..._args: any[]) => {}),
    warn: mock((_message: string, ..._args: any[]) => {}),
    err: mock((_message: string, ..._args: any[]) => {}),
    dbg: mock((_message: string, ..._args: any[]) => {}),
  };
  return log;
};

export const mockLogger = async (mocked?: ReturnType<typeof getMockedLogger>) => {
  await mock.module('../../src/utils/logger', () => ({
    log: mocked || getMockedLogger(),
  }));
};
