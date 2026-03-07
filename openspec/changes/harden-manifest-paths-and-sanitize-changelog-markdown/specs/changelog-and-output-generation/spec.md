## ADDED Requirements

### Requirement: Changelog markdown SHALL escape user-controlled commit content
The system MUST escape markdown-sensitive and mention-triggering characters in user-controlled commit-derived fields used for changelog entries, including commit description, scope text, and contributor display, before rendering markdown output.

#### Scenario: Commit description contains markdown metacharacters
- **WHEN** a relevant commit description includes markdown control characters or mention-like tokens
- **THEN** rendered changelog markdown includes escaped content that preserves text meaning without triggering unintended markdown behavior

#### Scenario: Contributor display contains mention text
- **WHEN** contributor display text contains raw `@` mention patterns from commit-derived data
- **THEN** rendered changelog output escapes the mention-sensitive content to avoid unintended notifications
