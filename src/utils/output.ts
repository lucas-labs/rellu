import type { AnalysisResultEnvelope, TargetResult } from '@/action/types';
import * as core from '@actions/core';

export const buildActionOutputs = (analysis: AnalysisResultEnvelope) => {
  const { results } = analysis;

  return {
    countProcessed: results.length,
    prUpdated: results.reduce(
      (count, outcome) => count + (outcome.releasePr?.action === 'updated' ? 1 : 0),
      0,
    ),
    prCreated: results.reduce(
      (count, outcome) => count + (outcome.releasePr?.action === 'created' ? 1 : 0),
      0,
    ),
    changedTargets: JSON.stringify(results.filter((r) => r.changed).map((r) => r.label)),
    hasChanges: results.some((r) => r.changed),
    resultJson: JSON.stringify(analysis),
  };
};

export const setOutputs = (analysis: AnalysisResultEnvelope) => {
  const { results } = analysis;
  const outputs = buildActionOutputs(analysis);

  core.setOutput('count-processed', outputs.countProcessed);
  core.setOutput('pr-updated', outputs.prUpdated);
  core.setOutput('pr-created', outputs.prCreated);
  core.setOutput('changed-targets', outputs.changedTargets);
  core.setOutput('has-changes', outputs.hasChanges);
  core.setOutput('result-json', outputs.resultJson);

  results.forEach((outcome) => {
    const prefix = `${outcome.label}`;

    core.setOutput(`${prefix}-label`, outcome.label);
    core.setOutput(`${prefix}-changed`, outcome.changed);
    core.setOutput(`${prefix}-matched-files`, JSON.stringify(outcome.matchedFiles));
    core.setOutput(`${prefix}-commit-count`, outcome.commitCount);
    core.setOutput(`${prefix}-current-version`, outcome.currentVersion);
    core.setOutput(`${prefix}-next-version`, outcome.nextVersion);
    core.setOutput(`${prefix}-bump`, outcome.bump);
    core.setOutput(
      `${prefix}-commits`,
      JSON.stringify(outcome.commits.map((commit) => commit.sha)),
    );
    core.setOutput(`${prefix}-changelog`, outcome.changelog.markdown);
    core.setOutput(`${prefix}-version-source-file`, outcome.versionSource.file);
    core.setOutput(`${prefix}-skip-release`, outcome.skipRelease);

    if (outcome.releasePr) {
      core.setOutput(`${prefix}-pr-enabled`, outcome.releasePr.enabled);
      core.setOutput(`${prefix}-pr-action`, outcome.releasePr.action);
      core.setOutput(`${prefix}-pr-branch`, outcome.releasePr.branch || '');
      core.setOutput(`${prefix}-pr-title`, outcome.releasePr.title || '');
      core.setOutput(`${prefix}-pr-number`, String(outcome.releasePr.number) || '');
      core.setOutput(`${prefix}-pr-url`, outcome.releasePr.url || '');
    }
  });
};

export const summary = (results: TargetResult[]) => {
  const overviewTable = `| Target | Changed | Commits | Current Version | Next Version | PR Action |
| --- | --- | --- | --- | --- | --- |
${results
  .map(
    (outcome) =>
      `| ${outcome.label} | ${outcome.changed ? 'Yes' : 'No'} | ${outcome.commitCount} | ${outcome.currentVersion} | ${outcome.nextVersion} | ${
        outcome.releasePr?.action || 'N/A'
      } |`,
  )
  .join('\n')}
`;

  const pullRequestsTables = `
${results
  .map(
    (outcome) => `${
      outcome.releasePr
        ? `| Enabled | Action | Branch | Title | Number | URL |
| --- | --- | --- | --- | --- | --- |
| ${outcome.releasePr.enabled ? 'Yes' : 'No'} | ${outcome.releasePr.action} | ${outcome.releasePr.branch || 'N/A'} | ${outcome.releasePr.title || 'N/A'} | ${outcome.releasePr.number ?? 'N/A'} | ${outcome.releasePr.url || 'N/A'} |
`
        : 'No pull request information available.'
    }
`,
  )
  .join('\n')}`;

  const body = `## Rellu Release Summary

Rellu was executed with the following outcomes:

${overviewTable}

### Pull Request Details

${pullRequestsTables}
`;

  core.summary.addRaw(body, true).write();
};
