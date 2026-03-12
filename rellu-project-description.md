# Rellu — Specification

## Overview

**Rellu** is a custom GitHub Action for monorepos that determines which deployable apps/packages changed since a reference point, analyzes the relevant conventional commits per app, computes the next semantic version for each app, and generates app-specific changelogs.

Optionally, it can also maintain one **release pull request per app**, updating version files and pull request bodies so each app has a continuously refreshed release candidate PR.

The primary use case is a monorepo containing multiple independently released projects, possibly implemented in different ecosystems such as:

- Node.js / npm / pnpm / bun (`package.json`)
- Rust (`Cargo.toml`)
- Python (`pyproject.toml`)

The action is intended to be reusable across repositories and workflows.

---

## Goals

Rellu must:

1. Analyze commits between a configurable base ref and target ref.
2. Determine which configured app targets were affected by file changes.
3. Filter commits per app target based on path ownership rules.
4. Parse conventional commits and group them by category.
5. Compute the next semantic version for each affected app.
6. Output structured machine-readable data for workflows.
7. Output human-readable markdown changelogs per app.
8. Optionally (configurable via user input) create or update a release PR per app.
9. Support version file updates for Node, Rust, and Python projects.

---

## Non-Goals

- Rellu DOESN'T publish packages, Docker images, crates, or Python distributions.
- Rellu DOESN'T create GitHub Releases directly.
- Rellu DOESN'T push tags.

Those concerns belong to downstream workflows that consume Rellu outputs.

---

## Core Concepts

### App Target
An **app target** is a deployable or releasable unit inside the monorepo.

Each target has:

- a unique label, for example `app-1`
- one or more owned paths/globs
- a version source file
- a manifest type
- optional release PR behavior settings

Example:

```yaml
apps:
  - label: app-1
    paths:
      - apps/app1/**/*
      - packages/shared/**/*
    version:
      file: apps/app1/package.json
      type: node-package-json

  - label: app-2
    paths:
      - apps/app2/**/*
      - packages/shared/**/*
      - packages/app2-core/**/*
    version:
      file: apps/app2/Cargo.toml
      type: rust-cargo-toml
```

This should be configurable via action inputs.

### Reference Range
Rellu compares changes in a git range.

Typical examples:

- latest tag → `HEAD`
- latest tag starting with prefix → `HEAD`
- `origin/main~10` → `HEAD`
- merge base with main → current SHA

The range must be configurable and must allow tag prefix filtering (e.g. latest tag starting with `app-1@v` to match release tags of app-1)

### Relevant Commit for an App
A commit is considered relevant to an app if the commit modified at least one file matching one of the app’s configured paths.

A single commit may belong to multiple apps. Rellu treats each app independently. When processing one app, Rellu does not care about another app that might be processed next.

### Version Bump
Version bump is derived from conventional commits relevant to each app.

Default mapping:

- `BREAKING CHANGE` or `!` → major
- `feat` → minor
- `fix` → patch
- `perf` → patch
- `refactor` → patch or configurable
- `docs`, `chore`, `test`, `build`, `ci`, `style` → no bump by default

The bump rules should be configurable.
Scopes and gitmojis should be taken into account for parsing.
E.g. of valid conventional commits:

- `feat: adds something nice`
- `fix(core): fixes crashing all the time issue`
- `fix!: fix the world` 
- `refactor: 🔨 make things better`
- ```feat(app-x)!: enhance evereything
     
	 - adds a lot of awesome stuff and enhacements but also
	   breaks some stuff
	   
	 BREAKING CHANGE: breaks a lot of things, just update.
	 Ref: #4564
	 Author: some-dude```

---

## Commit Collection

Rellu must:

1. Resolve the git range `from-ref..to-ref`.
2. Collect all commits in the range in chronological or reverse chronological order.
3. For each commit, collect:
   - SHA
   - subject
   - body
   - author name
   - author email
   - GitHub username when available
   - list of modified files
4. Support merge commits in a deterministic way.

## GitHub Username Resolution
For each commit, Rellu should attempt to resolve the GitHub username.

Preferred sources, in order:

1. GitHub API association from commit metadata
2. author email to GitHub user when available via API
3. fallback to commit author name

If no username can be resolved, changelog output should still include a safe fallback.

Example display:

- `@octocat`
- `Jane Doe`

---

## Path Matching and App Impact Detection

For each target, Rellu must determine whether any files changed in that target’s configured paths.

Rules:

1. If any file in the range matches any path glob of a target, that target is marked as changed.
2. If a commit touches files belonging to multiple targets, the commit belongs to each matching target.
3. Shared paths are allowed and expected (e.g. shared packages).
4. Path matching must use normalized POSIX-style paths.

Output per target:

- `changed: true|false`
- `matchedFiles: string[]`
- `commitCount: number`

---

## Conventional Commit Parsing

Rellu must parse relevant commit messages using the Conventional Commits format.

Supported structure:

```text
type(scope)!: description
```

Body and footers must also be parsed for:

- `BREAKING CHANGE:`
- issue references
- additional metadata if needed later

Parsed fields:

- `type`
- `scope`
- `description`
- `emoji`
- `isBreaking`
- `rawSubject`
- `body`
- `footers`

Invalid conventional commits:

- In non-strict mode: classify as `other`
- In strict mode: fail action with a useful error

## Categories for Markdown Changelog
At minimum, markdown changelogs must group relevant commits into:

- Features
- Bug Fixes
- Documentation

Optional additional sections:

- Performance
- Refactoring
- CI
- Chores
- Tests
- Other

Default mapping:

- `feat` → Features
- `fix` → Bug Fixes
- `docs` → Documentation
- others → optional sections

Sections and its mapping can be configurable by the user. But must have a sensitive default.

---

## Version Resolution and Next Version Calculation

For each changed target, Rellu must:

1. Read the current version.
2. Determine the highest required bump from relevant commits.
3. Produce the next version.

### Supported Version Sources

#### Node.js
Read and write `version` from `package.json`.

#### Rust
Read and write `version` from `Cargo.toml`.

#### Python
Read and write version from `pyproject.toml`.

Supported Python layouts:

- `[project] version = "x.y.z"`
- `[tool.poetry] version = "x.y.z"`

Unsupported layouts must produce a clear error.

### Version Algorithm

Given current version `X.Y.Z`:

- major bump → `X+1.0.0`
- minor bump → `X.Y+1.0`
- patch bump → `X.Y.Z+1`
- no bump → unchanged

### No-Bump Change Policy
Configurable behavior for targets that changed but have no bump-worthy commits:

Supported modes:

- `skip` — do not propose a release
- `keep` — mark changed but keep version unchanged
- `patch` — force patch bump

Default: `skip`

Decision must be logged clearly.

---

## Outputs

Rellu must expose both step outputs and a machine-readable JSON artifact string.

### Top-Level Outputs

#### `changed-targets`
JSON array of changed target labels.

Example:

```json
["app-1", "app-2"]
```

#### `has-changes`
`true` if at least one target changed.

#### `result-json`
Full JSON document containing all analysis results per target.

#### `release-prs-created`
Whether PR mode created or updated at least one release PR.

### Per-Target Output Data
The `result-json` must include, for each target:

```json
{
  "label": "app-1",
  "changed": true,
  "currentVersion": "1.23.1",
  "nextVersion": "1.23.2",
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
    "markdown": "## Bug Fixes\n- handle null config (@janedoe)"
  },
  "releasePr": {
    "enabled": true,
    "branch": "rellu/release/app-1",
    "title": "release(app-1): v1.23.2",
    "number": 123,
    "url": "https://github.com/..."
  }
}
```

### Markdown Changelog Format
Minimum expected markdown structure:

```md
## Features
- add dashboard filters (thanks @alice) ([abc123](...))

## Bug Fixes
- handle null config (thanks @bob) ([def456](...))

## Documentation
- clarify setup instructions (thanks @carol) ([ghi789](...))
```

Each entry should include:

- description
- contributor display name
- commit SHA, optionally linked

Optional:

- scope
- PR number if available

---

## Optional Release PR Mode

When `create-release-pr=true`, Rellu must create or update one release PR per changed target that has a releasable version bump.

### Release PR Branch Strategy
For each target, release PRs should use a stable branch name:

```text
{release-branch-prefix}/{label}/{target}
```

Example:

```text
rellu/release/app-1
```

This ensures one persistent PR per target

### 5.7.2 Release Commit Strategy
The release branch must contain exactly one generated release commit on top of the latest base branch state.

Commit message format:

```text
release(app-1): v1.23.2
```

Rules:

1. If no existing release PR branch exists, create it from the current base branch.
2. If a release branch exists, regenerate it from the current base branch.
3. Apply version file updates.
4. Commit the changes once.
5. Force-push the branch.
6. Create or update the PR. The body of the PR must be the markdown changelog that we rellu generates.

This avoids stacking multiple old release commits.

### Existing Open Release PR Update Behavior
If an open release PR already exists for a target:

1. Recompute changes from the configured base range.
2. Recompute next version.
3. Rebuild changelog.
4. Reset the release branch so previous generated release commits disappear.
5. Create exactly one new release commit.
6. Update the PR title and body.

This guarantees the PR stays current while preserving a clean commit history.

### Release PR Discovery
Rellu must identify an existing release PR by deterministic branch name and/or markers.

Recommended markers:

- branch name
- PR title prefix `release({label})`
- label such as `rellu-release`

---

## Workflow Integration Model - For reference and big picture context

Rellu is intended to sit in the middle of a broader release workflow.

### Push-to-Main Analysis Flow
On push to main/master:

1. Checkout repository with full history.
2. Run Rellu.
3. Rellu determines affected targets.
4. Rellu computes app-specific changelogs and versions.
5. Optional: Rellu creates or updates release PRs.
6. Downstream jobs may use outputs to decide whether to build/test per target or run other per-target CI actions .

### Merge-of-Release-PR Flow
When the team is ready for releasing a package, they can merge its Rellu Release PR. Separate workflows can later:

1. Detect merge commits or commits matching `release(`.
2. Determine which target was released.
3. Build/publish/tag/create GitHub Release.

This release orchestration is outside the scope of Rellu, but must be enabled by its outputs and commit conventions.

---

## Architecture

## Technology Choice
Implementation target:

- GitHub Action written in TypeScript
- compiled to JavaScript for distribution
- packaged as a JavaScript action, not a Docker action

Recommended stack:

- `@actions/core`
- `@actions/github`
- `@actions/exec` or native child process wrappers
- `yaml` for config parsing
- `semver` for version logic
- glob library such as `picomatch` or `minimatch`
- TOML parser for Rust/Python manifests

### 7.2 Internal Modules
Suggested module boundaries:

#### `config/`
- input loading
- target schema validation

#### `git/`
- resolve refs
- list commits
- list changed files per commit

#### `git/commits/`
- parse conventional commit messages
- map types to categories and bump levels

#### `targets/`
- path matching
- target impact resolution

#### `semver/`
- read current version
- compute next version
- update manifest contents

#### `changelog/`
- group commits
- render markdown

#### `gh/`
- resolve usernames
- PR discovery
- PR create/update
- branch management

#### `output/`
- final result serialization
- GitHub Action outputs

---

## Data Model

## TargetConfig

```ts
interface TargetConfig {
  label: string;
  paths: string[];
  version: {
    file: string;
    type: 'node-package-json' | 'rust-cargo-toml' | 'python-pyproject-toml';
  };
}
```

## ParsedCommit

```ts
interface ParsedCommit {
  sha: string;
  subject: string;
  body: string;
  authorName: string;
  authorEmail?: string;
  githubUsername?: string;
  files: string[];
  conventional: {
    type: string | null;
    scope: string | null;
    description: string;
    isBreaking: boolean;
    valid: boolean;
  };
}
```

## TargetAnalysisResult

```ts
interface TargetAnalysisResult {
  label: string;
  changed: boolean;
  matchedFiles: string[];
  relevantCommits: ParsedCommit[];
  currentVersion: string;
  recommendedBump: 'major' | 'minor' | 'patch' | 'none';
  nextVersion: string;
  changelogMarkdown: string;
  releasePr?: {
    branch: string;
    title: string;
    number?: number;
    url?: string;
  };
}
```

---

## Edge Cases and Rules

### Missing Manifest Version
Fail with a clear error describing:

- target label
- manifest file
- expected field not found

### Existing Open Release PR with Manual Edits
Rellu should treat the release branch as owned by automation.

If users manually edit it, the next automated update may overwrite those changes.

This must be documented explicitly.

### Shallow Clones
If git history is insufficient, Rellu must fail with a clear error instructing users to checkout with sufficient fetch depth.

Recommended workflow guidance:

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0
```

### First Releases
If no previous tag exists, Rellu must calculate from the beginning, instead of from the "from" tag reference.

---

## Security and Safety Considerations

1. Use the provided GitHub token minimally.
2. Do not execute untrusted project code.
3. Do not infer file changes from shell-expanded user input.
4. Escape user-controlled values in PR body rendering where needed.
5. Avoid destructive git operations outside the dedicated release branch.
6. In PR mode, only force-push to automation-owned branches.

---

## Observability and Logging

Rellu should emit clear logs for:

- resolved ref range
- discovered commits count
- changed targets
- version bump decision per target
- release PR create/update actions
- skipped targets and reasons

Sensitive data such as tokens must never be logged.

---

## Testing Strategy

### Unit Tests
Cover:

- conventional commit parsing
- bump calculation
- path matching
- manifest version readers/writers
- changelog rendering

### Integration Tests
Use fixture repositories to verify:

- multiple apps changed from shared commits
- only one app changed
- breaking changes trigger major bump
- invalid commit handling in strict vs non-strict mode
- release branch regeneration removes old release commits
- PR update logic is idempotent

### End-to-End Workflow Validation
Validate on a sample monorepo with:

- Node target
- Rust target
- Python target
- shared package path

---

## Summary

Rellu should be designed as a reusable monorepo release analysis action that separates **what changed** and **what should be released** from the later publishing workflows.

Its core value is:

- app-level change detection in monorepos
- app-specific changelog generation from shared commit history
- app-specific semantic version calculation
- maintenance of clean, always-current release PRs

This makes it a strong foundation for multi-package CI/CD pipelines where each app is versioned and released independently.

