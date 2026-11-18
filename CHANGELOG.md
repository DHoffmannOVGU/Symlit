# Changelog

## Unreleased

- Single-file executables for Windows, macOS and Linux, built and attached to every
  release (`npm run build:exe` locally). Data is stored in the per-user data folder.
- Pluggable sign-in: `server/auth-provider.ts` returns an `AuthProvider`, so a hosted
  deployment can add its own login without changing the rest of the server. The local
  edition is unchanged.

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
- Six guided tutorials whose steps check the result in the model, each with
  its own example: Symlit basics, Production with PPR, Calculate with
  attributes, Classify and review, Structure and views, Reuse and variants.
  Export (JSON/CSV).
- Attributes: calculated values follow their inputs everywhere (editor,
  table, new elements); an input without a value means "not calculated yet"
  instead of blocking the editor; elements inherit the attributes of the
  types their type specializes. Formulas have functions: min, max, sum, avg,
  round (to decimals), floor, ceil, abs, sqrt. The help lists how formulas
  work.
- Related Formulas: attributes calculated over the elements an element is
  related to, in all diagrams of the project, for example
  sum([mass] of "consists of" where [status] = "released"). Roll-ups over
  several levels come from formulas that read the related elements' own.
  The editor shows what was counted and calculates live; exports carry the
  calculated values. References are stored by id, as in a Derived Formula,
  so renamed attributes and relationships keep working. A model's
  relationships record which metamodel relationship they were made from,
  and validation accepts them by it. Renaming a metamodel relationship
  renames the models' relationships made from it.
- Multiselect attributes: any number of choices from a type's options, picked
  in the editor or in the table; the table filter finds them, and a rule's
  condition looks at each chosen option.
- Rules that tag: tags have a column in the table, and the table filter
  finds them.
- Rules as text: a rule reads for Drone where [range] < 15, and the rules
  panel's lists edit the same line. Conditions can compare two values or
  calculations ([price] < [total cost], count(of "consists of") < 2) and
  check related elements (none of incoming "executes"). The lists offer
  relationships by name, an "exists" for related elements, comparisons that
  fit the attribute and a list's options. Rules look at the relationships of
  all diagrams and follow renamed attributes, relationships and types.
- Copies of projects (duplicate, import) keep naming the same relationships:
  formulas, rules and recorded metamodel relationships follow the new ids.
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

### Fixed
- Saving a diagram with an element created since it was opened reset the
  undo history.
- Saving a diagram after showing an existing element in it was refused as if
  the diagram had been changed somewhere else.
- In a formula, a minus sign after * or / was applied wrongly (2 * -3 gave -3).
- A relationship let go on a card, not on one of its handles, created
  nothing; it now connects to the card's nearest handle.
- Opening another diagram of a project kept the table the last one was left
  in.
- An imported project could not be told apart from the one of the same name
  it came from; it is now marked "(imported)".
- Removing a tutorial removed the copies made of its model without asking;
  it now names every project that goes and asks first, and only the Reuse
  tutorial, which asks for copies, removes them.

Docs: README.md, docs/ARCHITECTURE.md, docs/BACKLOG.md.
