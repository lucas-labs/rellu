## ADDED Requirements

### Requirement: Target path matching SHALL use standard glob semantics
The system MUST evaluate target `paths` using standard glob semantics provided by a mature glob implementation, including support for common monorepo patterns such as brace expansion and character classes, while preserving deterministic matching behavior.

#### Scenario: Brace expansion pattern matches changed file
- **WHEN** a target path pattern is `apps/{web,admin}/src/**` and a commit changes `apps/web/src/main.ts`
- **THEN** the file is treated as matched for that target

#### Scenario: Character class pattern matches changed file
- **WHEN** a target path pattern is `packages/lib-[ab]/**` and a commit changes `packages/lib-a/index.ts`
- **THEN** the file is treated as matched for that target

### Requirement: Invalid target glob patterns SHALL fail fast
If any configured target path pattern is syntactically invalid for the supported glob syntax, the action MUST fail validation before analysis with a clear error that identifies the target and invalid pattern.

#### Scenario: Invalid glob pattern is configured
- **WHEN** a target path pattern is invalid glob syntax
- **THEN** the action fails before commit analysis and reports the target label and offending pattern
