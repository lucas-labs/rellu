## 1. Project Setup and Configuration Contract

- [x] 1.1 Scaffold the TypeScript JavaScript-action project structure (`src/`, `dist/`, `action.yml`, build/test scripts).
- [x] 1.2 Implement typed input/config loading for target definitions, ref settings, bump mappings, no-bump policy, and release PR options.
- [x] 1.3 Add configuration validation with clear errors for missing fields, duplicate labels, invalid globs, and unsupported manifest types.

## 2. Git Range and Target Impact Analysis

- [x] 2.1 Implement git ref resolution for configurable `from-ref` and `to-ref`, including clear failure behavior for shallow history.
- [x] 2.2 Implement commit collection to gather SHA, subject, body, author metadata, and changed files for each commit in range.
- [x] 2.3 Implement POSIX-normalized path matching against target globs and compute `changed`, `matchedFiles`, and `commitCount` per target.
- [x] 2.4 Implement deterministic merge-commit handling and add logging for resolved range and discovered commit counts.

## 3. Conventional Commit Parsing and Bump Resolution

- [x] 3.1 Implement conventional commit parser that extracts type, scope, description, emoji, footers, and breaking markers from subject/body.
- [x] 3.2 Implement strict vs non-strict behavior (fail on invalid relevant commits in strict mode, classify as `other` otherwise).
- [x] 3.3 Implement per-target bump resolution using configurable mapping with priority `major > minor > patch > none`.
- [x] 3.4 Implement no-bump policy handling for `skip`, `keep`, and `patch` and record explicit decision logs.

## 4. Version Adapters, Changelog, and Outputs

- [x] 4.1 Implement version read/write adapters for `package.json`, `Cargo.toml`, and `pyproject.toml` (`[project]` and `[tool.poetry]`).
- [x] 4.2 Implement semantic version calculation from resolved bump and current version with validation/error handling.
- [x] 4.3 Implement changelog grouping/rendering with default categories (Features, Bug Fixes, Documentation) and contributor fallback display.
- [x] 4.4 Build canonical per-target result model and wire GitHub Action outputs (`changed-targets`, `has-changes`, `result-json`, `release-prs-created`).

## 5. Release PR Automation

- [x] 5.1 Implement release PR mode gating so branch/PR mutations occur only when `create-release-pr=true`.
- [x] 5.2 Implement deterministic release branch naming and open PR discovery by branch/title markers.
- [x] 5.3 Implement branch regeneration workflow: reset from base, apply version updates, create one release commit, force-push.
- [x] 5.4 Implement PR create/update flow to keep title/body synchronized with computed version and generated changelog.
- [x] 5.5 Implement skip behavior for non-releasable targets and explicit warnings that release branches are automation-owned.

## 6. Testing, Fixtures, and Documentation

- [x] 6.1 Add unit tests for path matching, commit parsing, bump priority, no-bump policies, semver math, and manifest adapters.
- [x] 6.2 Add integration fixtures covering multi-target/shared-path scenarios, strict-mode failures, and release-branch regeneration idempotency.
- [x] 6.3 Add action usage documentation with required checkout depth, input examples, output schema, and release PR behavior caveats.
- [x] 6.4 Build and verify distributable action artifacts and run the full test suite in CI.
