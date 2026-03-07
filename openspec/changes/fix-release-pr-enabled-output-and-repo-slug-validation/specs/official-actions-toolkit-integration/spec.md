## ADDED Requirements

### Requirement: Repository slug parsing SHALL reject malformed owner/name values
Before initializing toolkit GitHub API operations, repository references MUST be validated as exactly `owner/name` with two non-empty segments. Values with missing segments or extra path segments MUST fail fast with a clear validation error.

#### Scenario: Repository slug has extra path segment
- **WHEN** repository reference input is `org/repo/extra`
- **THEN** the action fails validation before API calls and reports expected `owner/name` format

#### Scenario: Repository slug has missing owner or name
- **WHEN** repository reference input is `/repo` or `org/`
- **THEN** the action fails validation before API calls and reports expected `owner/name` format
