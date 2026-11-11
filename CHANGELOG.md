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
- Clearer editor: one vocabulary (element, type, relationship, diagram),
  a labelled canvas toolbar, a searchable palette of all types, element
  styling (icon, colour, shape, border), attributes with a unit catalog,
  and a Save button with its state beside it (Ctrl+S saves).
- Patterns: reusable snippets of model elements; metamodels can ship
  pattern libraries for the models that use them.
- Project templates: start from an example; a template can bring its
  metamodel along. Templates use the JSON export format.
- Two guided tutorials whose steps check the result in the model: Symlit
  basics (the tool, 26 steps) and Production with PPR (product, process,
  resource and requirements tracing, 22 steps). Export (JSON/CSV).
- Versioned database migrations applied on start; strict server-side
  validation of elements and relationships.
- Projects: the list shows when a project was last edited and can be sorted;
  start a model from a metamodel, duplicate a project, or import a JSON
  export as a new project (project list → Import). Deleting a metamodel
  warns about the projects that use it.
- Saving: optional auto-save; a diagram changed in another tab or through
  another diagram is never overwritten unnoticed, you choose which version
  to keep. The element and relationship panels say "Apply" (they change the
  diagram; Save in the header writes it).
- Editing: F2 renames the selected element right on its card; validation
  results stay open in a panel beside the canvas.
- Safety: other websites cannot create, change or read projects in a running
  Symlit. If you open Symlit under a host name other than `localhost` or an
  IP address, add it to `SYMLIT_ALLOWED_HOSTS`.
- Tests: unit, API (PGlite and PostgreSQL 16) and browser (Playwright) in CI.

Docs: README.md, docs/ARCHITECTURE.md, docs/BACKLOG.md.
