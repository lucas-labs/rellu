## Context

The current implementation is close to baseline behavior but still misses three required specification behaviors from the project description: (1) tag-prefix/latest-tag range resolution, (2) strict-mode compatibility with deterministic merge handling, and (3) ordered GitHub username fallback resolution. These gaps affect reliability of real monorepo workflows because they force manual range plumbing, can fail on common merge subjects, and reduce contributor attribution quality.

The changes are cross-cutting across git range resolution, commit parsing/validation, and changelog author display.

## Goals / Non-Goals

**Goals:**
- Add first-class range resolution support for latest-tag and latest-tag-with-prefix flows, with tag-prefix resolution applied per target.
- Preserve deterministic merge handling while preventing merge-subject false failures in strict conventional mode.
- Enforce the documented attribution fallback order: commit association -> email lookup -> author-name fallback.
- Keep top-level outputs and per-target output schema stable.

**Non-Goals:**
- Redesigning release PR branch/commit automation.
- Changing default bump mappings or introducing new bump levels.
- Introducing broad config schema redesign beyond the minimum needed for range selection.

## Decisions

1. Decision: Extend range resolution using explicit range strategy inputs
- Choice: Add a small set of range strategy options layered on top of existing `from-ref`/`to-ref`, including latest-tag and latest-tag-prefix resolution, and define prefix selection at target level.
- Rationale: Preserves backward compatibility while enabling required behavior for independently released monorepo targets.
- Alternatives considered:
  - Auto-detect tags implicitly without strategy selection: rejected due to ambiguous behavior.
  - Replace `from-ref` entirely: rejected because existing workflows depend on explicit refs.
  - Repository-level single prefix only: rejected because it can anchor one target on another target's release tag.

2. Decision: Keep deterministic merge traversal and scope strict validation to non-merge conventional subjects
- Choice: Continue deterministic traversal strategy and treat non-conventional merge subjects as non-failing in strict mode unless a merge-derived subject is explicitly considered relevant for conventional validation.
- Rationale: Avoids false failures for standard merge titles while keeping strict guarantees for meaningful conventional commit validation.
- Alternatives considered:
  - Validate merge subjects strictly the same as regular commits: rejected because it breaks common repository workflows.
  - Ignore all merge commits completely: rejected because changed-file impact metadata still needs deterministic accounting.

3. Decision: Implement layered author attribution resolver
- Choice: Resolve display identity in required order: associated commit author login, then email-based API lookup, then author name fallback.
- Rationale: Matches specification and improves attribution quality without breaking output shape.
- Alternatives considered:
  - Keep current single-source commit-author login resolution: rejected as incomplete vs requirements.

4. Decision: Backfill tests at integration boundaries
- Choice: Add/adjust tests for range resolution strategy, strict merge behavior, and attribution fallback order with deterministic fixtures.
- Rationale: These behaviors are prone to regressions and need direct test coverage.
- Alternatives considered:
  - Rely only on existing fixture tests: rejected due to missing coverage for new edge cases.

## Risks / Trade-offs

- [Risk] New range strategy options may be misconfigured by users. -> Mitigation: enforce clear validation and explicit error messages.
- [Risk] Additional GitHub lookups for email fallback can increase API calls. -> Mitigation: only attempt email fallback when primary association is absent; log fallback decisions succinctly.
- [Risk] Merge-validation semantics can become confusing. -> Mitigation: document strict-mode behavior for merge subjects and cover with deterministic tests.

## Migration Plan

1. Introduce range strategy config/input handling for latest-tag and latest-tag-prefix resolution, including per-target prefix configuration.
2. Update git range resolver with tag discovery logic, per-target prefix filtering, and no-tag fallback behavior.
3. Update strict conventional validation path to avoid false failures on merge subjects while preserving strictness for relevant non-merge commits.
4. Extend GitHub author enrichment logic with ordered fallback steps.
5. Update/extend tests for each gap and run full verification.

Rollback strategy:
- Revert range strategy additions and merge/attribution logic in one change if regressions are detected.
- Preserve existing explicit-ref behavior as stable fallback path.

## Open Questions

None. Tag-prefix resolution is defined as per-target in this change.
