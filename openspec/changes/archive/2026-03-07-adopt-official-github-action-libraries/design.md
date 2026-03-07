## Context

The current action codebase implements several runtime concerns manually (inputs, outputs, logging, failure signaling, command execution, and parts of GitHub API access). While functional, this duplicates capabilities maintained by official GitHub Actions toolkit packages and increases surface area for bugs and long-term maintenance.

The project is now fully typed and built as a bundled action artifact. This is a good point to shift runtime integration boundaries to `@actions/core`, `@actions/github`, `@actions/io`, and `@actions/exec` while preserving external behavior and outputs.

Constraints:
- Keep Node-based GitHub Action runtime compatibility.
- Preserve current output contract (`changed-targets`, `has-changes`, `result-json`, `release-prs-created`).
- Preserve existing release PR semantics and branch naming conventions.

## Goals / Non-Goals

**Goals:**
- Replace custom runtime plumbing with official toolkit abstractions for inputs/outputs/logging/failure handling.
- Replace custom GitHub API client setup in release PR flows with `@actions/github` (`getOctokit`).
- Replace custom command execution plumbing with `@actions/exec` for command-driven runtime operations.
- Adopt `@actions/io` for runner-oriented filesystem helper operations where applicable.
- Keep behavior stable while reducing custom code complexity.
- Keep modules testable by introducing thin adapters over toolkit calls.

**Non-Goals:**
- Changing release decision logic, bump policy, or changelog semantics.
- Redesigning target analysis architecture.
- Changing action input/output names or payload formats.

## Decisions

1. Decision: Introduce a runtime toolkit adapter layer
- Choice: Add small local wrappers (`core-client`, `github-client`, `io-client`, and `exec-client`) around `@actions/core`, `@actions/github`, `@actions/io`, and `@actions/exec`.
- Rationale: Keeps direct vendor API usage localized and makes unit tests straightforward with mockable adapter boundaries.
- Alternatives considered:
  - Direct imports across modules: rejected due to tighter coupling and harder tests.
  - Keep custom wrappers only: rejected because it continues reinventing toolkit features.

2. Decision: Migrate release PR API operations to `getOctokit`
- Choice: Use `@actions/github` for authenticated PR list/create/update operations.
- Rationale: Standardizes token handling and API behavior on official, battle-tested client patterns.
- Alternatives considered:
  - Continue using custom `fetch`: rejected due to duplicated request/response/error handling logic.

3. Decision: Preserve output contract and runtime semantics
- Choice: Keep output names and top-level behavior unchanged while replacing internals.
- Rationale: Minimizes adoption risk and avoids breaking downstream workflows.
- Alternatives considered:
  - Introduce output schema changes during migration: rejected because this migration is maintainability-focused.

4. Decision: Migrate incrementally by boundary
- Choice: Update one concern at a time (core I/O/logging, command execution, GitHub API integration, then tests/docs).
- Rationale: Reduces regression blast radius and keeps diffs reviewable.
- Alternatives considered:
  - Big-bang rewrite: rejected due to higher regression risk.

5. Decision: Defer lint-rule enforcement as a separate concern
- Choice: Do not add lint rule patterns that enforce toolkit usage in this change.
- Rationale: Keep this change focused on runtime migration and behavioral parity.
- Alternatives considered:
  - Introduce new lint constraints now: rejected to avoid scope expansion during migration.

## Risks / Trade-offs

- [Risk] Wrapper abstractions could drift from toolkit behavior over time. -> Mitigation: Keep wrappers intentionally thin and covered by focused tests.
- [Risk] Subtle differences in GitHub API error shapes could change error messages. -> Mitigation: Add release PR flow regression tests for common API failure paths.
- [Risk] Partial migration may leave mixed patterns temporarily. -> Mitigation: Sequence tasks to complete boundary migration in one change and enforce via docs/tests.

## Migration Plan

1. Add `@actions/core`, `@actions/github`, `@actions/io`, and `@actions/exec` dependencies.
2. Implement toolkit adapter modules and wire them into current runtime boundaries.
3. Replace command execution boundaries (for example git command invocations) with `@actions/exec` adapters.
4. Replace release PR API implementation with `getOctokit`-based calls.
5. Use `@actions/io` for runner-oriented filesystem helpers where applicable.
6. Update unit/integration tests to mock adapters and verify unchanged behavior.
7. Update docs for dependency rationale and runtime conventions.
8. Validate with build, typecheck, and tests.

Rollback strategy:
- Revert adapter wiring and dependency additions in one commit if regressions are detected.
- Restore previous custom API/input-output handlers from git history.

## Open Questions

None. Previous open questions were resolved:
- Adopt `@actions/io` and `@actions/exec` as part of this change.
- Do not add toolkit-enforcement lint rule patterns in this change.
