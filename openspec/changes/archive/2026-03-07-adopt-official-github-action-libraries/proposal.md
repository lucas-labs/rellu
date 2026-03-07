## Why

The action currently reimplements functionality already provided by the official GitHub Actions toolkit, including input/output handling, logging patterns, command execution, and GitHub API integration. Adopting battle-tested `@actions/*` libraries now will reduce maintenance burden, remove custom edge-case code, and improve long-term reliability.

## What Changes

- Replace custom input/output and logging plumbing with `@actions/core` primitives (`getInput`, `setOutput`, `info`, `warning`, `error`, grouped logs, and failure signaling).
- Replace custom GitHub API request logic with `@actions/github` (`getOctokit`) for release PR queries and mutations.
- Replace custom command execution plumbing (for example `git` operations) with `@actions/exec`.
- Adopt `@actions/io` for runner-oriented filesystem utilities where applicable.
- Standardize error handling and action failure reporting around toolkit conventions while preserving existing output contracts.
- Refactor affected modules to depend on thin local adapters over `@actions/*` packages so code remains testable.
- Update tests and docs to reflect toolkit-backed behavior and required environment assumptions.

## Capabilities

### New Capabilities
- `official-actions-toolkit-integration`: The action uses official GitHub Actions toolkit libraries for runtime interaction (inputs, outputs, logging, failures, and GitHub API access) instead of custom reinventions.

### Modified Capabilities
- `per-target-release-pr-automation`: Release PR API interactions are routed through the official GitHub Actions GitHub client while preserving existing release PR behavior.

## Impact

- Affected code: action runtime boundary modules (config/input resolution, output writing, logging, command execution, release PR API integration), plus related tests.
- Dependencies: add and wire `@actions/core`, `@actions/github`, `@actions/io`, and `@actions/exec`.
- Systems: GitHub Actions execution environment and API communication path.
- Compatibility: no intentional change to existing action outputs or release decision logic.
