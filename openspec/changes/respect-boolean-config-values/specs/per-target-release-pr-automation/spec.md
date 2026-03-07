## MODIFIED Requirements

### Requirement: Release PR behavior SHALL be explicitly opt-in
The system SHALL create or update release PRs only when `create-release-prs=true`; otherwise analysis outputs are produced without branch or PR mutations. Release PR opt-in configuration SHALL accept both native boolean config-file values and boolean strings.

#### Scenario: Release PR mode is disabled
- **WHEN** the action runs with `create-release-prs=false`
- **THEN** no release branch or PR create/update operations are executed

#### Scenario: Native JSON boolean enables release PR mode
- **WHEN** config-file sets `createReleasePrs` to boolean `true`
- **THEN** release PR mode is enabled and eligible targets proceed through release PR automation
