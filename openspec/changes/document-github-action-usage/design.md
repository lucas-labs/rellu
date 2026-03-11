## Context

Rellu currently exposes rich functionality through `action.yml`, the config schema (`src/action/config/schema.ts`), and release workflow behavior, but the top-level `README.md` only contains a short product summary. Users must inspect source files to understand setup, inputs, config format, and outputs, which increases onboarding time and integration errors.

This change is documentation-focused and does not alter runtime logic. The main objective is to produce a single, accurate README that can serve as the primary user guide for adopting the GitHub Action.

## Goals / Non-Goals

**Goals:**
- Provide a complete README that explains what the action does, how to install it, and how to run it in a workflow.
- Document every action input and output with defaults, required status, and behavior notes.
- Document `.github/rellu.json` structure with realistic single-target and multi-target examples.
- Add troubleshooting guidance for common failures (shallow checkout, invalid refs, invalid conventional commits, malformed config).
- Keep README content tightly aligned with current implementation and existing action metadata.

**Non-Goals:**
- Changing action behavior, interfaces, or output contracts.
- Introducing new action inputs, outputs, or config schema fields.
- Adding separate documentation sites or docs tooling.

## Decisions

### Decision: Treat `README.md` as the canonical end-user entry point
Rationale:
- GitHub renders README first and users expect copy/paste-ready examples there.
- A single canonical page reduces drift compared with splitting basic usage across multiple files.

Alternatives considered:
- Add separate docs files only: rejected because discoverability is worse for first-time action adopters.
- Generate docs automatically from schema: rejected for now because it adds tooling complexity and still requires narrative guidance.

### Decision: Source README facts from implementation artifacts
Rationale:
- `action.yml` is the authoritative definition of action inputs/outputs.
- `src/action/config/schema.ts` is the authoritative definition of config file fields and defaults.
- Reusing these as source inputs reduces documentation mismatch risk.

Alternatives considered:
- Write docs from memory/intent: rejected due to high risk of stale defaults and missing options.

### Decision: Document by user journey, then reference tables
Rationale:
- Users need a fast path (what it does, minimal workflow, sample config) before exhaustive reference details.
- Journey-first sections improve adoption while tables remain available for precision.

Alternatives considered:
- Reference-only README tables: rejected because users still need contextual guidance for setup and troubleshooting.

### Decision: Include operational caveats explicitly in troubleshooting
Rationale:
- Known runtime pitfalls (for example `fetch-depth`, strict conventional commits, release PR branch behavior) are frequent integration blockers.
- Explicit “symptom -> likely cause -> fix” guidance reduces issue churn.

Alternatives considered:
- Keep caveats implicit in input descriptions: rejected because important operational constraints get buried.

## Risks / Trade-offs

- [Risk] README can drift from `action.yml` and schema as new options are added.
  - Mitigation: During this change, verify all documented inputs/outputs against current files and add a maintenance task to keep docs updated with interface changes.

- [Risk] README grows large and harder to scan.
  - Mitigation: Use a concise table of contents and sectioned layout (quick start, config, reference, troubleshooting).

- [Risk] Examples may imply unsupported workflows.
  - Mitigation: Keep examples within currently implemented behavior and avoid speculative patterns.

## Migration Plan

1. Replace the current README stub with a full structured document.
2. Validate all documented input/output names and defaults against `action.yml`.
3. Validate config examples against `src/action/config/schema.ts` and existing test fixtures.
4. Run formatting/lint checks used by the repository for markdown consistency, if configured.
5. Submit in a single documentation-focused PR with no runtime code changes.

Rollback strategy:
- Revert README changes if incorrect guidance is discovered post-merge; runtime behavior remains unaffected.

## Open Questions

- Should the README include a pinned action version example (`@v1`) now, or keep a repository-local reference until first public release tag strategy is finalized?
- Should we include an advanced section for per-target `releasePr` overrides in the first pass, or keep it in a concise appendix to avoid overwhelming new users?
