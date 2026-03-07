## 1. Manifest Path Boundary Enforcement

- [x] 1.1 Add a path-boundary helper that resolves manifest paths against repository root and detects out-of-workspace targets.
- [x] 1.2 Apply boundary validation before manifest reads in version resolution flows.
- [x] 1.3 Apply boundary validation before manifest writes during release updates.
- [x] 1.4 Add clear validation errors including target label and configured manifest path when boundary checks fail.

## 2. Changelog and PR Body Sanitization

- [x] 2.1 Add a centralized markdown escaping utility for commit-derived changelog fields (description, scope, contributor display).
- [x] 2.2 Integrate escaping into changelog entry rendering and keep existing section/grouping behavior intact.
- [x] 2.3 Ensure release PR body generation uses sanitized changelog markdown output only.

## 3. Regression Tests and Docs

- [x] 3.1 Add tests proving out-of-workspace manifest paths are rejected before filesystem mutation.
- [x] 3.2 Add tests verifying markdown-special characters and mention-like content are escaped in changelog and PR body outputs.
- [x] 3.3 Update documentation to state workspace-bounded manifest path requirements and sanitized markdown output behavior.
