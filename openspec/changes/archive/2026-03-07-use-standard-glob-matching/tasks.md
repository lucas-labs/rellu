## 1. Matching Engine Migration

- [x] 1.1 Replace the custom path matcher in `src/utils/paths.ts` with a mature glob library wrapper.
- [x] 1.2 Preserve existing matching behavior for currently supported `*`, `**`, and `?` patterns.
- [x] 1.3 Normalize input file paths consistently before matching to keep cross-platform deterministic behavior.

## 2. Config Validation and Error Handling

- [x] 2.1 Add validation for target `paths` glob syntax during config loading.
- [x] 2.2 Fail fast with clear errors that identify the target label and offending pattern.
- [x] 2.3 Ensure invalid patterns stop analysis before commit/target matching starts.

## 3. Tests and Documentation

- [x] 3.1 Add unit tests for advanced patterns (brace expansion and character classes) in target matching.
- [x] 3.2 Add regression tests proving existing simple wildcard patterns still behave as expected.
- [x] 3.3 Add tests for invalid glob patterns and update docs describing supported glob semantics.
