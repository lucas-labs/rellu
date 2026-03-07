# official-actions-toolkit-integration Specification

## Purpose
TBD - created by archiving change adopt-official-github-action-libraries. Update Purpose after archive.
## Requirements
### Requirement: Action runtime interaction SHALL use @actions/core primitives
The action SHALL use `@actions/core` for input resolution, output emission, workflow annotations, and runtime logging at action boundaries.

#### Scenario: Inputs and outputs are processed through toolkit primitives
- **WHEN** the action is invoked with configured workflow inputs
- **THEN** runtime input values are read through toolkit input APIs and action outputs are emitted through toolkit output APIs with existing output keys preserved

### Requirement: Failure signaling SHALL use toolkit-native action failure semantics
The action MUST report fatal runtime failures using toolkit failure signaling so workflow failures are surfaced consistently in GitHub Actions.

#### Scenario: Unhandled runtime error occurs during execution
- **WHEN** an unrecoverable error is raised while processing analysis or release PR operations
- **THEN** the action marks the run as failed using toolkit failure APIs and includes diagnostic context in logs

### Requirement: Authenticated GitHub API access SHALL use @actions/github client initialization
The action MUST initialize authenticated GitHub API operations using `@actions/github` so API requests use the official client conventions.

#### Scenario: Release PR mode performs GitHub API operations
- **WHEN** release PR automation is enabled and API calls are required
- **THEN** the action creates and uses an authenticated toolkit GitHub client for PR query and mutation operations

### Requirement: Command execution SHALL use @actions/exec
The action MUST execute runtime shell command operations through `@actions/exec` rather than custom process execution wrappers.

#### Scenario: Git operations are executed during analysis
- **WHEN** the action needs to run git commands to resolve ranges or collect commit data
- **THEN** command execution is performed through toolkit exec APIs with stdout/stderr and exit handling preserved

### Requirement: Runner-oriented filesystem helper operations SHALL use @actions/io
The action MUST use `@actions/io` for filesystem helper operations supported by the toolkit (for example directory creation, moves, copies, or recursive removal) instead of ad-hoc helper implementations.

#### Scenario: Runtime performs supported filesystem helper operation
- **WHEN** the action needs a supported filesystem helper operation during execution
- **THEN** the operation is performed through toolkit io APIs with equivalent behavior to prior implementation

