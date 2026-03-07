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
| `no-bump-policy` | No | `skip` | `skip`, `keep`, or `patch` |
| `create-release-prs` | No | `false` | Enable release PR mode |
| `release-branch-prefix` | No | `rellu/release` | Prefix used for release branches |
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
    "version": {
      "file": "apps/app1/package.json",
      "type": "node-package-json"
    }
  },
  {
    "label": "app-2",
    "tagPrefix": "app-2@v",
    "paths": ["apps/app2/**/*", "packages/shared/**/*"],
    "version": {
      "file": "apps/app2/Cargo.toml",
      "type": "rust-cargo-toml"
    }
  }
]
```

`tagPrefix` is only required when `range-strategy` is `latest-tag-with-prefix`.

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
| `result-json` | Full per-target analysis JSON payload |
| `release-prs-created` | `true` when release PR mode created/updated at least one PR |

## Strict Mode and Merge Commits

`strict-conventional-commits: "true"` validates relevant non-merge commits as conventional commits.  
Non-conventional merge subjects (for example `Merge pull request ...`) are still included in deterministic impact analysis but do not fail strict mode by themselves.

### Result JSON Shape (per target)

```json
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
- Targets skipped by `no-bump-policy: skip` do not create/update release PRs.

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
