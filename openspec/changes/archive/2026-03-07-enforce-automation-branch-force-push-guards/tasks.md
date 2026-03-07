## 1. Branch Safety Policy

- [x] 1.1 Define explicit automation-owned branch validation rules for release PR force-push operations.
- [x] 1.2 Add a centralized branch safety validator that evaluates the resolved release branch before destructive push.
- [x] 1.3 Return actionable security errors when branch validation fails.

## 2. Release Push Guard Integration

- [x] 2.1 Integrate branch validation into release branch regeneration flow immediately before force-push.
- [x] 2.2 Ensure no force-push command executes when validation fails.
- [x] 2.3 Preserve existing behavior for valid automation-owned release branches.

## 3. Tests and Documentation

- [x] 3.1 Add unit tests for valid and invalid branch-safety cases (including unsafe prefixes/branch names).
- [x] 3.2 Add regression coverage proving force-push is blocked on unsafe branch resolutions.
- [x] 3.3 Update README/release PR docs to explain automation-owned branch requirements and safety failure behavior.
