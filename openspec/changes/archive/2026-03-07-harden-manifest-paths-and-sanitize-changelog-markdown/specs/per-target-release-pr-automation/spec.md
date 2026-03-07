## ADDED Requirements

### Requirement: Release PR body updates SHALL use sanitized changelog markdown
When release PR mode creates or updates PR bodies, the body content MUST be sourced from sanitized changelog markdown output so commit-derived user content cannot inject unsafe markdown or unintended mentions.

#### Scenario: Release PR body update includes commit-derived special characters
- **WHEN** releasable commits contain markdown-special characters or mention-like text
- **THEN** the created or updated PR body contains escaped markdown-safe content for those fields
