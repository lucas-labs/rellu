## Why

Two contract-quality gaps currently create misleading behavior: non-releasable targets can be emitted with `releasePr.enabled: true` even when no PR exists, and repository slug parsing accepts malformed values with extra path segments. These behaviors make downstream automation brittle and produce confusing GitHub API failures.

## What Changes

- Correct release PR result metadata so non-releasable/skipped targets do not advertise an enabled release PR state.
- Define explicit output semantics that distinguish "release PR mode enabled" from "release PR actually created/updated" for a target.
- Harden repository slug parsing to require exactly `owner/name` and fail fast on malformed values.
- Add validation/error-path tests and output contract tests for the corrected behaviors.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `per-target-release-pr-automation`: clarify output behavior for targets skipped in release PR mode so metadata cannot imply a PR exists when one was not created/updated.
- `changelog-and-output-generation`: tighten `result-json` per-target release PR metadata contract to represent actual PR state consistently.
- `official-actions-toolkit-integration`: require strict repository slug validation (`owner/name` only) before initializing GitHub API operations.

## Impact

- Affected code: release PR result assembly, output serialization contract assertions, and GitHub client repository parsing/validation.
- APIs/config: no new inputs; malformed repository slug values now fail early with clear errors.
- Behavior: consumers can reliably interpret `releasePr` metadata without inferring nonexistent PRs.
- Testing/docs: update tests and docs to lock output and validation behavior.
