import type { Logger } from "../types.js";
import { coreClient } from "../toolkit/core-client.js";

export const defaultLogger: Logger = {
  info(message: string) {
    coreClient.info(message);
  },
  warn(message: string) {
    coreClient.warn(message);
  },
  error(message: string) {
    coreClient.error(message);
  }
};
