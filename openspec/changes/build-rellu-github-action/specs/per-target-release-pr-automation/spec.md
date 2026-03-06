## ADDED Requirements

### Requirement: Release PR behavior SHALL be explicitly opt-in
The system SHALL create or update release PRs only when `create-release-prs=true`; otherwise analysis outputs are produced without branch or PR mutations.

#### Scenario: Release PR mode is disabled
- **WHEN** the action runs with `create-release-prs=false`
- **THEN** no release branch or PR create/update operations are executed

### Requirement: Release branch naming SHALL be deterministic per target
For each releasable target, the release branch MUST use a stable naming convention derived from configured prefix and target label so one persistent PR can be reused.

#### Scenario: Branch name is derived for target
- **WHEN** target label is `app-1` and branch prefix is `rellu/release`
- **THEN** the release branch name resolves to `rellu/release/app-1`

### Requirement: Release branch update SHALL regenerate from base with one release commit
When creating or updating a release PR, the system MUST reset branch content to latest base branch state, apply generated version updates, create exactly one release commit, and force-push the branch.

#### Scenario: Existing release PR is refreshed
- **WHEN** an open release PR already exists for a target
- **THEN** old generated release commits are removed and a single new `release(<label>): v<nextVersion>` commit remains on the release branch

### Requirement: Release PR metadata SHALL stay synchronized with analysis
The system SHALL create or update PR title and body from computed target version and generated markdown changelog on every release PR run.

#### Scenario: Changelog changes between runs
- **WHEN** new relevant commits alter target changelog content
- **THEN** the existing release PR body is updated to the new generated markdown

### Requirement: Non-releasable targets SHALL be skipped in release PR mode
Targets with `changed=false` or no releasable next version under active no-bump policy MUST NOT create or update release PRs.

#### Scenario: Changed target skipped by no-bump skip policy
- **WHEN** target changed only through non-bump-worthy commits and policy is `skip`
- **THEN** no release PR is created for that target and skip reason is logged

### Requirement: Automation-owned release branches MUST tolerate manual edits being overwritten
The system MUST treat release branches as automation-owned and may overwrite manual branch changes during regeneration.

#### Scenario: Manual commit exists on release branch
- **WHEN** the next release PR update run executes
- **THEN** the branch is force-reset to regenerated automation content and manual edits are discarded
