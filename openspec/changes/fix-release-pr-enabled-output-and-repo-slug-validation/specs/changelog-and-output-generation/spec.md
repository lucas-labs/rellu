## MODIFIED Requirements

### Requirement: Result JSON SHALL include complete per-target analysis fields
Each target object in `result-json` MUST include label, changed state, matched files, bump outcome, current and next versions, relevant commits, rendered changelog markdown, and release PR metadata when applicable. Release PR metadata MUST represent actual per-target PR state and MUST NOT indicate `enabled=true` for targets where no release PR was created or updated.

#### Scenario: Target JSON contains required analysis fields
- **WHEN** a target has releasable changes
- **THEN** its JSON object includes `label`, `changed`, `matchedFiles`, `bump`, `currentVersion`, `nextVersion`, `commits`, and `changelog.markdown`

#### Scenario: Skipped target release PR metadata reflects no PR activity
- **WHEN** release PR mode is active and a target is skipped as non-releasable
- **THEN** the target output does not present release PR metadata that implies a PR was created or updated
