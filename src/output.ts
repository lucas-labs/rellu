import { coreClient } from "./toolkit/core-client.js";

interface ActionOutputPayload {
  changedTargets: string[];
  hasChanges: boolean;
  resultJson: string;
  releasePrsCreated: boolean;
}

export function setOutput(name: string, value: string): void {
  coreClient.setOutput(name, value);
}

export function writeActionOutputs(payload: ActionOutputPayload): void {
  setOutput("changed-targets", JSON.stringify(payload.changedTargets));
  setOutput("has-changes", String(payload.hasChanges));
  setOutput("result-json", payload.resultJson);
  setOutput("release-prs-created", String(payload.releasePrsCreated));
}
