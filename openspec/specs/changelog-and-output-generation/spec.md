# changelog-and-output-generation Specification

## Purpose
TBD - created by archiving change build-rellu-github-action. Update Purpose after archive.
## Requirements
### Requirement: Action outputs SHALL expose top-level release analysis state
The action SHALL emit `changed-targets`, `has-changes`, and `result-json` outputs for every run, and SHALL emit `release-prs-created` when release PR mode is enabled.

#### Scenario: Outputs are produced for changed targets
- **WHEN** two targets are detected as changed
- **THEN** `changed-targets` contains both labels, `has-changes` is `true`, and `result-json` contains both target result objects

### Requirement: Result JSON SHALL include complete per-target analysis fields
Each target object in `result-json` MUST include label, changed state, matched files, bump outcome, current and next versions, relevant commits, rendered changelog markdown, and release PR metadata when applicable. Release PR metadata MUST represent actual per-target PR state and MUST NOT indicate `enabled=true` for targets where no release PR was created or updated.

#### Scenario: Target JSON contains required analysis fields
- **WHEN** a target has releasable changes
- **THEN** its JSON object includes `label`, `changed`, `matchedFiles`, `bump`, `currentVersion`, `nextVersion`, `commits`, and `changelog.markdown`

#### Scenario: Skipped target release PR metadata reflects no PR activity
- **WHEN** release PR mode is active and a target is skipped as non-releasable
- **THEN** the target output does not present release PR metadata that implies a PR was created or updated

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
