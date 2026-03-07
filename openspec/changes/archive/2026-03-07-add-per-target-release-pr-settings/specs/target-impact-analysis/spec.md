## MODIFIED Requirements

### Requirement: Target configuration SHALL define releasable ownership
The system SHALL accept a target configuration with a unique `label`, one or more `paths` globs, a `version` source descriptor, and optional per-target release PR behavior settings.

#### Scenario: Valid target map is loaded
- **WHEN** the action starts with a config containing multiple targets
- **THEN** the action validates required fields and unique labels before analysis begins

#### Scenario: Target includes optional release PR behavior settings
- **WHEN** a target defines `releasePr` settings (for example `enabled`, `branchPrefix`, or `baseBranch`)
- **THEN** the action accepts the target config and exposes those values for release PR planning

#### Scenario: Target release PR behavior settings are invalid
- **WHEN** a target defines malformed `releasePr` settings
- **THEN** the action fails during config validation with a message identifying the target and invalid field
