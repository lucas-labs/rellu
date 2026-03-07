import { loadConfig } from "./config.ts";
import { analyzeRepository } from "./analyze.ts";
import { maybeManageReleasePrs } from "./release-pr.ts";
import { writeActionOutputs } from "./output.ts";
import { defaultLogger } from "./utils/log.ts";

async function run() {
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

run().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
