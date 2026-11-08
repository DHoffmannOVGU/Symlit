# Backlog: findings to tackle later

Things noticed while moving Symlit off Replit that are not fixed yet. Each entry says
where it is and why it matters. Fixed items move to the "Done" list at the bottom with the
commit that fixed them.

## Open

### Data model
- **Element ids are global primary keys.** Ids are now random UUIDs, so collisions are
  practically impossible. A composite key `(project_id, id)` would make the
  model cleaner, but every edge, placement and reference would have to change.
- **`node_views.parent_id` has no foreign key.** Parent elements may legitimately live outside
  the view, so it was left unconstrained.
- **Starter templates cannot reuse an element in two views.** `validateStarterTemplate` rejects
  the same node id in several views, although the data model supports it.

### Features
- **SysML v2 textual export (later import).** The vocabulary already follows SysML v2; export
  makes models diffable and usable in SysML v2 tools. See
  `docs/decisions/diagram-editor-state-and-libraries.md`.

### Server

- **Relationship data is still unchecked.** Edge `data` is `z.any()` because the same schema
  parses stored relationships on load; tightening it needs a check of what older diagrams contain.

### Client
- **Option: re-attach relationships to facing sides during Auto Layout.** Measured on the sample
  diagrams it makes every relationship's handles face each other and shortens lines by 20–27 %
  while keeping rows (see the ELK section in `docs/decisions/diagram-editor-state-and-libraries.md`).
  It changes the sides users drew, so decide whether it is automatic, a toggle, or a separate
  "Tidy connections" action.
- **The first page load includes `drizzle-orm` and `drizzle-zod` (~70 kB).** `shared/routes.ts`
  uses the insert schemas from `shared/schema.ts`, which are built with `drizzle-zod`, so the
  client bundles the ORM. Hand-written Zod schemas for the four inputs (checked against the
  tables in a test) would remove it.
- **The diagram editor chunk is 542 kB (gzip ~170 kB).** What remains is mostly React Flow,
  the canvas, the sidebar, dagre and Radix; dagre could be loaded on first Auto Layout.
- **`useDiagramCanvas` and `useEdgeCreation` are still large (~590 and ~540 lines).** Loading,
  saving and layout could be separate hooks, and the "drag onto empty canvas" placeholder flow could
  become store actions.
- **`MetamodelAiAssistant` and `ModelRulesPanel` still receive `nodes`/`edges` as props**; they
  could read the diagram store like the inspector does.
- **`no-explicit-any` is switched off** in ESLint because the imported code uses `any` widely.

## Done
- Element ids were `node_${Date.now()}`, and template ids were fixed strings: creating a template
  twice failed with a 500, and two elements created in the same millisecond collided.
- Elements were never deleted when removed from diagrams; they now are once they are in no
  diagram, and a migration removes existing leftovers.
- No foreign keys; deletes were hand-written. Foreign keys with cascades, indexes on lookup
  columns, and a cleanup of rows that would violate them were added (migration 0002).
- Timestamps were stored without a time zone; they are `timestamptz` now (existing values read as UTC).
- The project list lived at `/api/users/:userId/projects` although the server knows the user;
  it is `GET /api/projects` now, and project creation no longer requires a `userId`.
- Unknown API routes answered `{error}` while everything else used `{message}`; all errors use `{message}` now.
- Gemini model names were hard-coded; `GEMINI_MODEL` now accepts a comma-separated fallback list.
- `server/routes.ts` (1,155 lines on Replit) is split into one module per area under `server/routes/`.
- Project export logic lived in the route handler; it is `server/services/project-export.ts` now, with tests.
- CSV export did not neutralise spreadsheet formulas (`=`, `+`, `-`, `@` at the start of a cell).
- Exporting with referenced metamodels failed with "Project not found" when a referenced metamodel had been deleted.
- `referencedMetamodels` was not validated: a project could reference itself, instance projects,
  missing projects or another user's metamodel. New references are now checked.
- `PATCH /api/projects/:id` accepted `userId`, so an update could change a project's owner.
- `tsconfig.json` had no `target`, so type checking assumed ES3.
- No linter: ESLint (TypeScript and React hook rules) now runs in CI. 78 unused imports, variables and props were removed.
- 16 unused shadcn/ui components and 16 dependencies only they (or nothing) used were removed.
- `client/index.html` loaded 25 Google font families and `index.css` loaded Inter and JetBrains Mono
  from Google, so the "local" app called a third party on every page load. Fonts are bundled now,
  and an e2e test checks that no request leaves the machine. The page also had no `<title>`.
- Everything was one 1.76 MB JavaScript bundle; pages are lazy-loaded, so the project list needs about 510 kB.
- The server stored any element `data`; it now requires an object with string text fields and a list of attributes (other fields stay open).
- The built server only found its migrations when started from the repository root; it now also looks next to the entry point.
- `DiagramCanvas.tsx` (2,813 lines) and `Sidebar.tsx` (2,015 lines) were split into hooks and components (1,378 and 640 lines now).
- Method projects and internal views were removed (decision D5), including their data (migration 0003).
- Resized elements lost their size on reload: the size was saved but only restored for internal-view containers. It is restored for every element now.
- The product name was spelled "MBSE Lite", "SymLit" and "Symlit"; it is "Symlit" everywhere now.
- The toolbar received `onAddNode`/`onAutoLayout` without buttons; there is now an Auto Layout button (undoable), and the unused add-node wiring is gone.
- Export with referenced metamodels now follows references recursively (a metamodel building on another one).
- Projects store the template they were created from (`template_id`); the old name-based quickstart detection is gone.
- Page zoom is allowed again; gestures on the canvas still pan/zoom the diagram only.
- The demo project's relationship connects proper side handles.
- Every diagram containing a relationship counted as changed right after opening (the saved baseline ignored load-time defaults), which triggered needless "unsaved changes" prompts. Fixed.
- Switching directly between an instance model and a metamodel left the sidebar blank (the tab state was reused with values the other project type does not have). Fixed.
- The old single-project quickstart was replaced by the guided tutorial.
- Auto layout multiplied all coordinates by 6 and assumed 200x100 cards, so diagrams spread out far; it now uses dagre with the real element sizes, keeps side-connected elements in one row, and stays where the diagram was. `entitree-flex` was removed.
- The export dialog now closes after a successful download (and stays open on errors).
- All React hook dependency warnings are fixed; `npm run lint` reports none.
- `useDiagramCanvas` computed per-element debug info that was never shown; it now only keeps the owning project per element (used to mark elements from referenced projects).
- Sidebar components spelled out long inferred types; they are named in `sidebar-parts/types.ts` now (`FlowQuery`, `PaletteItem`, `NodeMeta`, …).
- Drawing relationships was unreliable, especially with connections in several directions: each side had a source and a target handle stacked on the same spot, hidden until hover and shifted by CSS, so drags started on the wrong handle or dropped on none (4–5 of 8 test connections registered). Elements now have one handle per side (`top`/`right`/`bottom`/`left`) in React Flow's loose connection mode; old handle ids are mapped on load (`normalizeHandleId`). `e2e/edge-handles.spec.ts` draws all directions both ways.
- New metamodel relationships got React Flow's generated id instead of a UUID.
- `DiagramCanvas.tsx` was ~1,300 lines of wiring (about 290 values passed by hand between 20 hooks). Editor state moved into a per-diagram Zustand store and a model context; hooks and connected components read them directly. It is ~500 lines now.
- Undo history was shared across diagrams: undo right after switching diagrams could bring back the previous diagram's elements. History now resets when a diagram loads.
- On an empty diagram, React Flow's fit-to-view zoomed onto the first element dropped in, so a second element dropped quickly could land off-screen. The canvas now only fits on mount when the diagram already has elements.
- Undo after creating an element from the "drag a relationship onto empty canvas" menu brought back the temporary placeholder element.
- The tutorial browser test failed locally in the full suite (CI's retries hid it): skipping a step that navigates briefly hid the skip button and ended the loop early.
- The diagram editor chunk was 1,155 kB: `import * as Icons from "lucide-react"` (to look icons up by name) bundled every icon. A registry (`client/src/lib/node-icons.ts`) holds the names elements can use, with a test; the attribute panels, model rules panel, AI assistant, edit-view dialog and screenshot library load on first use. It is 542 kB now.
- ELK was evaluated for Auto Layout and not adopted; see the decision record.
