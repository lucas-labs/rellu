## Context

Changelog rendering currently uses hardcoded conventional-type to section mapping and hardcoded section ordering in `src/changelog.ts`. The project description requires section and mapping configurability for users while preserving sensible defaults. The action already follows a JSON-input pattern for configurable behavior (for example `bump-rules`), so this change should align with that style.

## Goals / Non-Goals

**Goals:**
- Make changelog category mapping configurable at runtime via action input/config file.
- Allow section ordering to be configured while retaining deterministic rendering.
- Preserve the current mapping/order as defaults when users do not configure anything.
- Validate configuration early and fail with actionable error messages.

**Non-Goals:**
- Changing commit parsing semantics or bump calculation.
- Changing changelog entry line format (description/author/sha link format remains the same).
- Introducing per-target section mappings in this change.

## Decisions

1. Decision: Add optional JSON inputs for mapping and ordering
- Choice: Introduce `changelog-category-map` (JSON object `commitType -> sectionName`) and `changelog-section-order` (JSON array of section names), with config-file equivalents `changelogCategoryMap` and `changelogSectionOrder`.
- Rationale: Matches existing action patterns (`bump-rules` JSON), keeps configuration explicit, and avoids brittle comma-separated parsing.
- Alternatives considered:
  - Single combined object input: rejected to keep simple override behavior and backward compatibility.
  - YAML syntax input: rejected because current inputs are JSON-oriented.

2. Decision: Keep defaults as current behavior
- Choice: Preserve today's mapping/order as internal defaults when no custom config is provided.
- Rationale: No behavior change for existing users and workflows.
- Alternatives considered:
  - Make mapping mandatory: rejected as breaking.

3. Decision: Enforce deterministic section ordering even with partial config
- Choice: Render sections in configured order first, then append remaining encountered sections sorted lexicographically.
- Rationale: Guarantees stable output while allowing users to configure primary ordering.
- Alternatives considered:
  - Preserve first-seen order for unmatched sections: rejected as history-order dependent and less predictable.

4. Decision: Strict validation for malformed mapping/order
- Choice: Reject non-object mapping, non-array order, empty section names, and duplicate ordered sections with clear error messages.
- Rationale: Prevents silent mis-grouping and keeps action behavior auditable.
- Alternatives considered:
  - Best-effort coercion: rejected due to hidden misconfiguration risk.

## Risks / Trade-offs

- [Risk] Users may provide incomplete mapping and expect all types covered. -> Mitigation: document `other` fallback and append behavior for unmapped sections.
- [Risk] New input surface can increase support burden. -> Mitigation: keep defaults unchanged and include ready-to-copy JSON examples in README.
- [Risk] Order conflicts/duplicates can break release jobs. -> Mitigation: fail fast in config loading with explicit validation errors.

## Migration Plan

1. Extend input/config parsing and typed config model for changelog mapping/order.
2. Update changelog renderer to consume resolved mapping/order configuration.
3. Add unit tests for default mapping, custom mapping, ordering, and validation failures.
4. Update docs (`action.yml`, README) with examples and fallback semantics.

Rollback strategy:
- Remove the new config fields and restore static mapping/order in renderer.
- Keep previous defaults intact so behavior reverts cleanly.

## Open Questions

None.
