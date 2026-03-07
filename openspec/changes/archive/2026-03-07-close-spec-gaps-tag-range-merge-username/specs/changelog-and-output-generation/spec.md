## MODIFIED Requirements

### Requirement: Changelog entries SHALL include contributor display and commit identity
Each changelog entry MUST include the commit description, a contributor display value resolved through ordered fallback (`@githubUsername` from commit association, then email-based username lookup when available, then author name), and commit SHA reference.

#### Scenario: Username is resolved from commit association
- **WHEN** commit metadata includes an associated GitHub login
- **THEN** the changelog entry uses `@<login>` as contributor display

#### Scenario: Username is resolved via author email fallback
- **WHEN** commit association login is missing and author email resolves to a GitHub user via API
- **THEN** the changelog entry uses `@<resolved-login>` as contributor display

#### Scenario: Username cannot be resolved from association or email
- **WHEN** no GitHub username can be resolved from commit association or email
- **THEN** the changelog entry uses author name as contributor display instead of `@username`
