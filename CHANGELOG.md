# Changelog

## v0.1.0 – first local edition

Symlit runs entirely on your machine: one Node.js process serves the app and
API, with an embedded PostgreSQL (PGlite) by default or your own PostgreSQL via
DATABASE_URL. No account, no external requests.

### What's in it
- Metamodels and instance models: define element and relationship types, then
  model systems typed by them; diagrams, patterns, model rules and validation.
- Diagram editor: one bidirectional handle per element side, Auto Layout,
  table view, undo/redo, screenshots, AI metamodel assistant (optional,
  Gemini key).
- Guided tutorial (two sample projects, 15 steps) and export (JSON/CSV).
- Versioned database migrations applied on start; strict server-side
  validation of elements and relationships.
- Tests: unit, API (PGlite and PostgreSQL 16) and browser (Playwright) in CI.

Docs: README.md, docs/ARCHITECTURE.md, docs/BACKLOG.md.
