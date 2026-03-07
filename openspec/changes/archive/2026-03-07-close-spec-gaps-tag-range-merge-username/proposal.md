## Why

Several implemented behaviors are currently weaker than the project specification: tag-prefix latest-tag range resolution is missing, strict mode can fail on normal merge subjects, and GitHub username attribution does not follow the required fallback order. Closing these gaps now is necessary to align runtime behavior with documented requirements and avoid avoidable release-analysis failures in common monorepo workflows.

## What Changes

- Add first-class git range resolution modes for "latest tag" and "latest tag with prefix", with prefix resolution defined per target so each target can resolve from its own previous release tag instead of a repository-global tag.
- Define and implement deterministic merge handling that remains strict about conventional commits for relevant non-merge changes while preventing merge-subject noise from breaking strict mode.
- Expand author attribution to follow the specified fallback order: commit metadata association first, email-based lookup when available, then safe author-name fallback.
- Ensure per-target analysis/changelog output uses the normalized attribution result consistently.
- Add tests for tag-prefix resolution, strict merge scenarios, and attribution fallback sequencing.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `target-impact-analysis`: Extend range resolution requirements to include latest-tag and tag-prefix strategies and tighten deterministic merge handling semantics.
- `conventional-commit-and-bump-resolution`: Refine strict-mode requirements so deterministic merge handling does not cause false failures from non-conventional merge subjects.
- `changelog-and-output-generation`: Strengthen contributor attribution requirements to enforce the specified username resolution fallback order.

## Impact

- Affected code: git range resolution, commit collection/enrichment, conventional-commit validation flow, contributor display construction, and related tests.
- APIs/config: new/expanded range selection inputs plus per-target tag-prefix config for latest-tag-with-prefix behavior.
- Systems: git history traversal and GitHub API author enrichment calls.
- Compatibility: preserves existing output keys and per-target JSON shape while improving correctness of range selection and attribution values.
