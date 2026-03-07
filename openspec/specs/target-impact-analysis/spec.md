# target-impact-analysis Specification

## Purpose
TBD - created by archiving change build-rellu-github-action. Update Purpose after archive.
## Requirements
### Requirement: Target configuration SHALL define releasable ownership
The system SHALL accept a target configuration with a unique `label`, one or more `paths` globs, and a `version` source descriptor for each target.

#### Scenario: Valid target map is loaded
- **WHEN** the action starts with a config containing multiple targets
- **THEN** the action validates required fields and unique labels before analysis begins

### Requirement: Commit collection SHALL provide deterministic range metadata
The system SHALL resolve the configured `from-ref..to-ref` range and collect, for each commit in the resolved range, SHA, subject, body, author metadata, and changed files.

#### Scenario: Commits are collected from a valid range
- **WHEN** `from-ref` and `to-ref` resolve to reachable commits
- **THEN** the action returns a deterministic commit list and complete per-commit metadata

### Requirement: Target change detection SHALL be path-driven
A target MUST be marked `changed=true` when at least one file in the analyzed range matches at least one configured path glob for that target.

#### Scenario: Target is marked changed by matched file
- **WHEN** a commit in range changes `apps/app1/src/index.ts` and the target owns `apps/app1/**/*`
- **THEN** the target is marked changed and `matchedFiles` includes `apps/app1/src/index.ts`

### Requirement: Shared paths SHALL assign commits to all matching targets
A commit that modifies files matching multiple target path sets SHALL be considered relevant to each matching target independently.

#### Scenario: Shared package change affects two targets
- **WHEN** a commit updates `packages/shared/logger.ts` and both `app-1` and `app-2` own `packages/shared/**/*`
- **THEN** the commit is included in relevant commits for both targets

### Requirement: Merge commit handling SHALL be deterministic
The system MUST apply a documented, deterministic strategy for merge commits so repeated runs over the same refs produce identical target impact results.

#### Scenario: Merge commit appears in analyzed range
- **WHEN** the range includes merge commits
- **THEN** merge commits are handled consistently and do not produce nondeterministic target assignments

