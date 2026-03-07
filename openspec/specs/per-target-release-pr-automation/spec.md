# per-target-release-pr-automation Specification

## Purpose
TBD - created by archiving change build-rellu-github-action. Update Purpose after archive.
## Requirements
### Requirement: Release PR behavior SHALL be explicitly opt-in
The system SHALL create or update release PRs only when release PR mode is enabled. Release PR mode MAY be enabled globally via `create-release-prs=true` and MAY be overridden per target via optional target `releasePr.enabled` settings.

#### Scenario: Release PR mode is disabled globally
- **WHEN** the action runs with `create-release-prs=false`
- **THEN** no release branch or PR create/update operations are executed

#### Scenario: Target opts out while global release PR mode is enabled
- **WHEN** `create-release-prs=true` and target `app-2` sets `releasePr.enabled=false`
- **THEN** no release branch or PR create/update operations are executed for `app-2`

#### Scenario: Target opts in while global release PR mode is enabled
- **WHEN** `create-release-prs=true` and target `app-1` has `releasePr.enabled=true` or no target override
- **THEN** release branch and PR operations are allowed for `app-1` when it is releasable

### Requirement: Release branch naming SHALL be deterministic per target
For each releasable target, the release branch MUST use a stable naming convention derived from configured prefix and target label so one persistent PR can be reused. The branch prefix SHALL resolve with precedence: target `releasePr.branchPrefix` first, then global `release-branch-prefix`.

#### Scenario: Branch name is derived for target using global prefix
- **WHEN** target label is `app-1`, no target branch prefix override is set, and global branch prefix is `rellu/release`
- **THEN** the release branch name resolves to `rellu/release/app-1`

#### Scenario: Branch name is derived for target using target override prefix
- **WHEN** target label is `app-1` and target `releasePr.branchPrefix` is `custom/release`
- **THEN** the release branch name resolves to `custom/release/app-1`

### Requirement: Release branch update SHALL regenerate from base with one release commit
When creating or updating a release PR, the system MUST reset branch content to latest base branch state, apply generated version updates, create exactly one release commit, and force-push the branch. Before force-pushing, the system MUST validate that the target branch is automation-owned and safe for destructive updates.

#### Scenario: Existing release PR is refreshed
- **WHEN** an open release PR already exists for a target
- **THEN** old generated release commits are removed and a single new `release(<label>): v<nextVersion>` commit remains on the release branch

#### Scenario: Unsafe branch target blocks force-push
- **WHEN** computed release branch fails automation-owned safety validation
- **THEN** the action fails before executing force-push and reports a security validation error

### Requirement: Release PR metadata SHALL stay synchronized with analysis
The system SHALL create or update PR title and body from computed target version and generated markdown changelog on every release PR run, and SHALL execute those GitHub read/write operations through an authenticated `@actions/github` client initialized from action runtime credentials.

#### Scenario: Changelog changes between runs
- **WHEN** new relevant commits alter target changelog content
- **THEN** the existing release PR body is updated to the new generated markdown

#### Scenario: Toolkit GitHub client is used for PR mutation operations
- **WHEN** release PR mode creates or updates a PR for a releasable target
- **THEN** the action performs the API operations through the initialized toolkit GitHub client for the current repository context

### Requirement: Non-releasable targets SHALL be skipped in release PR mode
Targets with `changed=false` or no releasable next version under active no-bump policy MUST NOT create or update release PRs. For skipped targets, per-target output metadata MUST NOT imply a release PR exists.

#### Scenario: Changed target skipped by no-bump skip policy
- **WHEN** target changed only through non-bump-worthy commits and policy is `skip`
- **THEN** no release PR is created for that target and skip reason is logged

#### Scenario: Skipped target does not advertise enabled release PR metadata
- **WHEN** release PR mode is enabled but a target is non-releasable and no PR create/update operation runs
- **THEN** that target's `releasePr` metadata reports `enabled=false` and does not include PR identity fields

### Requirement: Automation-owned release branches MUST tolerate manual edits being overwritten
The system MUST treat release branches as automation-owned and may overwrite manual branch changes during regeneration. Force-push operations MUST be limited to branches that pass automation-owned branch safety validation.

#### Scenario: Manual commit exists on release branch
- **WHEN** the next release PR update run executes
- **THEN** the branch is force-reset to regenerated automation content and manual edits are discarded

#### Scenario: Non-release branch names are rejected for destructive push
- **WHEN** release branch configuration resolves to a protected or non-automation branch name (for example default development branches)
- **THEN** the action rejects the operation and does not execute force-push

### Requirement: Release PR body updates SHALL use sanitized changelog markdown
When release PR mode creates or updates PR bodies, the body content MUST be sourced from sanitized changelog markdown output so commit-derived user content cannot inject unsafe markdown or unintended mentions.

#### Scenario: Release PR body update includes commit-derived special characters
- **WHEN** releasable commits contain markdown-special characters or mention-like text
- **THEN** the created or updated PR body contains escaped markdown-safe content for those fields

