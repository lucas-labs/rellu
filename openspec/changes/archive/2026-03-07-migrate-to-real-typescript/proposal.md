## Why

The repository currently uses `.ts` files as JavaScript source and a custom copy/rewrite build, which removes type-safety and makes refactors risky. We should migrate now to real TypeScript with a standard build toolchain so future feature work on Rellu is safer, easier to review, and less error-prone.

## What Changes

- Replace the current copy-based pseudo-TypeScript build with a real TypeScript pipeline using `tsdown`.
- Standardize repository package management and script execution on Bun (`bun install`, `bun run ...`) for local and CI workflows.
- Convert source files to true TypeScript syntax with explicit types for configs, commit models, analysis results, changelog data, and release PR orchestration.
- Introduce proper TypeScript compiler configuration and enforce type-checking in local scripts and CI.
- Keep GitHub Action runtime execution on Node (as supported by JavaScript actions) while using Bun only for development/build tooling.
- Add Husky pre-commit enforcement that runs a full build so `dist` stays current in committed changes.
- Update tests and fixtures to work with the new build output while preserving existing runtime behavior.
- Keep action behavior and outputs functionally equivalent unless correctness bugs are discovered during migration.

## Capabilities

### New Capabilities
- `real-typescript-toolchain`: Define requirements for building the action from real TypeScript sources with `tsdown`, Bun-managed workflows, deterministic JS output, and Node action runtime compatibility.
- `typed-domain-models-and-interfaces`: Define requirements for explicit type-safe contracts across config loading, git analysis, bump resolution, changelog generation, and release PR processing.
- `type-checked-quality-gates`: Define requirements for CI/local quality gates that enforce compilation/type-safety and Husky pre-commit build checks to keep `dist` up to date.

### Modified Capabilities

None.

## Impact

- Affects build and package tooling (`package.json`, Bun workflow, tsconfig, build scripts, CI workflow, Husky hooks).
- Affects most files under `src/` as they move from JS-in-TS files to fully typed TypeScript.
- May affect generated `dist/` structure and sourcemap/declaration outputs consumed by releases.
- Improves maintainability and correctness confidence for future changes in all existing functional capabilities.
