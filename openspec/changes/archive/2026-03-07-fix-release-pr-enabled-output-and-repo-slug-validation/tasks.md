## 1. Release PR Output Semantics

- [x] 1.1 Update non-releasable target handling in release PR flow to avoid reporting `releasePr.enabled=true` when no PR create/update runs.
- [x] 1.2 Ensure skipped targets emit normalized `releasePr` metadata (`enabled=false` and no PR identity fields) while preserving deterministic output shape.
- [x] 1.3 Add/adjust unit tests that assert skipped targets cannot be interpreted as having an existing release PR.

## 2. Repository Slug Validation

- [x] 2.1 Harden repository slug parsing to accept only exact `owner/name` format with two non-empty segments.
- [x] 2.2 Add fail-fast error messages for malformed repository references (extra segments, missing owner, missing name).
- [x] 2.3 Add tests for valid and invalid repository slug inputs to lock parser behavior before GitHub API calls.

## 3. Contract and Documentation Updates

- [x] 3.1 Update output contract tests for `result-json` to reflect corrected per-target `releasePr` semantics.
- [x] 3.2 Update docs/examples describing `releasePr` metadata so consumers can distinguish PR mode from actual PR creation/update state.
- [x] 3.3 Run relevant test suites and verify deterministic output behavior remains unchanged outside the corrected fields.
