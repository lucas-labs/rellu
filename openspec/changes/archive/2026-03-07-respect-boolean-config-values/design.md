## Context

Config file booleans for `strictConventionalCommits` and `createReleasePrs` are currently funneled through string-only helpers, so native JSON booleans (`true`/`false`) are treated as empty values. This silently disables expected behavior and contradicts normal JSON config expectations.

## Goals / Non-Goals

**Goals:**
- Support native JSON booleans for relevant config-file flags.
- Keep action-input string behavior unchanged.
- Fail fast on invalid non-boolean, non-string values for boolean fields.

**Non-Goals:**
- Redesigning the full config schema.
- Changing strict-mode logic or release PR logic beyond enabling flags correctly.
- Introducing new inputs.

## Decisions

1. Decision: Add explicit boolean coercion helper for config values
- Choice: Parse booleans from either native boolean values or `"true"`/`"false"` strings and reject unsupported types.
- Rationale: Aligns config-file behavior with JSON semantics while preserving existing input compatibility.
- Alternatives considered:
  - Keep string-only parsing: rejected as source of silent misconfiguration.
  - Coerce arbitrary truthy/falsey values: rejected due to ambiguity.

2. Decision: Preserve precedence order but correct value extraction
- Choice: Keep current precedence (action input override first, config file fallback) but evaluate config-file booleans without dropping native booleans.
- Rationale: Minimal behavioral change, fixes bug without policy churn.
- Alternatives considered:
  - Change precedence simultaneously: rejected as unnecessary scope increase.

3. Decision: Surface clear validation errors
- Choice: Throw descriptive errors when boolean fields receive invalid types/strings.
- Rationale: Prevent silent disabling of safety/release features.
- Alternatives considered:
  - Quiet fallback to defaults: rejected for operational risk.

## Risks / Trade-offs

- [Risk] Existing misconfigured repos may start failing after validation. -> Mitigation: clear error messages and docs for accepted boolean forms.
- [Risk] Multiple parsing paths can diverge over time. -> Mitigation: centralize boolean coercion in one helper and test both fields.
- [Risk] Behavior change might be mistaken as regression. -> Mitigation: update docs and tests to define supported values.

## Migration Plan

1. Implement shared coercion utility for boolean config fields.
2. Wire `strictConventionalCommits` and `createReleasePrs` parsing through it.
3. Add tests for native booleans, string booleans, and invalid values.
4. Update docs to show accepted config-file types.

Rollback strategy:
- Revert coercion utility integration and restore previous parsing behavior if needed.

## Open Questions

None.
