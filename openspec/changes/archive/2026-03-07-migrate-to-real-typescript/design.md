## Context

The codebase currently stores JavaScript code in `.ts` files with JSDoc typing hints and uses a custom `scripts/build.mjs` file copier to produce `dist/`. This gives no compiler-enforced type safety and allows runtime-shape mismatches to slip through. The project now needs to become real TypeScript while keeping GitHub Action behavior stable.

Key constraints:
- Preserve existing action contract (inputs, outputs, runtime behavior).
- Keep build output consumable as a JavaScript GitHub Action running on Node runtime.
- Minimize migration risk while touching almost all source modules.
- Ensure CI enforces type correctness so pseudo-TypeScript does not regress.

## Goals / Non-Goals

**Goals:**
- Replace the custom copy/rewrite build with `tsdown` compiling real TypeScript to JavaScript.
- Standardize local/CI package management and script execution on Bun.
- Introduce explicit TypeScript types/interfaces across all domain modules.
- Enforce strict type-checking locally and in CI.
- Enforce a Husky pre-commit build to ensure committed `dist` artifacts are current.
- Keep runtime behavior and output schema consistent unless bug fixes are required.

**Non-Goals:**
- Redesigning release analysis algorithms or changing product scope.
- Switching runtime platform away from Node-based JavaScript action.
- Introducing unrelated architectural rewrites beyond type/toolchain migration.

## Decisions

1. Standardize on `tsdown` for build output
- Decision: Use `tsdown` as the single build entry for compiling `src/**/*.ts` into `dist/`.
- Rationale: It replaces ad-hoc file copying with deterministic compilation, aligns with modern TS workflows, and supports declaration output/sourcemaps as needed.
- Alternative considered: `tsc` only emit pipeline; rejected because `tsdown` better matches bundling/output ergonomics for action distribution.

2. Standardize development workflows on Bun
- Decision: Use Bun as the project package manager and script runner for local and CI commands (`bun install`, `bun run ...`).
- Rationale: A single fast package/script tool reduces workflow drift and simplifies migration instructions.
- Alternative considered: keep npm scripts for transition; rejected to avoid dual-tooling ambiguity.

3. Keep GitHub Action runtime on Node
- Decision: Preserve Node runtime execution in `action.yml` while using Bun only for development/build workflows.
- Rationale: JavaScript GitHub Actions execute on Node; changing runtime is out of scope and unnecessary for this migration.
- Alternative considered: runtime/tooling runtime unification; rejected because it conflicts with GitHub Action runtime expectations.

4. Enable strict TypeScript settings
- Decision: Configure strict compiler options (including `strict`, `noImplicitAny`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`) and fail builds on type errors.
- Rationale: Migration value depends on compile-time safety guarantees, not just syntax conversion.
- Alternative considered: permissive compiler migration first; rejected because it would keep hidden `any` gaps and delay correctness gains.

5. Convert JSDoc typedef patterns to first-class TS types
- Decision: Replace inline JSDoc typedefs with exported `type`/`interface` declarations in module-local or shared type modules.
- Rationale: Native TS types are easier to compose, refactor, and enforce across module boundaries.
- Alternative considered: keep JSDoc in `.ts` files; rejected because it preserves ambiguity and weak inference quality.

6. Introduce shared domain type boundaries
- Decision: Define canonical shared model types for config, commit metadata, target analysis results, changelog entries, and release PR state.
- Rationale: A single contract reduces duplication and catches cross-module drift at compile time.
- Alternative considered: keep per-file duplicated shapes; rejected due to high maintenance and mismatch risk.

7. Enforce Husky pre-commit build for distributable freshness
- Decision: Add Husky pre-commit hook that runs project build before commit completion.
- Rationale: Since compiled `dist` is committed for action distribution, hook enforcement keeps source and artifacts synchronized.
- Alternative considered: rely only on CI checks; rejected because stale `dist` can still be committed and break action consumers.

8. Strengthen quality gates in scripts and CI
- Decision: Add explicit `typecheck` step and enforce build+typecheck+tests in CI.
- Rationale: Prevents reintroduction of untyped patterns and protects future changes.
- Alternative considered: tests-only CI; rejected because many type regressions are not covered by runtime tests.

## Risks / Trade-offs

- [Risk] Migration introduces behavior drift while refactoring types. -> Mitigation: keep changes mechanical where possible and run existing test suite after each module group migration.
- [Risk] Strict TS flags create large initial error volume. -> Mitigation: migrate module-by-module with temporary transitional helpers, then ratchet to full strict.
- [Risk] Build output shape changes may break action entrypoint assumptions. -> Mitigation: lock `action.yml` runtime path and verify emitted `dist/index.js` contract.
- [Risk] New dependency/tooling (`tsdown`) affects release reproducibility. -> Mitigation: pin versions and document deterministic build command.
- [Risk] Pre-commit build hook increases commit latency for contributors. -> Mitigation: keep build deterministic/fast and document bypass policy for emergencies only.

## Migration Plan

1. Introduce Bun-based workflows with `tsdown`, TypeScript dependencies, and strict tsconfig with baseline scripts (`build`, `typecheck`).
2. Convert foundational utility modules and shared types first, then domain modules (`config`, `git`, `commits`, analysis pipeline).
3. Remove JSDoc-only typing patterns and replace with native TS declarations.
4. Add Husky pre-commit build hook so commits refresh `dist` artifacts.
5. Update tests/fixtures for typed APIs and ensure build output remains valid.
6. Update CI workflow to require Bun-based build + typecheck + test before merge.
7. Validate resulting `dist/` artifact and action metadata, then remove legacy copy-build script.

## Open Questions

- Should declaration files (`.d.ts`) be published in `dist/` or remain build-only internals?
- Do we want source maps in release artifacts by default for debugging action failures?
- Should strictest TS flags be enabled immediately or phased over one follow-up change if migration friction is high?
