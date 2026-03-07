## Why

Boolean values in JSON config for `strictConventionalCommits` and `createReleasePrs` are currently treated as empty strings and therefore ignored, unless users pass stringified booleans. This makes valid JSON config behave unexpectedly and can silently disable strict checks and release PR mode.

## What Changes

- Make config parsing accept native JSON booleans for `strictConventionalCommits` and `createReleasePrs`.
- Preserve string-based action input behavior (`"true"`/`"false"`) while adding consistent handling for boolean config-file values.
- Add explicit validation for unsupported types so misconfiguration fails clearly.
- Add tests for boolean parsing paths from config file and for global behavior impact (strict mode and release PR mode).

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `conventional-commit-and-bump-resolution`: strict-mode behavior requirements are clarified for boolean config-file enablement.
- `per-target-release-pr-automation`: release PR opt-in behavior requirements are clarified for boolean config-file enablement.

## Impact

- Affected code: config parsing helpers and boolean coercion logic.
- Behavior: JSON config booleans start behaving as expected without requiring string values.
- Tests: add coverage for native boolean, string boolean, and invalid-type cases.
- Docs: clarify accepted types for these config fields.
