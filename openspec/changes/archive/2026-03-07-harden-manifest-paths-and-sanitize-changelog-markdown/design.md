## Context

Version manifest paths are currently resolved from configuration without enforcing repository boundaries, so malformed or malicious paths can target files outside the checkout during release updates. Separately, changelog markdown and release PR body content include user-controlled commit-derived text without escaping, enabling markdown injection patterns such as unintended mentions and malformed content.

## Goals / Non-Goals

**Goals:**
- Constrain manifest file read/write operations to paths inside the checked-out repository workspace.
- Fail fast with clear errors when configured manifest paths resolve outside workspace bounds.
- Escape commit-derived changelog text before markdown rendering and reuse that sanitized output for release PR bodies.
- Add regression tests for path traversal/out-of-workspace attempts and markdown injection payloads.

**Non-Goals:**
- Changing version bump rules or target ownership semantics.
- Redesigning changelog layout/category mapping.
- Introducing additional configuration knobs for sanitization policy in this change.

## Decisions

1. Decision: Enforce repository-root path boundary checks for manifest operations
- Choice: Resolve manifest paths against repository root and reject any resolved path outside that root before read or write.
- Rationale: Prevents unintended filesystem access on runners and keeps updates scoped to checkout content.
- Alternatives considered:
  - Best-effort warnings only: rejected because unsafe writes could still occur.
  - Trust config paths without validation: rejected as the current vulnerability.

2. Decision: Centralize markdown escaping for user-controlled changelog fields
- Choice: Introduce a single escaping utility used for commit description, scope text, and contributor display before entry rendering.
- Rationale: Reduces drift and ensures consistent sanitization across changelog output surfaces.
- Alternatives considered:
  - Per-call inline escaping: rejected due to inconsistency risk.
  - Full markdown stripping: rejected because it loses useful text fidelity.

3. Decision: Treat release PR body content as sanitized changelog output
- Choice: Ensure PR body updates are sourced from the escaped markdown renderer, not raw commit-derived fragments.
- Rationale: Preserves feature behavior while removing markdown/mention injection vectors.
- Alternatives considered:
  - Separate PR-body-specific sanitizer: rejected as duplicate logic and drift risk.

## Risks / Trade-offs

- [Risk] Existing configs using absolute/external manifest paths will now fail. -> Mitigation: provide clear error messages and migration guidance to repository-relative paths.
- [Risk] Escaping may alter visual formatting of some commit messages. -> Mitigation: limit escaping to markdown-special/mention-sensitive characters and verify readability with fixtures.
- [Risk] Partial sanitization adoption could leave gaps. -> Mitigation: centralize renderer entry path and add contract tests for escaped output.

## Migration Plan

1. Add path-boundary helper to validate manifest read/write targets against repo root.
2. Apply validation in both version read and write flows before filesystem operations.
3. Add markdown escaping helper and use it in changelog entry rendering.
4. Ensure release PR body generation uses sanitized changelog markdown.
5. Add regression tests for out-of-workspace path rejection and escaped changelog/PR content.

Rollback strategy:
- Revert boundary and escaping integrations if an urgent compatibility issue appears, then reintroduce with narrower scope after incident analysis.

## Open Questions

None.
