## 1. Dependency and Runtime Boundary Setup

- [x] 1.1 Add `@actions/core`, `@actions/github`, `@actions/io`, and `@actions/exec` to dependencies and ensure lockfile updates are committed.
- [x] 1.2 Introduce thin runtime adapter modules for toolkit usage (core I/O/logging/failure, command execution, filesystem helpers, and authenticated GitHub client initialization).
- [x] 1.3 Add or update shared types/interfaces so toolkit adapters can be consumed without leaking vendor-specific details across domain modules.

## 2. Core Action Runtime Migration

- [x] 2.1 Migrate input/config resolution boundaries to use `@actions/core` input APIs while preserving existing defaults and validation behavior.
- [x] 2.2 Migrate action output emission to `@actions/core.setOutput` while preserving output names and payload formats.
- [x] 2.3 Migrate runtime logging and fatal failure signaling to toolkit primitives (`info`/`warning`/`error`/failure APIs) without changing analysis logic.
- [x] 2.4 Migrate command execution utilities (including git command invocation paths) to `@actions/exec` while preserving output capture and error semantics.
- [x] 2.5 Migrate supported runner filesystem helper operations to `@actions/io` while preserving existing behavior.

## 3. Release PR API Migration

- [x] 3.1 Implement authenticated GitHub client creation with `@actions/github.getOctokit` using action runtime credentials.
- [x] 3.2 Replace custom release PR HTTP operations with toolkit client calls for PR query/create/update while preserving branch/title/body behavior.
- [x] 3.3 Normalize API error handling so release PR failures remain diagnosable and consistent with existing action expectations.

## 4. Behavior Regression Coverage

- [x] 4.1 Update unit tests to mock toolkit adapters and verify unchanged output contract (`changed-targets`, `has-changes`, `result-json`, `release-prs-created`).
- [x] 4.2 Add release PR-focused tests that assert toolkit client usage and metadata synchronization behavior.
- [x] 4.3 Run and update integration fixtures to confirm no regressions in target analysis and release PR automation semantics.

## 5. Documentation and Verification

- [x] 5.1 Update README/developer docs to describe toolkit dependency usage and runtime conventions.
- [x] 5.2 Run full verification (`bun run build`, `bun run typecheck`, `bun run test`) and record migration readiness.
