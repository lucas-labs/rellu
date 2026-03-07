/**
 * @typedef {{
 *   info: (message: string) => void;
 *   warn: (message: string) => void;
 *   error: (message: string) => void;
 * }} Logger
 */

/** @type {Logger} */
export const defaultLogger = {
  info(message) {
    console.log(message);
  },
  warn(message) {
    console.warn(message);
  },
  error(message) {
    console.error(message);
  }
};
