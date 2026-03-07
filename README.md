# Rellu

Rellu is a JavaScript GitHub Action for monorepos that:

- detects changed app targets from a git range
- parses relevant conventional commits per target
- calculates next semantic versions per target
- generates per-target changelog markdown
- optionally updates one release PR per target

## Required Workflow Setup

Use full git history so ref resolution and commit collection are reliable:

```yaml
- uses: actions/checkout@v6.0.2
  with:
    fetch-depth: 0
```

## Inputs

| Input | Required | Default | Description |
| --- | --- | --- | --- |
| `targets` | No | - | JSON array of targets (`label`, `paths`, `version`) |
| `config-file` | No | - | Optional path to JSON config file |
| `from-ref` | No | first commit | Start ref for analysis when `range-strategy=explicit` |
| `range-strategy` | No | `explicit` | `explicit`, `latest-tag`, or `latest-tag-with-prefix` |
| `to-ref` | No | `HEAD` | End ref for analysis |
| `strict-conventional-commits` | No | `false` | Fail when relevant commits are invalid |
| `bump-rules` | No | defaults | JSON mapping of type -> bump (`major/minor/patch/none`) |
| `changelog-category-map` | No | defaults | JSON mapping of type -> changelog section name |
| `changelog-section-order` | No | defaults | JSON array for preferred changelog section order |
| `no-bump-policy` | No | `skip` | `skip`, `keep`, or `patch` |
| `create-release-prs` | No | `false` | Enable release PR mode |
| `release-branch-prefix` | No | `rellu/release` | Prefix used for release branches (must be automation-owned release namespace) |
| `base-branch` | No | `main` | Base branch for release PRs |
| `repo` | No | `$GITHUB_REPOSITORY` | Explicit `owner/repo` |
| `github-server-url` | No | `https://api.github.com` | API base URL |

## Target Config Example

```json
[
  {
    "label": "app-1",
    "tagPrefix": "app-1@v",
    "paths": ["apps/app1/**/*", "packages/shared/**/*"],
    "releasePr": {
      "enabled": true,
      "branchPrefix": "rellu/release",
      "baseBranch": "main"
    },
    "version": {
      "file": "apps/app1/package.json",
      "type": "node-package-json"
    }
  },
  {
    "label": "app-2",
    "tagPrefix": "app-2@v",
    "paths": ["apps/app2/**/*", "packages/shared/**/*"],
    "releasePr": {
      "enabled": false
    },
    "version": {
      "file": "apps/app2/Cargo.toml",
      "type": "rust-cargo-toml"
    }
  }
]
```

`tagPrefix` is only required when `range-strategy` is `latest-tag-with-prefix`.
`releasePr` is optional per target and only applies when global `create-release-prs` is enabled.

Per-target release PR settings precedence is:
1. `target.releasePr.*`
2. global action/config values (`create-release-prs`, `release-branch-prefix`, `base-branch`)
3. built-in defaults

## Target Path Glob Semantics

Target `paths` use standard glob semantics (via `picomatch`), including:

- recursive wildcards: `**`
- single-segment wildcards: `*` and `?`
- brace expansion: `{web,admin}`
- character classes: `[ab]`

Invalid glob syntax fails fast during config loading and reports the target label plus offending pattern.

## Config File Boolean Options

In `config-file` JSON, the following keys accept either native booleans or string booleans:

- `strictConventionalCommits`
- `createReleasePrs`

Accepted values:

- `true` / `false`
- `"true"` / `"false"`

Invalid types or strings fail fast with a clear config error.
Workflow inputs still use string values (for example `strict-conventional-commits: "true"`).

```json
{
  "strictConventionalCommits": true,
  "createReleasePrs": false
}
```

## Changelog Category Mapping

You can customize changelog grouping with:

- `changelog-category-map`: JSON object (`commitType -> sectionName`)
- `changelog-section-order`: JSON array of section names

Config-file equivalents:

- `changelogCategoryMap`
- `changelogSectionOrder`

Example:

```yaml
with:
  changelog-category-map: >
    {"feat":"Enhancements","fix":"Maintenance","docs":"Guides","other":"Other"}
  changelog-section-order: >
    ["Maintenance","Enhancements","Guides","Other"]
```

Behavior notes:

- defaults are preserved when these inputs are omitted
- custom mapping overlays defaults for unspecified commit types
- configured section order is applied first; remaining encountered sections are appended in sorted order
- invalid mapping/order JSON fails fast with clear validation errors

## Range Strategy Modes

- `explicit`: uses `from-ref..to-ref` (defaults to first commit..`HEAD` when `from-ref` is omitted)
- `latest-tag`: resolves `from` from the latest reachable tag, then analyzes `from..to-ref`
- `latest-tag-with-prefix`: resolves `from` per target using each target's `tagPrefix`; if no matching tag exists for a target, that target falls back to first-commit..`to-ref` with a log message

For monorepos, `latest-tag-with-prefix` avoids anchoring one target to another target's release tag.

## Supported Version Sources

- `node-package-json`: `package.json` `version`
- `rust-cargo-toml`: `Cargo.toml` `[package] version = "x.y.z"`
- `python-pyproject-toml`: `pyproject.toml` `[project] version` or `[tool.poetry] version`

Unsupported Python layouts fail with a clear error.

## Outputs

| Output | Description |
| --- | --- |
| `changed-targets` | JSON array of changed target labels |
| `has-changes` | `true` when at least one target changed |
| `result-json` | Analysis JSON envelope with `range`, top-level `commitCount`, and `results` |
| `release-prs-created` | `true` when release PR mode created/updated at least one PR |

`repo` must be exactly `owner/name` when release PR mode is enabled. Malformed values (for example `owner/name/extra`, `/name`, or `owner/`) fail fast.

## Strict Mode and Merge Commits

`strict-conventional-commits: "true"` validates relevant non-merge commits as conventional commits.  
Non-conventional merge subjects (for example `Merge pull request ...`) are still included in deterministic impact analysis but do not fail strict mode by themselves.

### Result JSON Shape (analysis envelope)

```json
{
  "range": "from-sha..to-sha",
  "commitCount": 12,
  "results": [
    {
      "label": "app-1",
      "changed": true,
      "currentVersion": "1.2.3",
      "nextVersion": "1.2.4",
      "bump": "patch",
      "matchedFiles": ["apps/app1/src/index.ts"],
      "commits": [
        {
          "sha": "abc123",
          "type": "fix",
          "scope": "api",
          "description": "handle null config",
          "isBreaking": false,
          "author": {
            "name": "Jane Doe",
            "username": "janedoe",
            "display": "@janedoe"
          }
        }
      ],
      "changelog": {
        "markdown": "## Bug Fixes\n- handle null config (thanks @janedoe) ([abc123](...))"
      },
      "releasePr": {
        "enabled": true,
        "branch": "rellu/release/app-1",
        "title": "release(app-1): v1.2.4",
        "number": 123,
        "url": "https://github.com/org/repo/pull/123"
      }
    }
  ]
}
```

The previous array-only `result-json` contract is replaced. Downstream consumers should parse `result-json.results` for per-target entries.

When release PR mode is enabled but a target is non-releasable, the target entry inside `results` reports disabled metadata and does not include PR identity fields:

```json
{
  "range": "from-sha..to-sha",
  "commitCount": 12,
  "results": [
    {
      "label": "app-2",
      "changed": true,
      "releasePr": {
        "enabled": false
      }
    }
  ]
}
```

## Example Usage

```yaml
name: Analyze Releases

on:
  push:
    branches: [main]

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6.0.2
        with:
          fetch-depth: 0

      - uses: ./
        id: rellu
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          targets: ${{ vars.RELLU_TARGETS_JSON }}
          from-ref: origin/main~20
          to-ref: HEAD
          strict-conventional-commits: "false"
          no-bump-policy: "skip"
          create-release-prs: "false"

      - name: Print result
        run: |
          echo "${{ steps.rellu.outputs.result-json }}"
```

## Release PR Caveats

- Release branches are automation-owned. Manual branch edits can be overwritten.
- Release PR mode force-pushes release branches after regenerating from the latest base branch.
- Before any force-push, branch safety validation is enforced. Unsafe branch resolutions fail fast with a security error.
- `release-branch-prefix` (or `target.releasePr.branchPrefix`) must resolve to a namespaced release branch format, for example `rellu/release/<target-label>`.
- Targets skipped by `no-bump-policy: skip` do not create/update release PRs.
- For skipped/non-releasable targets in release PR mode, `result-json` reports `releasePr.enabled: false` and omits PR identity fields.

## Runtime Toolkit Conventions

Rellu delegates action-runtime integration concerns to official toolkit packages:

- `@actions/core`: input resolution, output emission, logging, and failure signaling
- `@actions/github`: authenticated GitHub API operations for release PR automation and commit author enrichment
- `@actions/exec`: command execution paths (for example git command invocations)
- `@actions/io`: supported runner-oriented filesystem helper operations

Domain logic (target analysis, bump resolution, changelog generation) remains toolkit-agnostic.

## Local Development

This repository uses Bun for package management and script execution.  
The GitHub Action runtime remains Node (configured in [`action.yml`](./action.yml)).
Tests run with Bun's native TypeScript test runner against `src/` modules.

```bash
bun install
bun run build
bun run typecheck
bun run test
```

## Pre-commit Hook

Husky is configured with a `pre-commit` hook that runs `bun run build`.  
This keeps committed `dist/` artifacts synchronized with source changes.
