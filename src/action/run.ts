import { log } from '@/utils/logger';
import configuration from './config';
import { maybeManageReleasePr } from './release';
import analyze from './target/analysis';
import type { TargetResult } from './types';

/** main entry point for the action */
export const run = async (): Promise<void> => {
  const config = configuration.load();
  log.info('Loaded configuration:', config);

  const analysis = await analyze(config);
  log.info(`Analysis complete. Range=${analysis.range} commits=${analysis.commitCount}`);

  // if configured to do so, try to create or update release PRs for targets with changes.
  // note: `maybeManageReleasePr` will internally check if a PR can and needs to be
  // created/updated for each target.
  const prOutcomes: TargetResult[] = [];
  let anyCreatedOrUpdated = false;

  if (config.inputs.createReleasePr) {
    for (const target of analysis.results) {
      try {
        const result = await maybeManageReleasePr(config, target);
        anyCreatedOrUpdated = anyCreatedOrUpdated || result.releasePr?.enabled === true;
        prOutcomes.push(result);
      } catch (error) {
        log.err(`Failed to manage release PR for target ${target.label}:`, error);
      }
    }
  }

  // const changedTargets = prOutcomes
  //   .filter((result) => result.changed)
  //   .map((result) => result.label);

  // const resultEnvelope: ResultJsonEnvelope = {
  //   range: analysis.range,
  //   commitCount: analysis.commitCount,
  //   results,
  // };
  // const resultJson = JSON.stringify(resultEnvelope, null, 2);
  // writeActionOutputs({
  //   changedTargets,
  //   hasChanges: changedTargets.length > 0,
  //   resultJson,
  //   releasePrsCreated: releaseOutcome.anyCreatedOrUpdated,
  // });

  // core.info(
  //   `🎉 Changed targets: ${changedTargets.length > 0 ? changedTargets.join(', ') : '(none)'}`,
  // );
};
