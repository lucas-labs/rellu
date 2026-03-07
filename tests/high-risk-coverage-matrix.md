# High-Risk Behavior Coverage Matrix

This matrix maps documented high-risk behavior guarantees to concrete automated tests.

| High-risk behavior | Test coverage |
| --- | --- |
| Per-target `latest-tag-with-prefix` range isolation and no-match fallback | `tests/integration/fixtures.test.ts` -> `fixture: per-target tag-prefix range resolution stays isolated and deterministic` |
| Strict mode merge handling with valid non-merge conventional commits | `tests/integration/fixtures.test.ts` -> `fixture: strict mode accepts merge subjects when relevant non-merge commits are valid` |
| Release branch regeneration/reset semantics produce one fresh release commit | `tests/unit/release-pr-toolkit.test.ts` -> `release PR regeneration resets branch from base and writes exactly one fresh release commit` |
| Changelog markdown escaping for markdown-special and mention-like content | `tests/unit/changelog-configurable-sections.test.ts` -> `renderChangelog escapes markdown-special and mention-like commit fields` |
| Release PR body uses sanitized changelog markdown | `tests/unit/release-pr-toolkit.test.ts` -> `release PR management uses sanitized changelog markdown for PR body updates` |

CI execution path:

- `.github/workflows/ci.yml` runs `bun run build`, `bun run typecheck`, and `bun run test`.
- `bun run test` executes all unit and integration tests above.
