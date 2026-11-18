# Architecture

Symlit is a single TypeScript package with three source folders:

```
client/   React single-page app (Vite)
server/   Express API, database access, startup
shared/   Database schema, API contract and domain logic used by both sides
```

## Stack

- **Client:** React 18, Vite, wouter (routing), TanStack Query (server state),
  Tailwind CSS + shadcn/ui + Radix, `@xyflow/react` (diagram canvas), Framer Motion.
- **Server:** Express 4, Drizzle ORM, PostgreSQL. The `pg` driver is used with `DATABASE_URL`,
  otherwise embedded PGlite.
- **Shared:** Zod schemas for validation and typed contracts. `shared/contracts.ts` holds the parts
  the browser needs and must not import the database layer (it would bundle the ORM); `shared/schema.ts`
  defines the tables and re-exports the contracts.

## Startup

`server/index.ts`:

1. loads `.env` (if present), then `loadConfig()` (`server/config.ts`) validates the environment.
2. `initDatabase()` (`server/db.ts`) opens PostgreSQL or PGlite and **applies the migrations
   in `migrations/`**.
3. `createApp()` (`server/app.ts`) builds the Express app: JSON parsing, request logging
   (method/path/status/duration only), local identity, authorization, and routes.
4. On first start, `seedDemoProject()` (`server/seed.ts`) creates a demo project.
5. In development, Vite middleware serves the client with hot reload; in production
   `server/static.ts` serves `dist/public`. Everything is served on one port.

`createApp()` does not listen or serve the client, so tests can start it on a random port.

## Identity and authorization (local edition)

The local edition is single-user. `createLocalAuth()` (`server/auth.ts`) resolves every API
request to one implicit user (username `local`). There is no login and no session.

`authorizeWorkspaceApi()` still checks ownership for every request that targets a project,
view or node. The project id is resolved from the path, or from the view or node, and must belong
to the current user. Ids sent by the browser are never trusted. This keeps the API safe if
multi-user editions are added later. The role model in `shared/authorization.ts` is kept
for the same reason. The local user is `admin` of their own projects.

## Configuration and feature flags

`GET /api/config` returns the public configuration (`edition`, `version`, `features`).
`client/src/main.tsx` loads it **before** importing the app, so the module-level flags in
`client/src/lib/feature-flags.ts` (`AI_ASSISTANT_ENABLED`) reflect
the server's settings.

## API contract

`shared/routes.ts` is the single source of truth for every endpoint: path, method, Zod input
and response schemas. The server registers handlers from it, the client calls it through
`apiCall()` (`client/src/lib/api-client.ts`), and the 404/405 fallback for unknown `/api` paths
is derived from it.

To add an endpoint: add it to `shared/routes.ts`, implement it in `server/routes/`, add a client
hook, and add an API test in `server/app.test.ts`.

## Domain model

Defined in `shared/schema.ts`:

| Table | Meaning |
| --- | --- |
| `users` | Workspace users (one, `local`, in the local edition) |
| `projects` | `metamodel` or `instance`. Instance projects list `referencedMetamodels` |
| `views` | Diagrams inside a project. `viewType` is `view` or `pattern` (saved pattern) |
| `nodes` | Model elements. **They belong to the project, not to a view**; payload is JSON in `data` |
| `node_views` | Where a node appears in a view (position, parent). Key: `(node_id, view_id)` |
| `edges` | Relationships, stored per view |

Patterns are stored as views with `viewType = "pattern"` plus normal nodes and edges.

Relationships (`edges`) are defined in `shared/relationships.ts`. Every server write goes through
`normalizeRelationship()`, so stored relationships always have one of the six known types in
`edge_type`, the same type in `data.edgeType`, a side handle (`top`/`right`/`bottom`/`left`) at each
end, and an object as `data`. Saving checks `data` with `relationshipDataSchema`: known fields must
have the right type, other fields are kept. Reading stays lenient (`flowEdgeSchema`) so unexpected
stored data never stops a diagram from opening; migration 0005 cleaned existing data to this form.

Model rules are stored per diagram (`views.model_rules`, `modelRuleSchema` in `shared/contracts.ts`). A
rule's condition is text (`expression`) in the rule language of `shared/rule-text.ts`, which builds on the
formula language of `shared/formula.ts` (one `formulaReader` reads both): parsing, printing, the rules
panel's lists (`builderFromRule` / `ruleFromBuilder`) and storing names as ids (`storeRuleCondition` /
`displayRuleCondition`). `shared/rule-evaluation.ts` evaluates a condition over a `RelatedGraph` with the
Related Formula calculator, so rules and formulas see the same relationships. Rules saved with the older
`condition` structure are converted on reading.

Metamodel vocabulary: built-in node types (Object, Behavior, Concern, Performer, Need,
Event, Capability) and relation types (Association, Aggregation, Composition,
Generalization, Dependency, Realization) live in `shared/metamodel-setup.ts`. Projects without
setup metadata expose the full palette. Adding a type means updating that catalog, the recommendation
presets, the renderers/editors, and this document together.

## Server layout

- `server/routes/`: thin handlers, one module per area (`projects`, `views`, `flow`, `patterns`, `export`, `ai`, `session`). They parse input, call storage or services, and map errors to HTTP. `routes/index.ts` registers them and the JSON 404/405 fallback.
- `server/storage.ts`: plain CRUD (`IStorage`). It must stay plumbing only.
- `server/services/*`: business rules.
  - `flow-mutations.ts`: loading, validating, syncing and recovering diagrams; inserting nodes and patterns.
  - `patterns.ts`, `model-validation.ts`.
  - `gemini-metamodel.ts`: the optional AI assistant.
- `server/db.ts`: driver selection and migrations. `db` is a live binding that is set once at startup.

## Client layout

- `client/src/pages`: `ProjectList` (`/projects`) and `ProjectView` (`/project/:id`, `/project/:id/view/:viewId`).
- `client/src/hooks`: React Query hooks per resource (`use-projects`, `use-views`, `use-flow`, …) and `use-auth`.
- `client/src/components/flow`: the diagram editor (the largest and fastest-moving area).
  - **State.** Each open diagram has one Zustand store (`state/diagramStore.ts`, provided by
    `DiagramStoreProvider`): nodes, edges, undo history, selection, open panels, the pending
    delete, help dialog and table filters, plus actions such as `selectNode`, `openNodePanel` and
    `confirmDelete`. Read it with `useDiagramStore(selector)`. Read-only model information (project
    and view, metamodel types, inheritance, allowed relationships, model rules, which elements come
    from referenced projects) is computed once by `DiagramModelProvider` and read with
    `useDiagramModel()`. New editor state belongs in the store, not in `DiagramCanvas` props
    (see `docs/decisions/diagram-editor-state-and-libraries.md`).
  - `canvas/DiagramCanvas.tsx` (~500 lines) sets up the providers and lays out the canvas. Hooks next
    to it each handle one concern and read the store/model themselves: `useDiagramLoading`,
    `useDiagramSaving` (conversion in `hooks/diagram-serialization.ts`), `useLayoutActions`,
    `useAddElement`, `useCanvasDisplayGraph` (what React Flow renders), `useCanvasElementActions`
    (edit, copy, delete, re-type, reverse), `useEdgeCreation` (= `useConnectElements` +
    `useDropOnCanvas`, defaults in `utils/relationship-defaults.ts`), `useCanvasInsertion` and
    `useCanvasDropInsertion` (sidebar inserts and drops), `usePatternCreation`,
    `useCanvasSidePanels` (model rules / AI panels), `useCanvasAiProposal`,
    `useEdgeRelationConfirmation`, `useCanvasActionRequests` (actions requested from the sidebar),
    `useSelectedNodes`, `useInheritedTypeStyles`. Connected components own their wiring:
    `CanvasToolbar`, `CanvasInspectorPanels`, `ConnectedCanvasTableMode`, `CanvasEdgeCreateMenu`,
    `CanvasDeleteDialog`, `DiagramLoadError` (incl. repair). Other dialogs are separate components
    (`SavePatternDialog`, `DiagramHelpDialog`, `ValidationResultsDialog`, `UnsavedChangesDialog`).
  - `nodes/*` and `edges/*` are the renderers.
  - `panels/*` are the attribute editors.
  - `hooks/*` hold canvas state, edge creation, validation, playback and screenshots.
  - `utils/*` hold layout, inheritance and reference resolution.
- `client/src/components/layout`: sidebar and view dialogs. `Sidebar.tsx` wires state together;
  `sidebar/useSidebarFlowData` loads local and referenced diagrams, `sidebar/useViewOrdering`
  handles drag-to-reorder, and `sidebar-parts/` holds the header, tabs, footer, view element lists
  and the two palettes.
- `client/src/components/flow/utils/autolayout.ts`: whole-diagram Auto Layout (dagre; side-connected elements share a row, other relationships form a hierarchy; afterwards relationships are re-attached to the sides that face each other).
- `client/src/lib/diagram-events.ts`: in-app event bus (context-owned `EventTarget`) between the sidebar, toolbar and canvas.
- `client/src/components/ui`: shadcn/ui primitives.

Frontend notes:

- Every element has four handles, one per side, with the side as id (`top`, `right`, `bottom`,
  `left`). React Flow runs in loose connection mode, so any handle can start or end a relationship;
  its direction is where the drag started. Diagrams saved with the older ids (`top-source`,
  `right-target`, `null`, …) are mapped by `normalizeHandleId()` (`flow/utils/edge-utils.ts`) on load.

- React Flow needs an explicitly sized container. `DiagramCanvas` owns that layout.
- Registering a renderer erases custom node/edge data types, so normalise data at that
  boundary (see `docs/decisions/react-flow-custom-data-boundary.md`).

## Database migrations

Schema changes are made in `shared/schema.ts`, followed by `npm run db:generate` to write a
SQL migration to `migrations/`. Commit both. CI fails if the schema and migrations drift apart.

## Tests

| Kind | Location | Database |
| --- | --- | --- |
| Unit | `**/*.test.ts` next to the code (`node:test`) | – |
| Database and services | `server/services/*.test.ts` (uses `withTestDatabase()`) | fresh in-memory PGlite per file, or a throwaway database on `TEST_DATABASE_URL` |
| API | `server/app.test.ts` (real app on a random port) | same as above |
| Browser | `e2e/*.spec.ts` (Playwright) | real server with an in-memory database. Some specs mock the API to cover edge cases |

## Project templates and project files

- A project file is the JSON export (`shared/project-file.ts`): a main project, the metamodels it
  references and their patterns. `server/services/project-import.ts` imports one with fresh ids,
  rewiring references, types, rules (also the types and relationships their text names), pattern
  origins, and the relationship ids that formulas and recorded metamodel relationships point at.
- Built-in project templates are project files in `server/templates/` (bundled into the server
  build). `GET /api/project-templates` lists them, `POST /api/project-templates/:id/projects`
  creates their projects. See `docs/decisions/project-templates.md`.

## Guided tutorials

- `shared/tutorial.ts` lists the tutorials. Each is a `TutorialDefinition` (`shared/tutorial-types.ts`):
  its lessons and steps, its question and answer, and the project template its projects come from
  (`server/templates/tutorial*.json`, one per tutorial: basics, ppr, calc, classify, structure,
  reuse, each defined in `shared/tutorial-<id>.ts`). The templates are written by hand or with a
  small generator kept outside the repository; they are ordinary project files.
- `POST /api/tutorial/:tutorial` (`server/services/tutorial.ts`) creates the projects from the
  tutorial's template. The first metamodel and the model are marked with the template's id in
  `projects.template_id`; further projects of the template (a second metamodel) with that id plus
  `+extra`. A run's projects are those created together, between one of its metamodels and the
  next. `DELETE /api/tutorial/:tutorial` removes them and, for a tutorial with steps in a copy of
  its model, any model that uses their metamodels (the copies the learner made).
  `projectsRemovedWithTutorial()` in `shared/tutorial.ts` decides which, for the server and for the
  confirmation that lists them first. Without an id, `POST /api/tutorial` creates the first
  tutorial and `DELETE` removes all.
- **Where a step happens** (`scope`): the tutorial's metamodel, its model, the project list
  (`projects`, checked with `checkProjects` on a `TutorialWorkspaceState`), or a `variant`: a model
  the learner made that uses the tutorial's metamodel, such as a copy. A step can also name the
  diagram it happens in (`view`).
- **When a step is done:** when the model shows its result (`check`), when a feature was used
  (`signal`), or both. `afterPrevious` holds a step back until the steps before it in its lesson
  are done or skipped, for checks that are true from the start; `afterPrevious: "done"` until the
  step right before it is done, for a check that also holds when that step never happened. A save
  step is judged on the saved state (`!state.dirty`) once the work before it is done, not on a save
  signal: a diagram saved early, or saved automatically, has nothing left to save. A check that has
  to know what a formula calculates uses `calculates()`, which evaluates the formula on sample
  inputs, so that any way of writing the same calculation counts and a wrong one does not; checks
  that only ask which attributes a formula uses (`calculatedFrom()`) leave the calculation to the
  learner. The canvas reports the open diagram to the
  coach as a `TutorialModelState` (`useTutorialModelReporter`, only in a run's projects): elements
  with their type, attributes (type, unit, formula, references, the value calculated now), tags,
  colour and whether they have a style of their own; relationships with kind and name; the open element or relationship editor; the
  table filter; the saved rules with their conditions; the diagram's name and the project's
  diagrams; the model's metamodels; unsaved changes. It is reported when it changes and on request,
  and not before the diagram, its rules and its types are loaded. Signals come from
  `emitTutorialSignal()` (`client/src/lib/tutorial-signals.ts`) where the action happens; `saved`
  is sent when a save went through, however it was started.
- `client/src/lib/tutorial-progress.ts` holds the pure progress logic (unit-tested): which step is
  current, that steps of a later lesson wait, that the current lesson's steps come before skipped
  ones, skipping, the question that closes a lesson. Progress is stored in the browser per run;
  that a tutorial was finished is stored apart and survives removing its projects.
  `useTutorialCoach` renders the coach in a run's projects, `useTutorialCoachOnProjectList` on the
  project list when a run's next step happens there; `TutorialCards` offers the tutorials.
- To add a step: add it to a lesson with a `check` (extend `TutorialModelState` and the reporter
  if the state lacks what the check needs), a `done` text, and a `highlight` for "Show me". To add
  a tutorial: write its definition and template, add it to `TUTORIALS` and to the built-in
  templates in `server/services/project-templates.ts`, and walk it in a browser test
  (`e2e/tutorial-<id>.spec.ts`, helpers in `e2e/support/tutorial.ts`). The unit tests check every
  definition against the rules a step and a lesson must follow.
- The didactic reasoning is in `docs/ux/TUTORIAL_DIDACTICS.md`, the plan and its checklists in
  `docs/ux/TUTORIAL_ROADMAP.md`.

## Design decisions

Short records of non-obvious decisions are kept in [`docs/decisions/`](decisions/).
