## 1. Config Boolean Parsing

- [ ] 1.1 Add a shared config helper that accepts native booleans and `"true"`/`"false"` strings for boolean options.
- [ ] 1.2 Wire `strictConventionalCommits` parsing through the helper while preserving existing input-over-config precedence.
- [ ] 1.3 Wire `createReleasePrs` parsing through the helper while preserving existing input-over-config precedence.
- [ ] 1.4 Add fail-fast validation errors for unsupported boolean config values (invalid strings and non-boolean/non-string types).

## 2. Behavior and Regression Tests

- [ ] 2.1 Add tests proving `strictConventionalCommits: true/false` in JSON config is honored.
- [ ] 2.2 Add tests proving `createReleasePrs: true/false` in JSON config is honored.
- [ ] 2.3 Add tests covering accepted boolean string forms for both settings.
- [ ] 2.4 Add tests asserting invalid boolean values fail with clear, actionable errors.

## 3. Documentation Updates

- [ ] 3.1 Update user-facing config docs to state accepted boolean forms for `strictConventionalCommits` and `createReleasePrs`.
- [ ] 3.2 Add examples showing native JSON booleans in config files for both settings.
