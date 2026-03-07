## Why

The project specification requires changelog section/category mapping to be configurable, but the current implementation hardcodes both mapping and section ordering. This gap blocks teams from matching changelog output to their release conventions and creates divergence from documented behavior.

## What Changes

- Add user-configurable changelog category mapping input/config support with a safe default behavior.
- Support configurable section ordering while preserving deterministic output.
- Keep the existing default mapping (feat/fix/docs/etc.) when no custom mapping is provided.
- Validate user-provided mapping and fail with clear errors for malformed or conflicting definitions.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `changelog-and-output-generation`: Make changelog category/section mapping configurable by user input while preserving deterministic rendering and sensible defaults.

## Impact

- Affected code: changelog rendering, action/config input parsing, and validation paths.
- APIs/config: new optional input/config field for changelog mapping (and optional ordering).
- Tests: add coverage for default behavior, custom mapping behavior, validation failures, and deterministic ordering.
- Documentation: update action inputs and README examples for configurable changelog categories.
