# Backlog

Known issues and planned work. Each entry says where it is and why it matters. What has been
done is in the [changelog](../CHANGELOG.md) and the git history.

## Open

### Data model
- **Element ids are global primary keys.** Ids are now random UUIDs, so collisions are
  practically impossible. A composite key `(project_id, id)` would make the
  model cleaner, but every edge, placement and reference would have to change.
- **`node_views.parent_id` has no foreign key.** Parent elements may legitimately live outside
  the view, so it was left unconstrained.

### Features
- **Patterns, next steps (v0.2):** authoring instance-level patterns inside a metamodel (server ready, no editor yet), re-applying a pattern to its copies.
- **Project templates, next steps (v0.2):** saving projects as templates, user template files, a template library.
- **SysML v2 textual export (later import).** The vocabulary already follows SysML v2; export
  makes models diffable and usable in SysML v2 tools. See
  `docs/decisions/diagram-editor-state-and-libraries.md`.

- **Auto-save and save conflicts.** Auto-save is optional (canvas settings). When an automatic save meets a
  conflict, the conflict dialog opens and auto-save waits for the next edit; "Decide later" followed by an
  edit asks again. Nobody has yet used the two together for long.
- **Import matches nothing that exists.** Importing a file always creates new copies of the metamodels it brings,
  even when the same metamodel is already in the workspace. Offer "use the existing one" when names/content match.
- **Save conflicts are all-or-nothing.** The dialog offers "my version" or "the other version" for the whole
  diagram; there is no merge or per-element view of what differs.

### Server
- **Route error handling is doubled.** `catchAsyncRouteErrors` (server/http-guards.ts) now passes every async
  error to the error handler, so the per-route `try/catch` blocks and the `fail()` helper in `routes/patterns.ts`
  only exist to map known errors to 4xx. They could become error classes with a `status`. Express 5 would make
  the wrapper unnecessary.
- **The save conflict check is not atomic.** The revision is compared just before the transaction, which is fine
  for one user; with several users it should compare inside it (or lock the view row).
- **`updated_at` misses some writes.** Saving a pattern and inserting an element through
  `POST /api/views/:viewId/nodes/:nodeId/insert` do not mark the project as edited.

### Client
- **Guided tutorials, still open** (`docs/ux/TUTORIAL_ROADMAP.md`): none of the six has been tried with
  learners; a single lesson cannot be reset on its own; per-step records (time, hints, Show me) stay in the
  browser and have no export.
- **Model rules, next steps.** `for <type>` and `type = "…"` match exactly that type, not the types that
  specialize it. Issue messages cannot name values yet (`report "{name} weighs {[mass]} kg"`). The legacy
  checks (missing name, duplicate name, …) are not written as text; `duplicate-name` compares elements with
  each other, which the language cannot say. The lists show one group level and one comparison per related
  phrase.
- **Related Formulas, next steps.** `where type = "…"` matches the type's name, not
  its specializations. A reference inside an aggregate whose related elements have separate attributes of that
  name stays matched by name (it is linked when they share one, from a type). Changing a metamodel relationship's
  kind does not change the model relationships made from it (validation then reports them). Paths of more
  than one step, filters that compare with this element's own values, and a shortcut such as `of parts` for
  compositions are left out on purpose until it is clear how people write these.
- **Flow mode is not reachable.** The canvas has a flow mode (start and end elements, ticks, playback), but
  `ProjectView` always mounts it in build mode and nothing switches it. The README and wiki no longer claim it.
  Make it reachable (and test it), or remove the code.
- **A metamodel cannot be made to build on another in the UI.** The reference exists (`referencedMetamodels` on a
  metamodel) and works, and the palette offers the other metamodel's types, but only a template or an imported file
  can set it. The metamodel selector is shown for models only.
- **A metamodel's kinds and relationship kinds cannot be changed after creating it**, although the create dialog
  says it can be changed any time. The API supports it; there is no screen.
- **Multiplicity and "mandatory part" are not checked.** Both are shown and stored, and validation ignores them.
- **Dark mode is half there.** `dark:` variants exist in about 17 places while about 52 backgrounds are
  light-only (`bg-white`, `bg-slate-50`), and nothing ever sets the `dark` class. A toggle needs a pass over
  those first; turning it on as is gives a half-dark UI.
- **The element editor hides the diagram.** It is a modal sheet that dims the canvas. Names can now be changed
  on the card (F2); attributes, description and style still need the sheet. A non-modal side panel would let
  people see the neighbours while editing.
- **Inline rename is keyboard-only.** F2 is in the help dialog and the name's tooltip, but nothing on screen
  offers it. A slow second click on the name is the usual pointer gesture; it was left out because a click on a
  selected element followed by Delete would then edit the name instead of deleting the element.
- **Project card actions appear on hover only** (edit, delete), and sit next to each other.
- **Toolbar labels disappear below 1280 px**, leaving icon-only buttons.
- **Sidebar header.** "Local user" with a green dot carries no information in a single-user app, and the project
  name is cut off there while the breadcrumb beside it shows it.
- **No whole-workspace backup.** Export and import are per project; backing up everything means one export per
  project or copying the data directory.
