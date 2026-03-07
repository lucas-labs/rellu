## Why

The current custom glob matcher supports only a narrow subset of glob syntax, while users expect standard monorepo glob behavior. This mismatch causes silently incorrect target change detection when teams use brace patterns, character classes, or other common glob features.

## What Changes

- Replace custom path glob matching with a mature glob library that supports standard glob syntax expected in monorepos.
- Define and enforce clear glob semantics for target `paths` matching.
- Fail fast on invalid glob configuration instead of silently treating unsupported syntax as non-matches.
- Add regression tests covering advanced glob patterns and compatibility with existing `*`, `**`, and `?` behavior.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `target-impact-analysis`: path matching requirements are updated to use standard glob semantics and explicit invalid-pattern validation behavior.

## Impact

- Affected code: path matching utilities, target change detection logic, and config validation path.
- Dependencies: introduces/uses a mature glob dependency for matching.
- Behavior: advanced patterns now behave as users expect; malformed patterns fail early with clear errors.
- Testing/docs: add coverage and documentation for supported glob syntax.
