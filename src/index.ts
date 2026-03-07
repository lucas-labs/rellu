import { analyzeRepository } from "./analyze.js";
import { loadConfig } from "./config.js";
import { writeActionOutputs } from "./output.js";
import { maybeManageReleasePrs } from "./release-pr.js";
import { coreClient } from "./toolkit/core-client.js";
import { defaultLogger } from "./utils/log.js";

async function run(): Promise<void> {
  const config = loadConfig();
  defaultLogger.info(`Loaded ${config.targets.length} configured targets.`);

  const analysis = await analyzeRepository(config, defaultLogger);
  defaultLogger.info(`Analysis complete. Range=${analysis.range} commits=${analysis.commitCount}`);

  const releaseOutcome = await maybeManageReleasePrs(config, analysis.results, defaultLogger);
  const results = releaseOutcome.updatedResults;

  const changedTargets = results.filter((result) => result.changed).map((result) => result.label);
  const resultJson = JSON.stringify(results, null, 2);
  writeActionOutputs({
    changedTargets,
    hasChanges: changedTargets.length > 0,
    resultJson,
    releasePrsCreated: releaseOutcome.anyCreatedOrUpdated
  });

  defaultLogger.info(`Changed targets: ${changedTargets.length > 0 ? changedTargets.join(", ") : "(none)"}`);
}

run().catch((error: unknown) => {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  coreClient.setFailed(message);
});
