## Why

Monorepos with independently released apps need a deterministic way to decide what changed, what version should bump, and what release notes belong to each app. We need this now to remove manual release triage and provide a reusable GitHub Action foundation for per-app release workflows.

## What Changes

- Create a TypeScript GitHub Action that analyzes a configurable git ref range and determines which configured app targets changed.
- Add per-target commit relevance resolution based on path ownership, including shared paths that affect multiple targets.
- Parse conventional commits (including scopes, `!`, and `BREAKING CHANGE`) and compute each target's next semantic version from configurable bump rules.
- Generate per-target markdown changelogs and structured machine-readable outputs for downstream workflows.
- Support reading and updating versions in `package.json`, `Cargo.toml`, and `pyproject.toml`.
- Add optional automation to create or update one persistent release PR per target using deterministic branch naming and a single regenerated release commit.
- Provide clear validation, error handling, and logging for shallow clones, missing manifest versions, invalid commit formats in strict mode, and unsupported Python version layouts.

## Capabilities

### New Capabilities
- `target-impact-analysis`: Resolve commit/file changes in a git range and map them to changed app targets using configured path globs.
- `conventional-commit-and-bump-resolution`: Parse relevant commits per target and derive bump decisions and next versions with configurable rules.
- `changelog-and-output-generation`: Produce app-scoped markdown changelogs and standardized action outputs (`changed-targets`, `has-changes`, `result-json`).
- `multi-ecosystem-version-file-updates`: Read and write versions for Node, Rust, and Python manifests with explicit error behavior.
- `per-target-release-pr-automation`: Create/update one release PR per changed releasable target by regenerating the release branch from base and force-pushing one release commit.

### Modified Capabilities

None.

## Impact

- Adds a new JavaScript GitHub Action codebase (TypeScript source + compiled distribution).
- Introduces modules for config loading, git inspection, commit parsing, target matching, semver handling, changelog rendering, GitHub PR operations, and output serialization.
- Requires GitHub token usage for username resolution and optional release PR operations.
- Affects CI workflows that consume release analysis outputs and may opt into release PR mode.
