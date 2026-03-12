## Context

Rellu is a JavaScript GitHub Action for monorepos with independently releasable targets. It must inspect a configurable git range, map changes to target ownership paths, parse conventional commits, compute per-target version outcomes, and optionally keep one release PR per target up to date.

Key constraints:
- Must run predictably in GitHub-hosted and self-hosted runners.
- Must work across Node, Rust, and Python version manifests.
- Must keep release PR branches automation-owned and reproducible.
- Must provide machine-readable outputs for downstream workflow orchestration.

## Goals / Non-Goals

**Goals:**
- Deliver deterministic per-target change analysis from configured refs and path globs.
- Produce consistent bump decisions and changelog content from conventional commits.
- Support multi-ecosystem version read/write with clear errors on unsupported layouts.
- Keep release PR mode idempotent by regenerating branch state from base each run.
- Expose stable action outputs for conditional workflow execution.

**Non-Goals:**
- Publishing packages, images, crates, or distributions.
- Creating GitHub Releases or git tags.
- Running project build/test commands for analyzed targets.

## Decisions

1. Configuration-driven target model
- Decision: Require explicit target definitions (`label`, `paths`, `version`) through action inputs/config.
- Rationale: Explicit ownership avoids ambiguous auto-discovery in mixed-language monorepos.
- Alternative considered: Workspace auto-discovery from manifests; rejected because it cannot model shared paths and target-specific release behavior reliably.

2. Git analysis pipeline built on git plumbing
- Decision: Resolve `from-ref..to-ref`, then collect commit metadata and changed files via git commands per commit.
- Rationale: Preserves deterministic behavior and complete control over merge-commit handling.
- Alternative considered: Single `git log --name-only` parse; rejected due to weaker structure and harder merge semantics.

3. Two-phase target resolution
- Decision: First compute changed targets from matched files, then assign relevant commits per target.
- Rationale: Supports shared paths and multi-target commits without cross-target coupling.
- Alternative considered: Single-pass commit-to-target assignment only; rejected because top-level changed target reporting becomes less explicit.

4. Conventional commit normalization layer
- Decision: Parse commit subject/body into a normalized model with strict and non-strict modes.
- Rationale: Required for consistent bump logic, changelog rendering, and typed JSON output.
- Alternative considered: Changelog generation directly from raw messages; rejected because bump decisions and validation would be inconsistent.

5. Manifest adapter pattern for version I/O
- Decision: Implement dedicated adapters for `package.json`, `Cargo.toml`, and `pyproject.toml`.
- Rationale: Keeps version extraction/updating explicit per format and enables precise error messages.
- Alternative considered: Generic regex mutation; rejected because it is brittle and unsafe for TOML layouts.

6. Release PR branch regeneration strategy
- Decision: Treat release branches as automation-owned, recreate them from current base state, apply version updates once, and force-push one release commit.
- Rationale: Guarantees clean PR history and idempotent updates.
- Alternative considered: Append new release commits; rejected because stale release commits accumulate and drift from base.

7. Output-first internal contract
- Decision: Build an internal `TargetAnalysisResult` structure and render all outputs from it.
- Rationale: One canonical model reduces mismatch across CLI logs, JSON outputs, and PR body markdown.
- Alternative considered: Independent renderers over raw intermediate data; rejected due to increased inconsistency risk.

## Risks / Trade-offs

- [Risk] Git history is shallow, making ref resolution incomplete. -> Mitigation: fail fast with actionable message recommending `actions/checkout` with `fetch-depth: 0`.
- [Risk] GitHub username lookups can fail or hit API limits. -> Mitigation: fallback to author name and continue without blocking changelog generation.
- [Risk] Force-pushing automation branches can overwrite manual edits. -> Mitigation: document branch ownership and include explicit log warnings in release PR mode.
- [Risk] TOML parsing/writing may reformat files unexpectedly. -> Mitigation: use stable parser/writer behavior and add fixture-based tests for representative manifests.
- [Risk] Shared-path targets can cause wider release blast radius. -> Mitigation: keep path config explicit and report `matchedFiles` per target for auditability.

## Migration Plan

1. Implement analysis-only mode first (`create-release-pr=false`) and validate outputs in CI.
2. Add release PR mode behind explicit opt-in input and test in a non-production repository.
3. Roll out to production workflows with branch protections allowing automation on release branches.
4. Document operational playbooks for no-bump policies, strict-mode failures, and shallow-clone remediation.
5. Monitor logs for skipped targets and bump decisions before making release PR mode default in downstream workflows.

## Open Questions

- Should configuration be provided exclusively as structured action input, or also support repository file discovery by default?
- Should `refactor` default to patch or none in bump mapping for initial release?
- Should changelog entries include PR numbers when discoverable, or remain commit-centric in v1?
