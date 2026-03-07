## 1. Range Strategy and Tag Resolution

- [x] 1.1 Extend action/config inputs to support range strategies for explicit refs, latest-tag, and latest-tag-with-prefix modes, including per-target tag-prefix fields.
- [x] 1.2 Implement deterministic tag discovery logic that resolves latest matching tags per target and computes target-specific `from..to` ranges.
- [x] 1.3 Add fallback behavior and logging when no matching tag exists for a target prefix (first-commit fallback for that target).

## 2. Deterministic Merge + Strict Conventional Behavior

- [x] 2.1 Refine commit parsing/validation flow so strict mode enforces conventional format for relevant non-merge commits without failing on merge-subject noise.
- [x] 2.2 Preserve deterministic merge handling outputs for target impact (`changed`, `matchedFiles`, `commitCount`) across repeated runs.
- [x] 2.3 Add targeted tests for strict mode with merge commits to prevent regression.

## 3. Username Fallback Resolution

- [x] 3.1 Implement ordered contributor resolution: commit association login -> email-based lookup -> author-name fallback.
- [x] 3.2 Update commit enrichment/changelog author display code to use the shared ordered fallback result.
- [x] 3.3 Add tests covering all attribution fallback branches and stable output formatting.

## 4. Verification and Documentation

- [x] 4.1 Update README/project docs to describe per-target tag-prefix range behavior and strict-merge handling semantics.
- [x] 4.2 Run full verification (`bun run build`, `bun run typecheck`, `bun run test`) and capture readiness for apply.
