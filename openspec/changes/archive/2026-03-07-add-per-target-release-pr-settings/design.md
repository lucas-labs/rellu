## Context

The current schema has global release PR controls (`create-release-prs`, `release-branch-prefix`, `base-branch`) and does not allow per-target overrides, while the project description requires optional release PR behavior settings on each app target. This makes mixed-release monorepos hard to operate because targets that should opt out or use different branch/base settings cannot be modeled directly.

## Goals / Non-Goals

**Goals:**
- Add optional per-target release PR settings to target configuration.
- Define deterministic precedence between global release PR settings and per-target overrides.
- Preserve existing behavior for repositories that only use global settings.
- Validate per-target settings clearly at config load time.

**Non-Goals:**
- Redesign release PR commit/changelog content.
- Change the global release PR inputs semantics.
- Introduce organization-wide policy engines or environment-specific override layers.

## Decisions

1. Decision: Add optional `releasePr` object on each target
- Choice: Extend target config with an optional `releasePr` object (for example `enabled`, `branchPrefix`, `baseBranch`).
- Rationale: Keeps release behavior attached to target ownership and supports mixed monorepo workflows.
- Alternatives considered:
  - Keep only global settings and split workflows externally: rejected as operationally brittle.
  - Create a separate global map keyed by label: rejected due to duplication and drift from target definitions.

2. Decision: Use explicit precedence rules
- Choice: Resolve effective per-target release settings as `target.releasePr.*` override first, then global values, then current defaults.
- Rationale: Deterministic and easy to reason about in docs/tests.
- Alternatives considered:
  - Merge with implicit heuristics: rejected because behavior is less transparent.

3. Decision: Preserve opt-in model while allowing per-target opt-out
- Choice: Global release PR mode remains opt-in; when enabled globally, a target can still disable itself with per-target `releasePr.enabled=false`.
- Rationale: Backward-compatible and adds needed control without introducing breaking defaults.
- Alternatives considered:
  - Per-target setting required for all targets: rejected as migration-heavy.

4. Decision: Validate release settings during config parsing
- Choice: Validate per-target release settings types/values while loading config and fail fast with target-labeled messages.
- Rationale: Prevents late runtime failures after analysis work has started.
- Alternatives considered:
  - Validate lazily inside release logic: rejected due to poorer operator feedback.

## Risks / Trade-offs

- [Risk] Added config surface may increase user misconfiguration. -> Mitigation: strict schema validation and concise examples in README.
- [Risk] Precedence confusion between global and target settings. -> Mitigation: document one deterministic precedence rule and add tests.
- [Risk] Existing tests may assume only global release settings. -> Mitigation: add targeted tests for global-only behavior to ensure no regressions.

## Migration Plan

1. Extend target config types and parser to accept optional per-target release PR settings.
2. Implement effective-setting resolution in release PR automation flow.
3. Add tests for opt-out, per-target branch/base overrides, and global fallback behavior.
4. Update docs and sample config with per-target release PR examples.

Rollback strategy:
- Remove per-target release settings support and restore global-only behavior.
- Keep existing global inputs untouched so rollback does not require workflow changes.

## Open Questions

None.
