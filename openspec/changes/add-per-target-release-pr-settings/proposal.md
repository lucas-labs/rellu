## Why

The project description requires optional release PR behavior settings at the app-target level, but the current schema only supports global release PR controls. This prevents mixed monorepo workflows where some targets require different release PR behavior than others.

## What Changes

- Extend target configuration schema to accept optional per-target release PR settings.
- Define precedence rules between global release PR settings and per-target overrides.
- Ensure per-target release PR automation logic uses target-level settings when present and global defaults otherwise.
- Add validation and clear error messages for invalid per-target release PR settings.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `target-impact-analysis`: target configuration requirements are expanded to include optional per-target release PR settings.
- `per-target-release-pr-automation`: release PR behavior requirements are updated to support per-target overrides with deterministic precedence over global settings.

## Impact

- Affected code: target config types/parsing, release PR planning/execution logic, and validation paths.
- APIs/config: target schema gains optional release PR settings fields.
- Tests: new coverage for per-target override behavior, fallback-to-global behavior, and invalid configuration handling.
- Docs: README and action/config documentation must describe per-target release PR settings and precedence.
