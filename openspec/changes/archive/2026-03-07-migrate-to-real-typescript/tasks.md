## 1. Build Toolchain Migration

- [x] 1.1 Add Bun + TypeScript + tsdown dependencies and migrate package scripts to Bun-based execution (`bun run build`, `bun run typecheck`, `bun run test`).
- [x] 1.2 Replace legacy `scripts/build.mjs` passthrough logic with `tsdown` build configuration and output settings for `dist/`.
- [x] 1.3 Update `tsconfig` to strict typed settings aligned with Node ESM action runtime.
- [x] 1.4 Verify `action.yml` still points to valid compiled entrypoint and remains Node runtime based after migration.

## 2. Shared Type System Foundation

- [x] 2.1 Create shared type definitions for config models, commit metadata, target analysis results, changelog entries, and release PR state.
- [x] 2.2 Replace JSDoc typedef-only patterns with native TypeScript `type`/`interface` declarations across utility and domain boundaries.
- [x] 2.3 Enable compiler checks that prevent implicit `any` in production source files.

## 3. Module-by-Module Source Conversion

- [x] 3.1 Convert utility modules (`utils/*`) to real TypeScript signatures with explicit parameter/return types.
- [x] 3.2 Convert config and git modules to typed parsing/normalization flows with safe external input handling.
- [x] 3.3 Convert commit parsing, bump policy, semver, targets, and changelog modules to typed APIs.
- [x] 3.4 Convert orchestration modules (`analyze`, `release-pr`, `output`, `index`) to typed integration contracts without behavior regressions.

## 4. Output and Runtime Compatibility Validation

- [x] 4.1 Confirm the compiled action still emits unchanged top-level outputs (`changed-targets`, `has-changes`, `result-json`, `release-prs-created`).
- [x] 4.2 Validate that per-target JSON/changelog shapes remain behaviorally compatible with existing specs.
- [x] 4.3 Check deterministic build behavior by running repeated builds and verifying stable output structure.

## 5. Tests and Fixtures Alignment

- [x] 5.1 Update unit/integration tests to consume typed module exports after migration.
- [x] 5.2 Add/adjust tests that specifically guard against implicit-any regressions and type-unsafe contract drift.
- [x] 5.3 Ensure fixture-based integration scenarios still pass with the new compiled output.

## 6. Quality Gates and Documentation

- [x] 6.1 Update CI workflow to require Bun-based build + typecheck + runtime tests.
- [x] 6.2 Add Husky pre-commit hook that runs build and blocks commit on build failure.
- [x] 6.3 Update README/developer docs to reflect real TypeScript workflow, Bun commands, and pre-commit expectations.
- [x] 6.4 Remove obsolete pseudo-TypeScript guidance and legacy build notes from project docs/config.
- [x] 6.5 Run full verification (`bun run build`, `bun run typecheck`, `bun run test`) and capture final migration readiness.
