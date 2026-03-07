## Why

`result-json` currently serializes only per-target results and drops analysis-level metadata (`range` and total commit count) that is already computed. This forces downstream consumers to reconstruct context externally and creates avoidable contract drift from analysis output.

## What Changes

- Extend the `result-json` output contract to include analysis-level metadata (`range`, top-level `commitCount`) together with target results.
- Preserve deterministic output semantics for identical inputs.
- Update output docs and examples so downstream consumers can rely on a stable envelope structure.
- Add compatibility guidance and tests for the revised JSON contract.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `changelog-and-output-generation`: output contract requirements for `result-json` are updated to include analysis-level metadata in addition to per-target results.

## Impact

- Affected code: action output assembly/serialization and output contract tests.
- APIs/config: `result-json` shape changes from a plain array to an analysis envelope object (breaking for strict array consumers).
- Documentation: README output examples and contract descriptions must be updated.
- Downstream integrations: consumers parsing `result-json` need to read `results` from the envelope.
