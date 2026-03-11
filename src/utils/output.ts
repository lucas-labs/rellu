import type { TargetResult } from '@/action/types';
import { setOutput, summary as actionSummary } from '@actions/core';

export const setOutputs = (prOutcomes: TargetResult[]) => {
  setOutput('count_processed', prOutcomes.length);
  setOutput(
    'pr_updated',
    prOutcomes.reduce(
      (count, outcome) => count + (outcome.releasePr?.action === 'updated' ? 1 : 0),
      0,
    ),
  );
  setOutput(
    'pr_created',
    prOutcomes.reduce(
      (count, outcome) => count + (outcome.releasePr?.action === 'created' ? 1 : 0),
      0,
    ),
  );

  prOutcomes.forEach((outcome, index) => {
    const prefix = `${outcome.label}`;

    setOutput(`${prefix}_label`, outcome.label);
    setOutput(`${prefix}_changed`, outcome.changed);
    setOutput(`${prefix}_matched_files`, JSON.stringify(outcome.matchedFiles));
    setOutput(`${prefix}_commit_count`, outcome.commitCount);
    setOutput(`${prefix}_current_version`, outcome.currentVersion);
    setOutput(`${prefix}_next_version`, outcome.nextVersion);
    setOutput(`${prefix}_bump`, outcome.bump);
    setOutput(
      `${prefix}_commits`,
      JSON.stringify(outcome.commits.map((commit) => commit.sha)),
    );
    setOutput(`${prefix}_changelog`, outcome.changelog.markdown);
    setOutput(`${prefix}_version_source_file`, outcome.versionSource.file);
    setOutput(`${prefix}_skip_release`, outcome.skipRelease);

    if (outcome.releasePr) {
      setOutput(`${prefix}_pr_enabled`, outcome.releasePr.enabled);
      setOutput(`${prefix}_pr_action`, outcome.releasePr.action);
      setOutput(`${prefix}_pr_branch`, outcome.releasePr.branch || '');
      setOutput(`${prefix}_pr_title`, outcome.releasePr.title || '');
      setOutput(`${prefix}_pr_number`, String(outcome.releasePr.number) || '');
      setOutput(`${prefix}_pr_url`, outcome.releasePr.url || '');
    }
  });
};

export const summary = (prOutcomes: TargetResult[]) => {
  const overviewTable = `| Target | Changed | Commits | Current Version | Next Version | PR Action |
| --- | --- | --- | --- | --- | --- |
${prOutcomes
  .map(
    (outcome) =>
      `| ${outcome.label} | ${outcome.changed ? 'Yes' : 'No'} | ${outcome.commitCount} | ${outcome.currentVersion} | ${outcome.nextVersion} | ${
        outcome.releasePr?.action || 'N/A'
      } |`,
  )
  .join('\n')}
`;

  const pullRequestsTables = `
${prOutcomes
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

  actionSummary.addRaw(body, true).write();
};
