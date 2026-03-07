## ADDED Requirements

### Requirement: Build pipeline SHALL compile real TypeScript sources with tsdown
The project MUST compile `src/**/*.ts` as actual TypeScript using `tsdown` and produce runnable JavaScript artifacts in `dist/` for GitHub Action execution.

#### Scenario: Standard build emits action runtime artifacts
- **WHEN** a developer runs the build command
- **THEN** the output includes `dist/index.js` compiled from TypeScript input and ready for `action.yml` runtime entry

### Requirement: Bun SHALL be used for package management and script execution workflows
The repository MUST standardize package installation and script execution on Bun for local and CI workflows.

#### Scenario: Development scripts run via Bun
- **WHEN** a contributor installs dependencies and runs project scripts
- **THEN** workflow commands use Bun (`bun install`, `bun run build`, `bun run typecheck`, `bun run test`)

### Requirement: Action runtime SHALL remain Node-based in GitHub Actions
Even after tooling migration to Bun and real TypeScript, the distributed action runtime MUST remain Node-based as declared in `action.yml`.

#### Scenario: Runtime declaration is validated after migration
- **WHEN** action metadata is reviewed post-migration
- **THEN** runtime configuration still targets Node execution and not Bun runtime

### Requirement: Legacy copy-based pseudo-TypeScript build MUST be removed
The repository MUST remove the custom build approach that copies `.ts` files as JavaScript and rewrites imports without TypeScript compilation.

#### Scenario: Build scripts no longer use copy/rewrite implementation
- **WHEN** the build script configuration is inspected
- **THEN** no step performs source-file passthrough as a replacement for TypeScript compilation

### Requirement: TypeScript compiler configuration SHALL enforce real transpilation constraints
The repository MUST define TypeScript configuration aligned to Node ESM action runtime and compatible with `tsdown` output behavior.

#### Scenario: Compiler options align with runtime and build tool
- **WHEN** TypeScript configuration is evaluated during build
- **THEN** module/target settings are consistent with Node action runtime and build completes without compatibility warnings

### Requirement: Build output SHALL remain deterministic for identical inputs
For identical source and configuration state, repeated builds MUST produce equivalent JavaScript output structure.

#### Scenario: Repeated build with unchanged source
- **WHEN** build is run twice without source or config modifications
- **THEN** both builds produce the same output file set and stable entrypoint path
