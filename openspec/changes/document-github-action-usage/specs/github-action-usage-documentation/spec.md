## ADDED Requirements

### Requirement: README SHALL provide an end-to-end onboarding path for first use
The repository README MUST explain the action purpose, prerequisites, and a minimal workflow example that users can adapt without reading source files.

#### Scenario: First-time adopter sets up the action
- **WHEN** a user opens the repository to integrate the action for the first time
- **THEN** the README provides a clear sequence of steps from prerequisite checkout settings to a runnable workflow snippet

### Requirement: README SHALL document all action inputs with authoritative metadata
The README MUST document every input defined in `action.yml`, including input key, required status, default value, and behavior notes.

#### Scenario: User validates an input before adding it to workflow
- **WHEN** a user looks up an input such as `range-strategy` or `create-release-prs`
- **THEN** the README lists that input with matching default and semantic behavior from `action.yml`

### Requirement: README SHALL document action outputs and expected usage
The README MUST describe each output key and include at least one example of consuming outputs in downstream workflow steps.

#### Scenario: Workflow author needs output contract
- **WHEN** a user needs to branch workflow logic based on change detection
- **THEN** the README documents `changed-targets`, `has-changes`, `result-json`, and `release-prs-created` with usage context

### Requirement: README SHALL define `.github/rellu.json` configuration structure with examples
The README MUST describe required and optional config fields and include valid JSON examples for single-target and multi-target monorepo setups.

#### Scenario: User creates initial config file
- **WHEN** a user prepares `.github/rellu.json`
- **THEN** the README provides schema-aligned examples for `targets`, `version`, and optional `releasePr`, `bumpRules`, and `changelog` sections

### Requirement: README SHALL include troubleshooting guidance for common integration failures
The README MUST include a troubleshooting section that maps common failure symptoms to corrective actions for checkout depth, ref selection, conventional commit validation, and config validation.

#### Scenario: User encounters action failure in CI
- **WHEN** a workflow run fails due to a known setup issue
- **THEN** the README provides a likely cause and actionable remediation without requiring source-level debugging
