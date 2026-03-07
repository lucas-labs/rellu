## MODIFIED Requirements

### Requirement: Release PR metadata SHALL stay synchronized with analysis
The system SHALL create or update PR title and body from computed target version and generated markdown changelog on every release PR run, and SHALL execute those GitHub read/write operations through an authenticated `@actions/github` client initialized from action runtime credentials.

#### Scenario: Changelog changes between runs
- **WHEN** new relevant commits alter target changelog content
- **THEN** the existing release PR body is updated to the new generated markdown

#### Scenario: Toolkit GitHub client is used for PR mutation operations
- **WHEN** release PR mode creates or updates a PR for a releasable target
- **THEN** the action performs the API operations through the initialized toolkit GitHub client for the current repository context
