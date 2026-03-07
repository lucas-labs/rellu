## MODIFIED Requirements

### Requirement: Release branch update SHALL regenerate from base with one release commit
When creating or updating a release PR, the system MUST reset branch content to latest base branch state, apply generated version updates, create exactly one release commit, and force-push the branch. Before force-pushing, the system MUST validate that the target branch is automation-owned and safe for destructive updates.

#### Scenario: Existing release PR is refreshed
- **WHEN** an open release PR already exists for a target
- **THEN** old generated release commits are removed and a single new `release(<label>): v<nextVersion>` commit remains on the release branch

#### Scenario: Unsafe branch target blocks force-push
- **WHEN** computed release branch fails automation-owned safety validation
- **THEN** the action fails before executing force-push and reports a security validation error

### Requirement: Automation-owned release branches MUST tolerate manual edits being overwritten
The system MUST treat release branches as automation-owned and may overwrite manual branch changes during regeneration. Force-push operations MUST be limited to branches that pass automation-owned branch safety validation.

#### Scenario: Manual commit exists on release branch
- **WHEN** the next release PR update run executes
- **THEN** the branch is force-reset to regenerated automation content and manual edits are discarded

#### Scenario: Non-release branch names are rejected for destructive push
- **WHEN** release branch configuration resolves to a protected or non-automation branch name (for example default development branches)
- **THEN** the action rejects the operation and does not execute force-push
