## ADDED Requirements

### Requirement: Manifest path resolution SHALL remain inside repository workspace
Configured version manifest paths MUST resolve to files within the checked-out repository workspace before any read or write operation is attempted. Paths that resolve outside workspace boundaries MUST fail fast with an actionable validation error that includes target label and configured path.

#### Scenario: Relative traversal escapes repository workspace
- **WHEN** a target manifest path resolves outside the repository root (for example via `../` traversal)
- **THEN** the action fails before reading or writing the manifest and reports the target label and invalid path

#### Scenario: In-workspace manifest path is accepted
- **WHEN** a target manifest path resolves to a file within the repository root
- **THEN** manifest read/write operations proceed normally for that target
