import * as core from "@actions/core";
import type { CoreClient } from "../types.js";

export const coreClient: CoreClient = {
  getInput(name: string): string {
    return core.getInput(name, { required: false, trimWhitespace: true }).trim();
  },
  setOutput(name: string, value: string): void {
    core.setOutput(name, value);
  },
  info(message: string): void {
    core.info(message);
  },
  warn(message: string): void {
    core.warning(message);
  },
  error(message: string): void {
    core.error(message);
  },
  setFailed(message: string): void {
    core.setFailed(message);
  }
};
