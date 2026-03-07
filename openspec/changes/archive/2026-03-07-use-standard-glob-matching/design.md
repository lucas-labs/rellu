## Context

Target impact analysis relies on a custom matcher that implements only limited wildcard behavior. In real monorepos, teams commonly use richer glob syntax (for example brace expansion and character classes), so unsupported patterns can silently produce false negatives in target change detection.

## Goals / Non-Goals

**Goals:**
- Align target path matching with mature, standard glob semantics expected by monorepo users.
- Preserve compatibility for existing simple patterns (`*`, `**`, `?`).
- Fail fast for invalid glob configuration with clear diagnostics.
- Keep change detection deterministic across runs.

**Non-Goals:**
- Changing commit range resolution or merge handling.
- Introducing target-specific matching engines or per-target parser switches.
- Redesigning target configuration shape beyond validating `paths` patterns.

## Decisions

1. Decision: Replace custom matcher with a mature glob library
- Choice: Use a battle-tested glob matcher in path matching utilities instead of maintaining custom regex conversion logic.
- Rationale: Reduces maintenance burden and matches user expectations for common glob features.
- Alternatives considered:
  - Extend custom matcher incrementally: rejected due to ongoing correctness and compatibility risk.
  - Support only current syntax and document limitations: rejected because current behavior already violates user expectations.

2. Decision: Validate glob patterns at config-load time
- Choice: Validate configured target `paths` patterns early and fail with actionable errors when patterns are malformed.
- Rationale: Prevents silent runtime mismatches and makes configuration issues obvious.
- Alternatives considered:
  - Best-effort ignore invalid patterns: rejected due to hidden release risk.

3. Decision: Keep deterministic normalization for matching inputs
- Choice: Continue normalizing file paths before matching and keep consistent matching options across platforms.
- Rationale: Prevents OS-specific divergence in analysis outputs.
- Alternatives considered:
  - Delegate path normalization entirely to library defaults: rejected to avoid subtle cross-platform inconsistencies.

## Risks / Trade-offs

- [Risk] Slight behavior changes for edge-case patterns that previously matched by custom implementation quirks. -> Mitigation: add regression tests for current supported patterns and document standard semantics.
- [Risk] New dependency introduces version/maintenance overhead. -> Mitigation: pin version range, keep wrapper utility small, and test contract behavior.
- [Risk] Strict validation can fail previously accepted but malformed configs. -> Mitigation: provide precise error messages with the offending pattern and target label.

## Migration Plan

1. Introduce glob utility wrapper based on mature library semantics.
2. Update target matching path flow to route through the new matcher.
3. Add config validation for target path patterns.
4. Add unit tests for advanced glob features, existing wildcard compatibility, and invalid pattern errors.
5. Update docs/examples to state supported glob behavior.

Rollback strategy:
- Revert glob utility integration and restore custom matcher implementation if critical regressions emerge.

## Open Questions

None.
