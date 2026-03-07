## 1. Input and Config Model

- [ ] 1.1 Add optional action inputs/config-file fields for changelog category mapping and section order.
- [ ] 1.2 Extend typed configuration models and parsing logic to load these fields with sensible defaults.
- [ ] 1.3 Add validation for malformed mapping/order values (invalid JSON, empty section names, duplicate order entries) with clear errors.

## 2. Changelog Rendering Behavior

- [ ] 2.1 Refactor changelog rendering to use resolved mapping config instead of hardcoded type-to-section mapping.
- [ ] 2.2 Implement configurable section ordering with deterministic fallback ordering for unspecified sections.
- [ ] 2.3 Preserve existing changelog entry format and default output behavior when no custom mapping is provided.

## 3. Tests and Documentation

- [ ] 3.1 Add unit tests for default mapping, custom mapping, custom ordering, and deterministic output stability.
- [ ] 3.2 Add tests for invalid mapping/order config paths to verify fail-fast validation behavior.
- [ ] 3.3 Update `action.yml` and `README.md` with new input descriptions and JSON examples.
