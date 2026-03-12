## 1. Documentation Source Audit

- [x] 1.1 Inventory current action interface from `action.yml` (all inputs, outputs, defaults, and descriptions)
- [x] 1.2 Inventory user config contract from `src/action/config/schema.ts` (`targets`, `version`, `releasePr`, `bumpRules`, `changelog`)
- [x] 1.3 Capture representative config examples from existing fixtures for README examples

## 2. README Information Architecture

- [x] 2.1 Define README section structure (overview, quick start, workflow example, config reference, inputs/outputs, troubleshooting)
- [x] 2.2 Draft copy/paste workflow YAML example including checkout with `fetch-depth: 0` and action invocation
- [x] 2.3 Draft single-target and multi-target `.github/rellu.json` examples aligned with schema

## 3. Reference and Troubleshooting Content

- [x] 3.1 Add complete input reference table matching `action.yml` metadata
- [x] 3.2 Add output reference section with at least one downstream output-consumption example
- [x] 3.3 Add troubleshooting matrix for shallow clone, ref/range errors, conventional-commit strict mode failures, and config validation failures

## 4. Validation and Finalization

- [x] 4.1 Cross-check README terminology/defaults against `action.yml` and config schema before merge
- [x] 4.2 Confirm examples avoid unsupported behavior and reflect current implementation
- [x] 4.3 Run repository markdown checks (if configured) and finalize the documentation-only change
