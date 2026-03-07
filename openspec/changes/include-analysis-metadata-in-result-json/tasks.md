## 1. Output Contract Changes

- [ ] 1.1 Introduce an analysis envelope type for `result-json` including `range`, top-level `commitCount`, and `results`.
- [ ] 1.2 Update output assembly to serialize the full analysis envelope instead of only target array.
- [ ] 1.3 Keep existing per-target result object shape unchanged inside `results`.

## 2. Tests

- [ ] 2.1 Update output contract tests to assert the new top-level keys and structure of `result-json`.
- [ ] 2.2 Add/adjust tests verifying `range` and total `commitCount` are emitted from analysis output.
- [ ] 2.3 Keep deterministic-output coverage for repeated runs with identical inputs.

## 3. Documentation and Migration Notes

- [ ] 3.1 Update README `result-json` examples to the envelope format (`range`, `commitCount`, `results`).
- [ ] 3.2 Document that the previous array-only `result-json` contract is replaced and show how downstream consumers should parse `results`.
