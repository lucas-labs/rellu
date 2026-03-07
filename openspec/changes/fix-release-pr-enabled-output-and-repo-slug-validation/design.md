## Context

Release PR mode currently marks some non-releasable targets with `releasePr.enabled: true` even when no PR create/update happened, which makes downstream consumers infer nonexistent PRs. Separately, repository slug parsing for GitHub client initialization accepts extra path segments and passes ambiguous owner/name values to API calls.

## Goals / Non-Goals

**Goals:**
- Ensure per-target `releasePr` output metadata reflects actual PR activity for that target.
- Preserve deterministic output shape while removing ambiguous "enabled but not created" signaling.
- Validate repository slug input strictly as `owner/name` and fail fast with actionable errors.
- Add tests that lock corrected behavior and prevent regressions.

**Non-Goals:**
- Changing release PR branch naming, commit generation, or PR sync workflow logic.
- Introducing new action inputs for repository override behavior.
- Redesigning the entire result payload schema.

## Decisions

1. Decision: Represent non-releasable targets with non-enabled PR metadata
- Choice: For targets skipped in release PR mode, emit `releasePr.enabled: false` and avoid PR identity fields (`number`, `url`, `branch`) unless a PR is created/updated.
- Rationale: Prevents false positives in automation that treats `enabled: true` as PR existence.
- Alternatives considered:
  - Keep `enabled: true` as mode flag and add a second status field: rejected as unnecessarily ambiguous and harder to migrate.
  - Omit `releasePr` entirely for skipped targets: rejected to keep a predictable object shape when release mode is active.

2. Decision: Keep mode-level signaling in top-level outputs only
- Choice: Continue using top-level action outputs for mode/summary signaling and keep per-target metadata strictly target-state oriented.
- Rationale: Separates run-mode state from per-target PR state and avoids overloading one field.
- Alternatives considered:
  - Encode run-mode in each target object: rejected due to duplication and parsing complexity.

3. Decision: Enforce strict repository slug parsing
- Choice: Accept only exactly two non-empty segments (`owner/name`) and throw descriptive errors for missing or extra segments.
- Rationale: Fails early near input boundaries and prevents confusing API failures against unintended repo names.
- Alternatives considered:
  - Keep permissive parsing and rely on downstream API errors: rejected due to poor diagnostics.
  - Auto-trim extra segments: rejected because it can silently target the wrong repository.

## Risks / Trade-offs

- [Risk] Existing consumers may rely on current `enabled: true` semantics for skipped targets. -> Mitigation: document the corrected semantics and add explicit contract tests.
- [Risk] Strict slug validation may surface previously hidden config errors. -> Mitigation: use clear validation messages and examples of valid format.
- [Risk] Mixed assumptions between legacy and new output expectations. -> Mitigation: update README/examples and align unit tests with the normalized contract.

## Migration Plan

1. Update release PR result assembly for skipped targets to emit non-enabled metadata and no PR identity fields.
2. Update output contract tests (and any docs/examples) for corrected per-target `releasePr` semantics.
3. Harden repository slug parsing and add negative tests for malformed values (`owner/name/extra`, missing owner, missing name).
4. Run test suite to validate release PR and GitHub client paths.

Rollback strategy:
- Revert the metadata normalization and slug parser validation changes, restoring previous behavior if downstream compatibility concerns block rollout.

## Open Questions

None.
