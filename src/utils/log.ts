import type { Logger } from "../types.js";

export const defaultLogger: Logger = {
  info(message: string) {
    console.log(message);
  },
  warn(message: string) {
    console.warn(message);
  },
  error(message: string) {
    console.error(message);
  }
};
