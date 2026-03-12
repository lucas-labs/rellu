# changelog-and-output-generation Specification

## Purpose
TBD - created by archiving change build-rellu-github-action. Update Purpose after archive.
## Requirements
### Requirement: Action outputs SHALL expose top-level release analysis state
The action SHALL emit `count-processed`, `pr-updated`, `pr-created`, `changed-targets`, `has-changes`, and `result-json` outputs for every run. `result-json` SHALL contain analysis-level metadata (`range`, `commitCount`) and target results.

#### Scenario: Outputs are produced for changed targets
- **WHEN** two targets are detected as changed
- **THEN** `count-processed` reports the number of emitted target results, `changed-targets` contains both labels, `has-changes` is `true`, and `result-json` contains analysis-level metadata plus both target result objects

#### Scenario: Release PR counters reflect processed outcomes
- **WHEN** one processed target creates a release PR and one processed target updates an existing release PR
- **THEN** `pr-created` is `1` and `pr-updated` is `1`

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

### Requirement: Per-target outputs SHALL expose serialized target result details
For each emitted target result, the action MUST emit label-prefixed outputs that mirror target analysis fields and release PR metadata when present.

#### Scenario: Target result fields are emitted as label-prefixed outputs
- **WHEN** the action emits a target result for `app-1`
- **THEN** outputs such as `app-1-label`, `app-1-changed`, `app-1-matched-files`, `app-1-commit-count`, `app-1-current-version`, `app-1-next-version`, `app-1-bump`, `app-1-commits`, `app-1-changelog`, `app-1-version-source-file`, and `app-1-skip-release` are emitted

#### Scenario: Release PR metadata is emitted only when available
- **WHEN** a target result includes release PR metadata
- **THEN** outputs such as `app-1-pr-enabled`, `app-1-pr-action`, `app-1-pr-branch`, `app-1-pr-title`, `app-1-pr-number`, and `app-1-pr-url` are emitted for that target

### Requirement: Changelog rendering SHALL group commits by category
The system SHALL render markdown changelog sections using category mappings based on parsed conventional commit types. Category mapping and section ordering SHALL be user-configurable, and the system SHALL apply a sensible default mapping/order when no custom configuration is provided.

#### Scenario: Commits are grouped into default sections when no mapping is provided
- **WHEN** relevant commits include `feat`, `fix`, and `docs` types and no changelog mapping input is configured
- **THEN** the changelog contains Features, Bug Fixes, and Documentation sections using default mapping

#### Scenario: Commits are grouped into configured sections
- **WHEN** the user configures mapping such that `feat` maps to `Enhancements` and `fix` maps to `Maintenance`
- **THEN** commits of those types are rendered under `Enhancements` and `Maintenance` respectively

#### Scenario: Configured section ordering is honored
- **WHEN** the user configures section order as `Maintenance`, `Enhancements`, `Other`
- **THEN** rendered sections appear in that order before any deterministic fallback sections

#### Scenario: Invalid mapping configuration fails fast
- **WHEN** changelog mapping/order input is malformed (for example non-JSON, empty section names, or duplicate ordered section names)
- **THEN** the action fails with a clear validation error before analysis output is generated

### Requirement: Changelog entries SHALL include contributor display and commit identity
Each changelog entry MUST include the commit description, a contributor display value resolved through ordered fallback (`@githubUsername` from commit association, then email-based username lookup when available, then author name), and commit SHA reference.

#### Scenario: Username is resolved from commit association
- **WHEN** commit metadata includes an associated GitHub login
- **THEN** the changelog entry uses `@<login>` as contributor display

#### Scenario: Username is resolved via author email fallback
- **WHEN** commit association login is missing and author email resolves to a GitHub user via API
- **THEN** the changelog entry uses `@<resolved-login>` as contributor display

#### Scenario: Username cannot be resolved from association or email
- **WHEN** no GitHub username can be resolved from commit association or email
- **THEN** the changelog entry uses author name as contributor display instead of `@username`

### Requirement: Output generation SHALL be deterministic for identical inputs
For identical refs, config, and repository state, the rendered markdown and JSON outputs MUST be byte-for-byte stable, including when custom changelog mapping and section ordering are provided.

#### Scenario: Repeated run over same refs with custom mapping
- **WHEN** the action runs twice against identical commit range and identical changelog mapping/order configuration
- **THEN** output values are identical across both runs

### Requirement: Changelog markdown SHALL escape user-controlled commit content
The system MUST escape markdown-sensitive and mention-triggering characters in user-controlled commit-derived fields used for changelog entries, including commit description, scope text, and contributor display, before rendering markdown output.

#### Scenario: Commit description contains markdown metacharacters
- **WHEN** a relevant commit description includes markdown control characters or mention-like tokens
- **THEN** rendered changelog markdown includes escaped content that preserves text meaning without triggering unintended markdown behavior

#### Scenario: Contributor display contains mention text
- **WHEN** contributor display text contains raw `@` mention patterns from commit-derived data
- **THEN** rendered changelog output escapes the mention-sensitive content to avoid unintended notifications
