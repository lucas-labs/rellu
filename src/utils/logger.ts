import * as core from '@actions/core';

export interface Logger {
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  err(message: string, ...args: any[]): void;
  dbg(message: string, ...args: any[]): void;
}

type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

const ERROR_KEYS = new Set(['name', 'message', 'stack', 'cause']);

const formatValue = (value: unknown, seen = new WeakSet<object>()): string => {
  if (value instanceof Error) {
    const lines = [value.stack || `${value.name}: ${value.message}`];
    const extras = Object.fromEntries(
      Object.entries(value).filter(([key]) => !ERROR_KEYS.has(key)),
    );

    if (Object.keys(extras).length > 0) {
      lines.push(JSON.stringify(extras, null, 2));
    }

    if (value.cause !== undefined) {
      lines.push(`Caused by: ${formatValue(value.cause, seen)}`);
    }

    return lines.join('\n');
  }

  if (value && typeof value === 'object') {
    if (seen.has(value)) {
      return '[Circular]';
    }

    seen.add(value);
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    } finally {
      seen.delete(value);
    }
  }

  return String(value);
};

const formatEntry = (level: LogLevel, message: string, ...args: any[]) => {
  const prefix = `[${new Date().toISOString()}] [${level}] `;
  const continuationPrefix = ' '.repeat(prefix.length);
  const content =
    args.length === 0
      ? message
      : `${message} ${args.map((arg) => formatValue(arg)).join(' ')}`;

  return content
    .split('\n')
    .map((line, index) => `${index === 0 ? prefix : continuationPrefix}${line}`)
    .join('\n');
};

export const log: Logger = {
  info(message: string, ...args: any[]) {
    core.info(formatEntry('INFO', message, ...args));
  },
  warn(message: string, ...args: any[]) {
    core.warning(formatEntry('WARN', message, ...args));
  },
  err(message: string, ...args: any[]) {
    core.error(formatEntry('ERROR', message, ...args));
  },
  dbg(message: string, ...args: any[]) {
    core.debug(formatEntry('DEBUG', message, ...args));
  },
};
