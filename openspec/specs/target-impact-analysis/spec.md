# target-impact-analysis Specification

## Purpose
TBD - created by archiving change build-rellu-github-action. Update Purpose after archive.
## Requirements
### Requirement: Target configuration SHALL define releasable ownership
The system SHALL accept a target configuration with a unique `label`, one or more `paths` globs, a `version` source descriptor, and optional per-target release PR behavior settings.

#### Scenario: Valid target map is loaded
- **WHEN** the action starts with a config containing multiple targets
- **THEN** the action validates required fields and unique labels before analysis begins

#### Scenario: Target includes optional release PR behavior settings
- **WHEN** a target defines `releasePr` settings (for example `enabled`, `branchPrefix`, or `baseBranch`)
- **THEN** the action accepts the target config and exposes those values for release PR planning

#### Scenario: Target release PR behavior settings are invalid
- **WHEN** a target defines malformed `releasePr` settings
- **THEN** the action fails during config validation with a message identifying the target and invalid field

### Requirement: Commit collection SHALL provide deterministic range metadata
The system SHALL resolve the configured analysis range deterministically and collect, for each commit in the resolved range, SHA, subject, body, author metadata, and changed files. Supported deterministic range resolution MUST include explicit refs (`from-ref..to-ref`), latest-tag-to-ref, and latest-tag-with-prefix-to-ref strategies. For latest-tag-with-prefix, prefix resolution MUST be target-specific.

#### Scenario: Commits are collected from a valid explicit range
- **WHEN** `from-ref` and `to-ref` resolve to reachable commits
- **THEN** the action returns a deterministic commit list and complete per-commit metadata

#### Scenario: Latest tag with prefix is resolved as range start per target
- **WHEN** range strategy selects latest tag with prefix, target `app-1` is configured with prefix `app-1@v`, and `to-ref` is `HEAD`
- **THEN** the action resolves `from` for `app-1` to the newest reachable tag matching `app-1@v*` and analyzes that target against `from..HEAD`

#### Scenario: Different targets use different tag prefixes
- **WHEN** target `app-1` is configured with `app-1@v` and target `app-2` is configured with `app-2@v`
- **THEN** each target resolves from its own latest matching tag and does not reuse the other target’s tag baseline

#### Scenario: No matching tag exists for a target prefix
- **WHEN** range strategy selects latest tag with prefix for a target and no matching tag is found for that target prefix
- **THEN** that target falls back to first-commit range resolution with a clear log entry

### Requirement: Target change detection SHALL be path-driven
A target MUST be marked `changed=true` when at least one file in the analyzed range matches at least one configured path glob for that target.

#### Scenario: Target is marked changed by matched file
- **WHEN** a commit in range changes `apps/app1/src/index.ts` and the target owns `apps/app1/**/*`
- **THEN** the target is marked changed and `matchedFiles` includes `apps/app1/src/index.ts`

### Requirement: Target path matching SHALL use standard glob semantics
The system MUST evaluate target `paths` using standard glob semantics provided by a mature glob implementation, including support for common monorepo patterns such as brace expansion and character classes, while preserving deterministic matching behavior.

#### Scenario: Brace expansion pattern matches changed file
- **WHEN** a target path pattern is `apps/{web,admin}/src/**` and a commit changes `apps/web/src/main.ts`
- **THEN** the file is treated as matched for that target

#### Scenario: Character class pattern matches changed file
- **WHEN** a target path pattern is `packages/lib-[ab]/**` and a commit changes `packages/lib-a/index.ts`
- **THEN** the file is treated as matched for that target

### Requirement: Invalid target glob patterns SHALL fail fast
If any configured target path pattern is syntactically invalid for the supported glob syntax, the action MUST fail validation before analysis with a clear error that identifies the target and invalid pattern.

#### Scenario: Invalid glob pattern is configured
- **WHEN** a target path pattern is invalid glob syntax
- **THEN** the action fails before commit analysis and reports the target label and offending pattern

### Requirement: Shared paths SHALL assign commits to all matching targets
A commit that modifies files matching multiple target path sets SHALL be considered relevant to each matching target independently.

#### Scenario: Shared package change affects two targets
- **WHEN** a commit updates `packages/shared/logger.ts` and both `app-1` and `app-2` own `packages/shared/**/*`
- **THEN** the commit is included in relevant commits for both targets

### Requirement: Merge commit handling SHALL be deterministic
The system MUST apply a documented, deterministic strategy for merge commits so repeated runs over the same refs produce identical target impact results, including stable changed-file assignment for merge commits.

#### Scenario: Merge commit appears in analyzed range
- **WHEN** the range includes merge commits
- **THEN** merge commits are handled consistently and do not produce nondeterministic target assignments

#### Scenario: Repeated analysis over same refs with merges
- **WHEN** the same range containing merge commits is analyzed multiple times
- **THEN** target `changed`, `matchedFiles`, and `commitCount` outputs are identical across runs
