import fs from "node:fs";

/**
 * @param {string} name
 * @param {string} value
 */
export function setOutput(name, value) {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (!outputFile) {
    console.log(`::set-output name=${name}::${value}`);
    return;
  }
  const block = `${name}<<__RELLU_EOF__\n${value}\n__RELLU_EOF__\n`;
  fs.appendFileSync(outputFile, block, "utf8");
}

/**
 * @param {{
 *   changedTargets: string[];
 *   hasChanges: boolean;
 *   resultJson: string;
 *   releasePrsCreated: boolean;
 * }} payload
 */
export function writeActionOutputs(payload) {
  setOutput("changed-targets", JSON.stringify(payload.changedTargets));
  setOutput("has-changes", String(payload.hasChanges));
  setOutput("result-json", payload.resultJson);
  setOutput("release-prs-created", String(payload.releasePrsCreated));
}
