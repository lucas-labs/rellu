## 1. Branch Safety Policy

- [ ] 1.1 Define explicit automation-owned branch validation rules for release PR force-push operations.
- [ ] 1.2 Add a centralized branch safety validator that evaluates the resolved release branch before destructive push.
- [ ] 1.3 Return actionable security errors when branch validation fails.

## 2. Release Push Guard Integration

- [ ] 2.1 Integrate branch validation into release branch regeneration flow immediately before force-push.
- [ ] 2.2 Ensure no force-push command executes when validation fails.
- [ ] 2.3 Preserve existing behavior for valid automation-owned release branches.

## 3. Tests and Documentation

- [ ] 3.1 Add unit tests for valid and invalid branch-safety cases (including unsafe prefixes/branch names).
- [ ] 3.2 Add regression coverage proving force-push is blocked on unsafe branch resolutions.
- [ ] 3.3 Update README/release PR docs to explain automation-owned branch requirements and safety failure behavior.
