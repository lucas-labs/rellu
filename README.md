<p align="center"><img src=".design/logo.svg" height="128"></p>

<br>

<p align="center"><b>Rellu</b> analyzes monorepo changes, computes per-target versions, renders changelogs, and can keep release pull requests up to date.</p>

<br>

# Rellu?

Rellu is a GitHub Action for monorepos. It does four things:

- detects which configured targets changed in a git range
- parses relevant conventional commits for each target
- computes the next semantic version and changelog per target
- optionally creates or updates one release PR per releasable target

## Overview

Use Rellu when one repository contains multiple independently released apps or packages. A target can point at a Node `package.json`, Rust `Cargo.toml`, or Python `pyproject.toml`, and each target can own its own path globs, tag prefix, and release PR overrides.

Rellu reads its target config from `.github/rellu.json` by default, compares a configured git range, and emits these top-level action outputs:

- `count-processed`
- `pr-updated`
- `pr-created`
- `changed-targets`
- `has-changes`
- `result-json`

## Requirements

- Use `actions/checkout` with `fetch-depth: 0` so Rellu can resolve tags and git ranges.
- Use conventional commits if you want automatic semantic version bumps.
- Add `contents: write` and `pull-requests: write` permissions when `create-release-pr` is enabled.
- Keep a repository config file at `.github/rellu.json` unless you override `config-file`.

## Quick Start

Create `.github/rellu.json`:

```json
{
  "targets": [
    {
      "label": "web",
      "paths": ["apps/web/**/*", "packages/ui/**/*"],
      "version": {
        "file": "apps/web/package.json",
        "type": "node-package-json"
      }
    }
  ]
}
```

Add a workflow:

```yaml
name: release-analysis

on:
  push:
    branches: [main]

permissions:
  contents: write
  pull-requests: write

jobs:
  rellu:
    runs-on: ubuntu-latest
    outputs:
      count-processed: ${{ steps.rellu.outputs.count-processed }}
      changed-targets: ${{ steps.rellu.outputs.changed-targets }}
      has-changes: ${{ steps.rellu.outputs.has-changes }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - id: rellu
        uses: lucas-labs/rellu@main
        with:
          create-release-pr: 'true'

      - name: Print processed target count
        run: echo '${{ steps.rellu.outputs.count-processed }}'

      - name: Print result envelope
        run: echo '${{ steps.rellu.outputs.result-json }}'

  publish:
    needs: rellu
    if: needs.rellu.outputs.has-changes == 'true'
    strategy:
      matrix:
        target: ${{ fromJSON(needs.rellu.outputs.changed-targets) }}
    runs-on: ubuntu-latest
    steps:
      - run: echo "Publish ${{ matrix.target }}"
```

If you only want analysis outputs and not release PR automation, omit `create-release-pr` and reduce workflow permissions accordingly.

## Workflow Notes

- The default config path is `.github/rellu.json`.
- The default range strategy is `latest-tag`, which resolves the latest reachable tag in the repository and compares it to `HEAD`.
- `latest-tag-with-prefix` resolves the range independently per target by using that target's `tagPrefix`.
- Release PR mode regenerates the target release branch from the configured base branch. Manual edits on automation-owned release branches can be overwritten on the next run.

## Configuration Reference

Rellu accepts `.json` and `.jsonc` config files. JSONC comments and trailing commas are allowed by the loader.

### JSON Schema

We keep an updated JSON Schema for the `rellu.json` file at `dist/schemas/config-schema.json`. You can use that schema in code editors for validation, completion, and hover help.

Prefer versioned GitHub raw URLs so editor behavior stays pinned to the action version you are using. Example:

`https://raw.githubusercontent.com/lucas-labs/rellu/refs/tags/v1/dist/schemas/config-schema.json`

Example `$schema` usage:

```json
{
  "$schema": "https://raw.githubusercontent.com/lucas-labs/rellu/refs/tags/v1/dist/schemas/config-schema.json",
  "targets": [
    {
      "label": "web",
      "paths": ["apps/web/**/*"],
      "version": {
        "file": "apps/web/package.json",
        "type": "node-package-json"
      }
    }
  ]
}
```

### Top-Level Fields

| Field       | Required | Description                                                            |
| ----------- | -------- | ---------------------------------------------------------------------- |
| `targets`   | Yes      | Array of releasable targets.                                           |
| `bumpRules` | No       | Map conventional commit types to `major`, `minor`, `patch`, or `none`. |
| `changelog` | No       | Customize changelog section names and ordering.                        |

### Target Fields

| Field                    | Required | Default                             | Description                                                                |
| ------------------------ | -------- | ----------------------------------- | -------------------------------------------------------------------------- |
| `label`                  | Yes      |                                     | Human-readable target label used in outputs and release branch names.      |
| `paths`                  | Yes      |                                     | File paths or glob patterns that mark the target as changed.               |
| `version.file`           | Yes      |                                     | Path to the manifest file that contains the current version.               |
| `version.type`           | Yes      |                                     | One of `node-package-json`, `rust-cargo-toml`, or `python-pyproject-toml`. |
| `tagPrefix`              | No       | `v`                                 | Prefix used by `latest-tag-with-prefix` to find target-specific tags.      |
| `releasePr.enabled`      | No       | Inherits global `create-release-pr` | Per-target release PR opt-out or opt-in override.                          |
| `releasePr.branchPrefix` | No       | Inherits `release-branch-prefix`    | Per-target branch prefix override.                                         |
| `releasePr.baseBranch`   | No       | Inherits `base-branch`              | Per-target base branch override.                                           |

### Default Bump Rules

By default, Rellu uses this semantic-version mapping:

| Commit type                            | Bump    |
| -------------------------------------- | ------- |
| `feat`                                 | `minor` |
| `fix`                                  | `patch` |
| `perf`                                 | `patch` |
| `refactor`                             | `patch` |
| `docs`, `chore`, `test`, `ci`, `style` | `none`  |

This table covers non-breaking commits. Any relevant commit marked as breaking triggers a `major`
bump regardless of its type. Rellu treats both `type(scope)!: description` headers and
`BREAKING CHANGE:` footers as breaking changes.

Unknown commit types fall back to `bumpRules.other` when provided, otherwise `none`.

### Single-Target Example

```json
{
  "targets": [
    {
      "label": "web",
      "paths": ["apps/web/**/*", "packages/ui/**/*"],
      "version": {
        "file": "apps/web/package.json",
        "type": "node-package-json"
      }
    }
  ],
  "bumpRules": {
    "feat": "minor",
    "fix": "patch",
    "docs": "none",
    "other": "none"
  }
}
```

### Multi-Target Example

```json
{
  "targets": [
    {
      "label": "app-1",
      "paths": ["apps/app1/**/*", "packages/shared/**/*"],
      "version": {
        "file": "apps/app1/package.json",
        "type": "node-package-json"
      },
      "tagPrefix": "app-1@v"
    },
    {
      "label": "app-2",
      "paths": ["apps/app2/**/*", "packages/shared/**/*"],
      "version": {
        "file": "apps/app2/Cargo.toml",
        "type": "rust-cargo-toml"
      },
      "tagPrefix": "app-2@v",
      "releasePr": {
        "branchPrefix": "custom/release",
        "baseBranch": "release-main"
      }
    }
  ],
  "bumpRules": {
    "feat": "minor",
    "fix": "patch",
    "perf": "patch",
    "refactor": "patch",
    "docs": "none",
    "other": "none"
  },
  "changelog": {
    "categoryMap": {
      "feat": "Enhancements",
      "fix": "Maintenance",
      "docs": "Guides"
    },
    "sectionOrder": ["Maintenance", "Enhancements", "Guides", "Other"]
  }
}
```

## Inputs

The table below matches `action.yml`.

| Input                            | Required | Default                                         | Notes                                                                                                                                  |
| -------------------------------- | -------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `github-token`                   | No       | `${{ github.token }}`                           | Token used for GitHub API operations such as release PR updates.                                                                       |
| `config-file`                    | No       | `.github/rellu.json`                            | Path to the repository config file.                                                                                                    |
| `from-ref`                       | No       |                                                 | Start ref for `range-strategy: explicit`.                                                                                              |
| `to-ref`                         | No       | `HEAD`                                          | End ref for commit analysis.                                                                                                           |
| `create-release-pr`              | No       | `false`                                         | Globally enables release PR mode. Targets can override with `releasePr.enabled`, `releasePr.branchPrefix`, and `releasePr.baseBranch`. |
| `no-bump-policy`                 | No       | `skip`                                          | Behavior when a target changed but no bump-worthy commit was found: `skip`, `keep`, or `patch`.                                        |
| `range-strategy`                 | No       | `latest-tag`                                    | `explicit`, `latest-tag`, or `latest-tag-with-prefix`.                                                                                 |
| `release-branch-prefix`          | No       | `rellu/release`                                 | Prefix used to build release branch names such as `rellu/release/app-1`.                                                               |
| `strict-conventional-commits`    | No       | `false`                                         | Fail the action when relevant commits are not valid conventional commits.                                                              |
| `base-branch`                    | No       | `${{ github.event.repository.default_branch }}` | Default base branch for release PRs.                                                                                                   |
| `repo`                           | No       | `${{ github.repository }}`                      | Repository slug in `owner/repo` format.                                                                                                |
| `release-commit-message-pattern` | No       | `release({target}): 🔖 v{version}`              | Commit and PR title template. Supported placeholders: `{target}` and `{version}`.                                                      |

## Outputs

| Output            | Description                                                                                   |
| ----------------- | --------------------------------------------------------------------------------------------- |
| `count-processed` | Number of target results written by the action.                                               |
| `pr-updated`      | Count of targets whose release PR was updated.                                                |
| `pr-created`      | Count of targets whose release PR was newly created.                                          |
| `changed-targets` | JSON array string of labels for targets with matching changes.                                |
| `has-changes`     | String boolean that is `true` when at least one target changed.                               |
| `result-json`     | JSON object string containing run-level analysis metadata plus the serialized target results. |

The action also emits label-prefixed outputs for each processed target. For a target labeled `app-1`, the current keys are:

- `app-1-label`
- `app-1-changed`
- `app-1-matched-files`
- `app-1-commit-count`
- `app-1-current-version`
- `app-1-next-version`
- `app-1-bump`
- `app-1-commits`
- `app-1-changelog`
- `app-1-version-source-file`
- `app-1-skip-release`
- `app-1-pr-enabled`
- `app-1-pr-action`
- `app-1-pr-branch`
- `app-1-pr-title`
- `app-1-pr-number`
- `app-1-pr-url`

Example `result-json` shape:

```json
{
  "range": "abc123..def456",
  "commitCount": 4,
  "results": [
    {
      "label": "app-1",
      "changed": true,
      "matchedFiles": ["apps/app1/src/index.ts"],
      "commitCount": 2,
      "currentVersion": "1.2.3",
      "nextVersion": "1.2.4",
      "bump": "patch",
      "commits": [
        {
          "sha": "abc1234",
          "type": "fix",
          "scope": "api",
          "description": "fix issue",
          "emoji": null,
          "isBreaking": false,
          "rawSubject": "fix(api): fix issue",
          "body": "",
          "author": {
            "name": "The Octocat",
            "username": "octocat",
            "display": "@octocat"
          }
        }
      ],
      "changelog": {
        "markdown": "## 🐛 Bug Fixes\n- api: fix issue (thanks @octocat) ([abc1234](...))"
      },
      "versionSource": {
        "file": "apps/app1/package.json",
        "type": "node-package-json"
      },
      "skipRelease": false,
      "releasePr": {
        "enabled": true,
        "action": "updated",
        "branch": "rellu/release/app-1",
        "title": "release(app-1): 🔖 v1.2.4",
        "number": 123,
        "url": "https://github.com/example/repo/pull/123"
      }
    }
  ]
}
```

Example downstream usage:

```yaml
- name: Print changed targets
  run: echo '${{ steps.rellu.outputs.changed-targets }}'

- name: Print per-target PR action
  run: echo '${{ steps.rellu.outputs.app-1-pr-action }}'

- name: Parse full result array
  run: echo '${{ fromJSON(steps.rellu.outputs.result-json).results[0].nextVersion }}'
```

## Troubleshooting

| Symptom                                                                         | Likely Cause                                                                                                           | Fix                                                                                                                                         |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `Failed to resolve from-ref` or history-related git errors                      | Repository checkout is shallow.                                                                                        | Use `actions/checkout@v4` with `fetch-depth: 0`.                                                                                            |
| `Range strategy "explicit" requires a from-ref` or ref verification failures    | `range-strategy: explicit` was used without a valid `from-ref`, or `to-ref` does not exist in the checked-out history. | Set a valid `from-ref`, keep `to-ref` reachable, or switch to `latest-tag` / `latest-tag-with-prefix`.                                      |
| `Invalid conventional commit ... in strict mode`                                | A relevant commit does not follow the Conventional Commits format while `strict-conventional-commits` is enabled.      | Fix the commit messages, disable strict mode, or adjust your history range.                                                                 |
| `Failed to parse config file` or schema validation errors such as invalid globs | `.github/rellu.json` is malformed or does not match the schema.                                                        | Validate JSON/JSONC syntax, check target glob patterns, and ensure `version.type`, `bumpRules`, and `changelog` values use supported enums. |

`latest-tag-with-prefix` falls back to the first reachable commit when no matching tag exists for a target. That is expected for first releases.
