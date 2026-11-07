# Backlog: findings to tackle later

Things noticed while moving Symlit off Replit that are not fixed yet. Each entry says
where it is and why it matters. Fixed items move to the "Done" list at the bottom with the
commit that fixed them.

## Open

### Data model
- **Internal views of deleted elements are left behind.** An element is now deleted when it
  leaves its last diagram, but `views.parent_node_id` of its internal views is not cleaned up
  (`server/services/internal-views.ts`). Internal views are behind `SYMLIT_INTERNAL_VIEWS`, so
  this only matters once that feature is turned on.
- **Element ids are global primary keys.** Ids are now random UUIDs, so collisions are
  practically impossible. A composite key `(project_id, id)` would make the
  model cleaner, but every edge, placement and reference would have to change.
- **`node_views.parent_id` and `views.parent_node_id` have no foreign keys.** Parent elements
  may legitimately live outside the view, so they were left unconstrained.
- **Starter templates cannot reuse an element in two views.** `validateStarterTemplate` rejects
  the same node id in several views, although the data model supports it.

### Server
- **Export ignores nested metamodel references.** "Include referenced metamodels" exports only
  the directly referenced metamodels, while the editor resolves references recursively
  (`metamodel-reference-resolution.ts`). An export of an instance whose metamodel builds on
  another metamodel is therefore incomplete.

### Client
- **Seven React hook dependency warnings** (`npm run lint`), in `DiagramCanvas.tsx`, `useDiagramCanvas.ts`,
  `useEdgeCreation.ts` and others. Some are missing dependencies (possible stale values), others
  unnecessary ones. Each needs a look with the canvas tests running, not a blanket fix.
- **Toolbar ignores `onAddNode` and `onAutoLayout`.** `DiagramToolbar` receives both handlers,
  but has no button for them, so auto layout of the whole diagram is not reachable from the toolbar.
  Decide whether to bring the buttons back or remove the props and the callers' wiring.
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
