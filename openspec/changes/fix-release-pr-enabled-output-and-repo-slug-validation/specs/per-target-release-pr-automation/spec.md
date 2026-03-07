## MODIFIED Requirements

### Requirement: Non-releasable targets SHALL be skipped in release PR mode
Targets with `changed=false` or no releasable next version under active no-bump policy MUST NOT create or update release PRs. For skipped targets, per-target output metadata MUST NOT imply a release PR exists.

#### Scenario: Changed target skipped by no-bump skip policy
- **WHEN** target changed only through non-bump-worthy commits and policy is `skip`
- **THEN** no release PR is created for that target and skip reason is logged

#### Scenario: Skipped target does not advertise enabled release PR metadata
- **WHEN** release PR mode is enabled but a target is non-releasable and no PR create/update operation runs
- **THEN** that target's `releasePr` metadata reports `enabled=false` and does not include PR identity fields
