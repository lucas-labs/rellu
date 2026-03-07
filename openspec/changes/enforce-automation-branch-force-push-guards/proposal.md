## Why

Release PR mode currently force-pushes to a branch name derived from configurable values without a hard policy guard to ensure that branch is automation-owned. A misconfigured prefix can therefore point force-push operations at non-release branches, violating the project security requirement.

## What Changes

- Add a hard guard that validates force-push targets are automation-owned release branches before any destructive git push is executed.
- Define explicit branch safety validation rules for release PR mode (for example disallow empty/unsafe prefixes and reserved branch names).
- Fail fast with clear security-focused error messages when branch safety checks fail.
- Add tests covering safe and unsafe branch configurations to prevent regression.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `per-target-release-pr-automation`: strengthen release branch safety requirements so force-push is only allowed for automation-owned branches validated by policy.

## Impact

- Affected code: release PR branch naming/validation and push execution path.
- Security posture: prevents destructive pushes to non-release branches caused by misconfiguration.
- Tests: add negative and positive safety-case coverage.
- Docs: clarify branch safety constraints for release PR configuration.
