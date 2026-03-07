## Context

`analyzeRepository` computes analysis-level metadata (`range`, total `commitCount`) together with per-target results, but the current output assembly emits only the target array as `result-json`. Consumers that need analysis context cannot retrieve it from action outputs, which undermines traceability for downstream reporting and release orchestration.

## Goals / Non-Goals

**Goals:**
- Include analysis-level metadata in `result-json` output.
- Keep output deterministic and fully documented.
- Provide a predictable envelope shape that downstream jobs can parse without reconstructing context.

**Non-Goals:**
- Changing analysis algorithms (range resolution, commit collection, target impact logic).
- Adding new action inputs.
- Redesigning top-level outputs beyond `result-json` payload structure.

## Decisions

1. Decision: Change `result-json` to an analysis envelope object
- Choice: Emit `result-json` as a JSON object containing `{ range, commitCount, results }`.
- Rationale: Captures complete run context with one output and mirrors analysis domain model.
- Alternatives considered:
  - Keep array and add duplicated metadata per target: rejected as semantically incorrect.
  - Add second output key only: rejected because primary contract still loses context and diverges.

2. Decision: Preserve per-target object shape inside `results`
- Choice: Keep current target result schema unchanged and nest it under `results`.
- Rationale: Limits migration impact to one top-level parse step.
- Alternatives considered:
  - Full output redesign: rejected as unnecessary scope increase.

3. Decision: Treat change as contract-breaking but straightforward to migrate
- Choice: Document the top-level shape change and provide migration notes/examples in README/specs.
- Rationale: The old array contract cannot carry analysis metadata cleanly.
- Alternatives considered:
  - Transitional dual-format mode: rejected due to complexity and ambiguous parsing behavior.

## Risks / Trade-offs

- [Risk] Existing consumers expecting an array may break. -> Mitigation: clearly document new envelope and add tests locking the contract.
- [Risk] Contract drift between docs and implementation can recur. -> Mitigation: update contract tests to assert metadata presence and exact key set.
- [Risk] Future fields may be appended inconsistently. -> Mitigation: centralize output payload typing and serialization in one place.

## Migration Plan

1. Update output payload types and `writeActionOutputs` call site to pass an envelope object.
2. Update contract/unit tests for new `result-json` structure.
3. Update README output examples and notes for downstream consumers.
4. Validate deterministic output shape with existing test suite.

Rollback strategy:
- Revert to array-only `result-json` serialization and associated tests/docs if compatibility issues are critical.

## Open Questions

None.
