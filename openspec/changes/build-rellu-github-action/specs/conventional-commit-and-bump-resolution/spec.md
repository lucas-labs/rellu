## ADDED Requirements

### Requirement: Relevant commits SHALL be parsed as normalized conventional commits
For each target, the system SHALL parse relevant commits into normalized fields including `type`, `scope`, `description`, `isBreaking`, `rawSubject`, `body`, and parsed footers.

#### Scenario: Breaking commit with scope and footer is parsed
- **WHEN** a relevant commit subject is `feat(app-x)!: redesign API` and the body includes `BREAKING CHANGE: removes v1 endpoint`
- **THEN** the parsed commit indicates `type=feat`, `scope=app-x`, and `isBreaking=true`

### Requirement: Gitmoji and non-core decorations SHALL NOT invalidate valid commit parsing
The parser MUST accept valid conventional commit structure even when emoji or additional text decoration appears in the subject or body.

#### Scenario: Conventional commit includes gitmoji
- **WHEN** a relevant commit subject is `refactor: 🔨 simplify parser state machine`
- **THEN** the commit is parsed with `type=refactor` and classified as valid

### Requirement: Strict mode SHALL fail on invalid relevant commit formats
When strict mode is enabled, the action MUST fail if any relevant commit for a changed target is not parseable as a valid conventional commit.

#### Scenario: Invalid commit appears in strict mode
- **WHEN** a relevant commit subject is `updated files`
- **THEN** the action fails with a message identifying the target and offending commit

### Requirement: Non-strict mode SHALL classify invalid relevant commits as other
When strict mode is disabled, invalid relevant commits MUST be preserved and classified as `other` for downstream changelog and bump processing.

#### Scenario: Invalid commit appears in non-strict mode
- **WHEN** a relevant commit subject does not match conventional format
- **THEN** the commit remains in the target result with classification `other`

### Requirement: Bump resolution SHALL use highest-priority applicable bump
For each changed target, the system SHALL compute bump level using configured mappings and choose highest priority in order `major > minor > patch > none`.

#### Scenario: Mixed commit types produce minor bump
- **WHEN** relevant commits for a target include one `feat` and multiple `fix`
- **THEN** the target bump is resolved as `minor`

### Requirement: No-bump policy SHALL be configurable per run
If a target is changed but has no bump-worthy commits, the system MUST apply configured no-bump policy `skip`, `keep`, or `patch`.

#### Scenario: Changed target with no bump-worthy commits and patch policy
- **WHEN** only docs/chore commits affect a changed target and no-bump policy is `patch`
- **THEN** the target bump resolves to `patch`
