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
- Patterns: reusable snippets of model elements; metamodels can ship
  pattern libraries for the models that use them.
- Project templates: start from an example; a template can bring its
  metamodel along. Templates use the JSON export format.
- Two guided tutorials whose steps check the result in the model: Symlit
  basics (the tool, 26 steps) and Production with PPR (product, process,
  resource and requirements tracing, 22 steps). Export (JSON/CSV).
- Versioned database migrations applied on start; strict server-side
  validation of elements and relationships.
- Tests: unit, API (PGlite and PostgreSQL 16) and browser (Playwright) in CI.

### Fixed
- A diagram reopened shortly after it was saved could show its state from
  before the save; saving again then discarded the earlier save.

Docs: README.md, docs/ARCHITECTURE.md, docs/BACKLOG.md.
