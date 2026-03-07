## MODIFIED Requirements

### Requirement: Action outputs SHALL expose top-level release analysis state
The action SHALL emit `changed-targets`, `has-changes`, and `result-json` outputs for every run, and SHALL emit `release-prs-created` when release PR mode is enabled. `result-json` SHALL contain analysis-level metadata (`range`, `commitCount`) and target results.

#### Scenario: Outputs are produced for changed targets
- **WHEN** two targets are detected as changed
- **THEN** `changed-targets` contains both labels, `has-changes` is `true`, and `result-json` contains analysis-level metadata plus both target result objects

#### Scenario: Outputs include analysis range context
- **WHEN** analysis runs over a resolved git range
- **THEN** `result-json` includes that resolved `range` value and total analyzed `commitCount`

### Requirement: Result JSON SHALL include complete per-target analysis fields
`result-json` MUST be a JSON object containing `range`, top-level `commitCount`, and `results` (array of target objects). Each target object in `results` MUST include label, changed state, matched files, bump outcome, current and next versions, relevant commits, rendered changelog markdown, and release PR metadata when applicable.

#### Scenario: Target JSON contains required analysis fields
- **WHEN** a target has releasable changes
- **THEN** its object inside `results` includes `label`, `changed`, `matchedFiles`, `bump`, `currentVersion`, `nextVersion`, `commits`, and `changelog.markdown`

#### Scenario: Analysis envelope keys are present
- **WHEN** the action emits `result-json`
- **THEN** the JSON object includes `range`, `commitCount`, and `results`
