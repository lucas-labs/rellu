## Why

Two security-sensitive gaps remain: manifest file paths can escape the repository workspace, and changelog/PR markdown is built from user-controlled commit content without escaping. These issues can lead to unintended file writes on runners and markdown injection in release PRs.

## What Changes

- Enforce repository-workspace confinement for all configured manifest read/write paths used in version bumping.
- Fail fast with clear errors when a target manifest path resolves outside the checked-out repository.
- Sanitize/escape user-controlled changelog fields (description, scope, contributor display) before markdown rendering.
- Ensure release PR bodies use escaped markdown output so mentions/injection payloads cannot be triggered by crafted commit messages.
- Add regression tests for out-of-workspace path attempts and markdown escaping behavior.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `multi-ecosystem-version-file-updates`: manifest path handling requirements are tightened to require workspace-bounded read/write operations.
- `changelog-and-output-generation`: changelog rendering requirements are updated to require markdown escaping of user-controlled commit-derived fields.
- `per-target-release-pr-automation`: release PR body synchronization requirements are updated to use sanitized markdown content.

## Impact

- Affected code: manifest path resolution/validation, changelog rendering utilities, and release PR body generation flow.
- APIs/config: no new inputs; invalid manifest paths now fail explicitly.
- Security posture: prevents writes outside repository checkout and reduces markdown injection/unwanted mention risk.
- Testing/docs: adds coverage and documentation for path-boundary enforcement and markdown escaping guarantees.
