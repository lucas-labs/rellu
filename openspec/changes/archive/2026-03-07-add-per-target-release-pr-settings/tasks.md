## 1. Target Schema and Parsing

- [x] 1.1 Extend `TargetConfig` types with optional `releasePr` settings fields.
- [x] 1.2 Update config parsing to read target `releasePr` settings from `targets`/config-file payloads.
- [x] 1.3 Add validation errors for invalid per-target `releasePr` values with target-labeled messages.

## 2. Effective Release PR Settings Resolution

- [x] 2.1 Implement deterministic precedence resolution for each target: `target.releasePr.*` -> global input/config -> existing defaults.
- [x] 2.2 Update release PR planning/execution flow to use resolved per-target `enabled`, `branchPrefix`, and `baseBranch` values.
- [x] 2.3 Preserve global-only behavior for targets without per-target overrides.

## 3. Tests

- [x] 3.1 Add/extend config tests for valid and invalid per-target `releasePr` settings.
- [x] 3.2 Add release PR behavior tests for target opt-out/opt-in under global enablement.
- [x] 3.3 Add tests for per-target branch prefix and base branch override behavior plus global fallback.

## 4. Documentation

- [x] 4.1 Update `README.md` target config examples to include optional per-target release PR settings.
- [x] 4.2 Update `action.yml`/docs narrative to document precedence between global and per-target release settings.
