## ADDED Requirements

### Requirement: Local development scripts SHALL include explicit type-check execution
Project scripts MUST include a dedicated type-check command that validates the full TypeScript source graph without relying solely on runtime tests.

#### Scenario: Developer runs local quality commands
- **WHEN** local validation scripts are executed
- **THEN** type-check is run and fails fast on compile-time type errors

### Requirement: CI pipeline MUST gate merges on type safety
Continuous integration MUST execute build and type-check steps and fail the workflow if TypeScript compilation errors occur.

#### Scenario: Pull request introduces type regression
- **WHEN** CI runs on the pull request branch
- **THEN** the workflow fails before merge if TypeScript type-check reports errors

### Requirement: Test workflow SHALL remain active alongside type-checking
Type-checking MUST complement, not replace, existing runtime unit/integration tests.

#### Scenario: CI quality gate execution
- **WHEN** CI validates a commit
- **THEN** both type-checking and runtime tests are executed as required checks

### Requirement: Build and quality instructions SHALL document typed workflow expectations
Project documentation MUST describe how to run build/typecheck/test commands and explain that `.ts` files are now true TypeScript source.

#### Scenario: New contributor follows setup docs
- **WHEN** a contributor reads project development instructions
- **THEN** they can run the expected typed workflow commands without guessing legacy behavior

### Requirement: Husky pre-commit hook SHALL enforce successful build before commit
The repository MUST configure Husky so `pre-commit` executes a build command and blocks commit completion when build fails.

#### Scenario: Commit is attempted with failing build
- **WHEN** a contributor runs `git commit` and the build step fails
- **THEN** Husky prevents the commit from being created

### Requirement: Pre-commit build SHALL keep distributable artifacts current
The pre-commit build flow MUST ensure `dist` artifacts are regenerated from current source before commit so committed distribution files stay in sync.

#### Scenario: Source changes require dist updates
- **WHEN** a contributor commits source changes that affect build output
- **THEN** the pre-commit build refreshes `dist` before the commit is finalized
