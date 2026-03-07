## MODIFIED Requirements

### Requirement: Strict mode SHALL fail on invalid relevant commit formats
When strict mode is enabled, the action MUST fail if any relevant non-merge commit for a changed target is not parseable as a valid conventional commit. Deterministic merge handling MUST NOT cause strict-mode failure solely because a merge commit subject is non-conventional. Strict mode configuration SHALL accept both native boolean config-file values and boolean strings.

#### Scenario: Invalid non-merge commit appears in strict mode
- **WHEN** a relevant non-merge commit subject is `updated files`
- **THEN** the action fails with a message identifying the target and offending commit

#### Scenario: Conventional merge subject noise does not fail strict mode
- **WHEN** a relevant merge commit subject is `Merge pull request #123 from feature/x` and relevant non-merge commits are valid conventional commits
- **THEN** strict mode does not fail solely due to the merge subject

#### Scenario: Native JSON boolean enables strict mode
- **WHEN** config-file sets `strictConventionalCommits` to boolean `true`
- **THEN** strict mode is enabled for commit validation
