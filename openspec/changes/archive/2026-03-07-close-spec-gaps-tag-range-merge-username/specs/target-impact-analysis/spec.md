## MODIFIED Requirements

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

### Requirement: Merge commit handling SHALL be deterministic
The system MUST apply a documented, deterministic strategy for merge commits so repeated runs over the same refs produce identical target impact results, including stable changed-file assignment for merge commits.

#### Scenario: Merge commit appears in analyzed range
- **WHEN** the range includes merge commits
- **THEN** merge commits are handled consistently and do not produce nondeterministic target assignments

#### Scenario: Repeated analysis over same refs with merges
- **WHEN** the same range containing merge commits is analyzed multiple times
- **THEN** target `changed`, `matchedFiles`, and `commitCount` outputs are identical across runs
