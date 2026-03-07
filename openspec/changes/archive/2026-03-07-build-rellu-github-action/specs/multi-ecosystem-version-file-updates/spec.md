## ADDED Requirements

### Requirement: Version readers SHALL support Node, Rust, and Python manifests
The system SHALL read current version values from Node `package.json`, Rust `Cargo.toml`, and Python `pyproject.toml` using supported Python sections `[project]` and `[tool.poetry]`.

#### Scenario: Python project version is read from `[project]`
- **WHEN** target version source points to a `pyproject.toml` file containing `[project] version = "1.2.3"`
- **THEN** the current target version resolves as `1.2.3`

### Requirement: Unsupported or missing version layouts MUST fail with actionable errors
If the configured manifest file is missing, lacks a supported version field, or uses unsupported Python layout, the action MUST fail with target label and file path context.

#### Scenario: Pyproject lacks supported version section
- **WHEN** target version type is `python-pyproject-toml` and no `[project]` or `[tool.poetry]` version field exists
- **THEN** the action fails with an error identifying the target and expected supported layouts

### Requirement: Semantic version progression SHALL follow computed bump level
Given current `X.Y.Z`, resolved bump levels MUST produce `major -> X+1.0.0`, `minor -> X.Y+1.0`, `patch -> X.Y.Z+1`, and `none -> unchanged`.

#### Scenario: Major bump increments major and resets minor/patch
- **WHEN** current version is `2.7.9` and resolved bump is `major`
- **THEN** next version is `3.0.0`

### Requirement: Version writers SHALL update configured manifest source
When a target has a releasable next version, the system MUST write the new version back to the target's configured manifest file in the format appropriate to that manifest type.

#### Scenario: Cargo target version is updated
- **WHEN** target manifest is `Cargo.toml` with `version = "0.4.1"` and next version is `0.5.0`
- **THEN** the written manifest contains `version = "0.5.0"`

### Requirement: Keep and skip no-bump outcomes SHALL control file mutation
Targets with no-bump outcomes under `keep` or `skip` policies MUST NOT receive unintended version-file changes.

#### Scenario: Keep policy preserves version file
- **WHEN** a target is changed but resolved no-bump policy is `keep`
- **THEN** the target remains in outputs with unchanged current and next versions and no manifest write occurs
