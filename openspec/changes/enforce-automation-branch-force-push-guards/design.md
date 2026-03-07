## Context

Release PR regeneration currently force-pushes to a computed branch without enforcing a strict safety policy that guarantees the branch is automation-owned. Because the branch prefix is user-configurable, misconfiguration can target non-release branches and turn the forced push into a destructive operation.

## Goals / Non-Goals

**Goals:**
- Enforce a hard guard that allows force-push only to validated automation-owned release branches.
- Fail fast before any destructive git operation when branch safety checks fail.
- Preserve current behavior for valid release branch configurations.

**Non-Goals:**
- Changing release PR creation/update semantics beyond branch-safety enforcement.
- Changing changelog/version computation.
- Implementing external branch-protection API integration in this change.

## Decisions

1. Decision: Introduce explicit branch safety validator before force-push
- Choice: Add a validation step that checks the fully resolved release branch against automation-owned branch rules before `git push +branch`.
- Rationale: Ensures destructive operation is gated by policy, not by convention.
- Alternatives considered:
  - Rely on naming convention only: rejected as insufficient for security requirement.
  - Validate only prefix non-empty: rejected as too weak; still allows unsafe branches.

2. Decision: Define denylist and shape constraints
- Choice: Reject unsafe branch names (for example bare/default branches and malformed refs), require normalized release-namespace branch form, and ensure generated branch includes target label suffix.
- Rationale: Defends against accidental pushes to sensitive branches and config mistakes.
- Alternatives considered:
  - Only allow exact hardcoded prefix: rejected because prefix is intentionally configurable.

3. Decision: Treat invalid branch safety as a hard error
- Choice: In release PR mode, throw with a clear security error if branch is unsafe instead of skipping target silently.
- Rationale: Silent skip could hide dangerous config drift.
- Alternatives considered:
  - Warn and continue: rejected due to potential false sense of safety.

## Risks / Trade-offs

- [Risk] Strict validation may block some existing custom prefixes. -> Mitigation: document accepted branch patterns and provide actionable errors.
- [Risk] Additional guard complexity could be bypassed by future code paths. -> Mitigation: centralize push operation through a single guarded function and test it directly.
- [Risk] Users may interpret failures as regressions. -> Mitigation: frame errors as security guardrails and include remediation guidance.

## Migration Plan

1. Add branch-safety validation utility and route release push flow through it.
2. Add tests for valid automation-owned branches and unsafe branch rejection cases.
3. Update docs with branch safety requirements for release PR mode.

Rollback strategy:
- Revert validator and guarded push changes if emergency rollback is needed, while keeping release PR behavior otherwise unchanged.

## Open Questions

None.
