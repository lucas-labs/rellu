## MODIFIED Requirements

### Requirement: Changelog rendering SHALL group commits by category
The system SHALL render markdown changelog sections using category mappings based on parsed conventional commit types. Category mapping and section ordering SHALL be user-configurable, and the system SHALL apply a sensible default mapping/order when no custom configuration is provided.

#### Scenario: Commits are grouped into default sections when no mapping is provided
- **WHEN** relevant commits include `feat`, `fix`, and `docs` types and no changelog mapping input is configured
- **THEN** the changelog contains Features, Bug Fixes, and Documentation sections using default mapping

#### Scenario: Commits are grouped into configured sections
- **WHEN** the user configures mapping such that `feat` maps to `Enhancements` and `fix` maps to `Maintenance`
- **THEN** commits of those types are rendered under `Enhancements` and `Maintenance` respectively

#### Scenario: Configured section ordering is honored
- **WHEN** the user configures section order as `Maintenance`, `Enhancements`, `Other`
- **THEN** rendered sections appear in that order before any deterministic fallback sections

#### Scenario: Invalid mapping configuration fails fast
- **WHEN** changelog mapping/order input is malformed (for example non-JSON, empty section names, or duplicate ordered section names)
- **THEN** the action fails with a clear validation error before analysis output is generated

### Requirement: Output generation SHALL be deterministic for identical inputs
For identical refs, config, and repository state, the rendered markdown and JSON outputs MUST be byte-for-byte stable, including when custom changelog mapping and section ordering are provided.

#### Scenario: Repeated run over same refs with custom mapping
- **WHEN** the action runs twice against identical commit range and identical changelog mapping/order configuration
- **THEN** output values are identical across both runs
