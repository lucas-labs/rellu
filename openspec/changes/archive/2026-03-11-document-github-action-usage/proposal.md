## Why

The repository ships a functional GitHub Action, but the current `README.md` only provides a minimal summary and does not tell users how to configure and run it. A complete usage guide is needed now so adopters can integrate the action correctly without reading source code.

## What Changes

- Replace the current README stub with a full action guide covering purpose, prerequisites, installation, and workflow usage.
- Document all action inputs and outputs with clear defaults, required flags, and practical examples.
- Add configuration guidance for `.github/rellu.json`, including multi-target examples and common release PR options.
- Add troubleshooting and validation guidance so users can diagnose configuration and runtime failures quickly.

## Capabilities

### New Capabilities
- `github-action-usage-documentation`: Define the required user-facing documentation contract for discoverability, setup, configuration, examples, and troubleshooting.

### Modified Capabilities
- None.

## Impact

- Affected files: `README.md` (primary), with potential small metadata alignment in `action.yml` descriptions if inconsistencies are found.
- Affected users: repository adopters configuring the action in GitHub workflows.
- No runtime behavior changes to release analysis logic; this is a documentation and usability improvement.
