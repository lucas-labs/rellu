## 1. Documentation Source Audit

- [ ] 1.1 Inventory current action interface from `action.yml` (all inputs, outputs, defaults, and descriptions)
- [ ] 1.2 Inventory user config contract from `src/action/config/schema.ts` (`targets`, `version`, `releasePr`, `bumpRules`, `changelog`)
- [ ] 1.3 Capture representative config examples from existing fixtures for README examples

## 2. README Information Architecture

- [ ] 2.1 Define README section structure (overview, quick start, workflow example, config reference, inputs/outputs, troubleshooting)
- [ ] 2.2 Draft copy/paste workflow YAML example including checkout with `fetch-depth: 0` and action invocation
- [ ] 2.3 Draft single-target and multi-target `.github/rellu.json` examples aligned with schema

## 3. Reference and Troubleshooting Content

- [ ] 3.1 Add complete input reference table matching `action.yml` metadata
- [ ] 3.2 Add output reference section with at least one downstream output-consumption example
- [ ] 3.3 Add troubleshooting matrix for shallow clone, ref/range errors, conventional-commit strict mode failures, and config validation failures

## 4. Validation and Finalization

- [ ] 4.1 Cross-check README terminology/defaults against `action.yml` and config schema before merge
- [ ] 4.2 Confirm examples avoid unsupported behavior and reflect current implementation
- [ ] 4.3 Run repository markdown checks (if configured) and finalize the documentation-only change
