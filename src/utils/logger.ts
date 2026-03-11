import * as core from '@actions/core';

export interface Logger {
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  err(message: string, ...args: any[]): void;
  dbg(message: string, ...args: any[]): void;
}

/** converts all arguments to a single string message */
const getMessage = (message: string, ...args: any[]) => {
  if (args.length === 0) {
    return message;
  }
  const argsString = args
    .map((arg) => {
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg, null, 2);
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    })
    .join(' ');
  return `${message} ${argsString}`;
};

export const log: Logger = {
  info(message: string, ...args: any[]) {
    core.info(getMessage(message, ...args));
  },
  warn(message: string, ...args: any[]) {
    core.warning(getMessage(message, ...args));
  },
  err(message: string, ...args: any[]) {
    core.error(getMessage(message, ...args));
  },
  dbg(message: string, ...args: any[]) {
    core.debug(getMessage(message, ...args));
  },
};
