## MODIFIED Requirements

### Requirement: Test workflow SHALL remain active alongside type-checking
Type-checking MUST complement, not replace, existing runtime unit/integration tests. The automated test suite MUST include explicit coverage for documented high-risk behaviors, including tag-prefix range resolution, strict-mode merge handling, release-branch regeneration semantics, and changelog markdown escaping expectations.

#### Scenario: CI quality gate execution
- **WHEN** CI validates a commit
- **THEN** both type-checking and runtime tests are executed as required checks

#### Scenario: Tag-prefix range resolution behavior is covered by automated tests
- **WHEN** analysis uses latest-tag-with-prefix range strategy across target-specific prefixes
- **THEN** automated tests verify each target resolves from its own matching tag baseline

#### Scenario: Strict mode merge behavior is covered by automated tests
- **WHEN** strict conventional commit mode analyzes ranges containing merge commits and valid non-merge conventional commits
- **THEN** automated tests verify merge commit subjects alone do not trigger strict-mode failure

#### Scenario: Release branch regeneration semantics are covered by automated tests
- **WHEN** release PR update flow runs against an existing release branch with prior generated and manual commits
- **THEN** automated tests verify branch reset/regeneration leaves exactly one fresh release commit for the target

#### Scenario: Changelog markdown escaping behavior is covered by automated tests
- **WHEN** changelog rendering processes commit content containing markdown-special characters
- **THEN** automated tests verify rendered markdown preserves expected escaping semantics
