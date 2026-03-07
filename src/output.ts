import fs from "node:fs";

interface ActionOutputPayload {
  changedTargets: string[];
  hasChanges: boolean;
  resultJson: string;
  releasePrsCreated: boolean;
}

export function setOutput(name: string, value: string): void {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (!outputFile) {
    console.log(`::set-output name=${name}::${value}`);
    return;
  }

  const block = `${name}<<__RELLU_EOF__\n${value}\n__RELLU_EOF__\n`;
  fs.appendFileSync(outputFile, block, "utf8");
}

export function writeActionOutputs(payload: ActionOutputPayload): void {
  setOutput("changed-targets", JSON.stringify(payload.changedTargets));
  setOutput("has-changes", String(payload.hasChanges));
  setOutput("result-json", payload.resultJson);
  setOutput("release-prs-created", String(payload.releasePrsCreated));
}
