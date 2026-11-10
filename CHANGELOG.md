# Changelog

## Unreleased

### Fixed
- A malformed address such as `/api/projects/abc` no longer stops the server.
- Other websites can no longer create or change projects in a running Symlit,
  or read them through DNS rebinding. If you open Symlit under a host name
  other than `localhost` or an IP address, add it to `SYMLIT_ALLOWED_HOSTS`.
- A diagram changed in another tab or through another diagram is no longer
  overwritten unnoticed; you choose which version to keep.
- Switching between diagrams right after saving no longer shows the old state.
- A diagram address under the wrong project no longer mixes two projects.
- A relationship id that already exists in another diagram gives a clear
  message instead of a database error.

### Added
- Multiplicities mean something: set on a metamodel's relationship ("how many
  Battery per Drone": `1`, `0..1`, `1..*`, `2..5`), they are checked when a
  model is validated, in the editor and on the server. Text that is not a
  multiplicity can no longer be applied.
- F2 renames the selected element right on its card.
- Import: open a JSON export as a new project (project list → Import).
- The project list shows when a project was last edited and can be sorted;
  project cards are real links.
- Deleting a metamodel warns about the projects that use it.

### Changed
- Exporting a model includes its metamodels by default, so the file can be
  imported again.
- Save stays in view in narrow windows.
- The element and relationship panels say "Apply" (they change the diagram;
  Save in the header writes it).
- Database migration 0007 adds `projects.updated_at` (applied on start).

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
- Clearer editor: one vocabulary (element, type, relationship, diagram),
  a labelled canvas toolbar, a searchable palette of all types, element
  styling (icon, colour, shape, border), attributes with a unit catalog,
  and a Save button with its state beside it (Ctrl+S saves).
- Patterns: reusable snippets of model elements; metamodels can ship
  pattern libraries for the models that use them.
- Project templates: start from an example; a template can bring its
  metamodel along. Templates use the JSON export format.
- Guided tutorial (two sample projects, 15 steps) and export (JSON/CSV).
- Versioned database migrations applied on start; strict server-side
  validation of elements and relationships.
- Tests: unit, API (PGlite and PostgreSQL 16) and browser (Playwright) in CI.

Docs: README.md, docs/ARCHITECTURE.md, docs/BACKLOG.md.
