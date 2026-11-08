# Symlit: Replit → GitHub migration plan

Status: **local edition complete and stable on `main`** (PRs #1–#4). Hosted edition deferred.
Based on an analysis of the Replit export (`Symlit.zip`, last Replit commit `bdc7732`, 217 commits).

### Decisions taken

- **Only the local edition lives in this repository for now.** Hosted features (Clerk accounts,
  guest workspaces, members and invitations, public share links, legacy workspace claim) were
  left out of the import entirely and are deferred. They are not in this repository's history.
  When the hosted edition is picked up again, it starts from the Replit export and plugs into
  the seams described in §4. Where it should live (D1) is decided at that point.
- **Fresh git history** (D2): the Replit history is not imported, because it contains a plain-text API key.
- **PostgreSQL everywhere**: Docker Compose or embedded PGlite locally (§4.4).
- **Local edition is single-user** (D4).
- **Method projects and internal views were removed** (D5, migration 0003).
- **Product name is "Symlit"** everywhere.
- The **AI assistant** stays in the local edition as an optional feature (bring your own Gemini key).

### Progress

| Item | State |
| --- | --- |
| Clean import without Replit artefacts, secrets or hosted code | done |
| Lockfile from the public npm registry, package renamed `symlit`, licence aligned to Apache-2.0, unused dependencies and Replit plugins removed | done |
| Versioned migrations (`migrations/0000_initial.sql`), applied on startup and by `npm run db:migrate` | done |
| PGlite (default) and PostgreSQL drivers; `docker-compose.yml`; `Dockerfile` | done (image build not yet verified) |
| Validated configuration (`server/config.ts`), `GET /api/config`, runtime feature flags | done |
| App factory (`createApp`), demo seed moved out of route registration | done |
| Security findings 2–5 (no sessions any more; same-origin only; no response bodies in logs; error handler fixed) | done |
| Implicit local user, no login; UI gating for the AI assistant and internal views | done |
| Unused `patterns`/`pattern_nodes`/`pattern_edges` tables dropped (Phase 5 item) | done |
| Tests: config, API integration (incl. ownership checks), DB tests on PGlite **and** PostgreSQL, full-stack Playwright spec | done |
| CI (typecheck, tests on PGlite and PostgreSQL 16, build, migration drift check, Playwright) | done |
| Split `server/routes.ts` into domain routers (Phase 2.3) | done |
| Foreign keys, indexes, timestamptz, `GET /api/projects` (Phase 5) | done |
| Element id collisions fixed; elements deleted when in no diagram | done |
| ESLint in CI, dead code and unused UI components/dependencies removed | done |
| Fonts bundled (no third-party requests), pages lazy-loaded | done |
| `DiagramCanvas.tsx` / `Sidebar.tsx` split into hooks and components (Phase 7, first pass) | done |
| Method projects and internal views removed; resized elements keep their size | done |
| Auto Layout toolbar button (dagre, real element sizes) | done |
| Guided tutorial (two linked projects, coach panel, 15 auto-detected steps) replacing the quickstart | done |
| Recursive metamodel export, `projects.template_id`, page zoom, demo seed handles | done |
| "Unsaved changes" on open and blank sidebar bugs fixed; zero lint warnings | done |
| `docker compose up --build` verified on a machine with Docker | **open – needs the owner** |
| Further frontend decomposition, relationship data validation, smaller findings | tracked in [`BACKLOG.md`](BACKLOG.md) |
| First release (tag `v0.1.0`) | open |
| Hosted edition (Phases 4 and 6) | deferred; decide D1 (same repo vs private repo) first |

### Pull requests

| PR | Content |
| --- | --- |
| #1 | Import of the local edition, PGlite/Postgres, CI, ID fix, foreign keys, route split, lint, fonts, canvas/sidebar split |
| #2 | Remove method projects and internal views, rename to Symlit, Auto Layout button |
| #3 | Guided tutorial; recursive export, template ids, page zoom, seed handles; two load/sidebar bugs |
| #4 | Auto layout spacing, export dialog closes, all hook warnings fixed |

### Working notes for contributors

- Run everything locally with `npm ci && npm run dev`; checks: `npm run check`, `npm run lint`,
  `npm test` (PGlite), `npm run test:postgres`, `npm run test:e2e`.
- Element ids are global primary keys: always generate them with `newNodeId()` / `newEdgeId()`
  (`client/src/lib/ids.ts`); the server re-ids templates and patterns.
- An element is deleted when it is in no diagram any more (`deleteUnplacedNodes`).
- Schema change = edit `shared/schema.ts` + `npm run db:generate`; CI fails on drift. Hand-written
  data clean-up goes at the top of the generated migration (see 0002, 0003).
- New tutorial steps: `shared/tutorial.ts` + `emitTutorialSignal()` where the action happens.
- `e2e/tutorial.spec.ts` must not run concurrently with itself (one tutorial per workspace).
- Relationships: write them through `normalizeRelationship()` (`shared/relationships.ts`); the save
  schema rejects unknown types, handles and wrongly typed data fields.
- Diagram editor state lives in the per-diagram store (`useDiagramStore`) and model context
  (`useDiagramModel`); don't thread it through `DiagramCanvas` props.

The rest of this document is the original analysis and plan. Hosted-edition sections are kept for
when that work resumes.

---

## 1. Summary

- **Approach: import the whole app, then split and test it in place.** Rebuilding it
  piece by piece in a new skeleton would mean ~36k lines with no working baseline in between.
  Instead, the first PR imports a cleaned snapshot that still works. Each later PR moves one
  feature into its edition module and adds tests for it, so `main` is always runnable.
- **One codebase, two editions, selected at runtime.** `SYMLIT_EDITION=local|hosted` plus
  feature toggles produce a config object. The server mounts hosted modules only when they
  are enabled. The client reads `GET /api/config` and only shows enabled features.
  The same build and Docker image serve both editions.
- **Database: PostgreSQL everywhere, no SQLite.** The schema is Postgres-specific
  (`jsonb`, `serial`, `'[]'::jsonb` defaults, async transactions, `ON CONFLICT` upserts,
  Postgres session store). A second SQLite schema would have to be kept in sync with it forever.
  Instead, the local edition runs Postgres in one of two ways:
  - **Docker Compose** (`postgres:16`) for people who have Docker, or
  - **embedded PGlite** (Postgres compiled to WASM, data stored in `./data/`) when no
    `DATABASE_URL` is set: `npm ci && npm run dev` with no other setup.
  - Verified on the export: the unchanged schema migrates into PGlite, and the existing
    DB-backed `flow-mutations.test.ts` passes 5/5 on in-memory PGlite. Only the DB
    module was swapped. The same mechanism lets CI run DB tests without a Postgres service.
- **Local edition = single implicit user.** No login screen. The local user owns all projects
  as admin. Clerk, guest sessions, invitations and members are hosted-only.

---

## 2. What the export contains today

| Area | State |
| --- | --- |
| Stack | React 18 + Vite + wouter + TanStack Query + shadcn/Radix + `@xyflow/react`; Express 4 + Drizzle ORM + `pg`; shared Zod contracts in `shared/routes.ts` |
| Size | ~36.5k lines TS/TSX. Hotspots: `DiagramCanvas.tsx` 2,836, `Sidebar.tsx` 2,036, `server/routes.ts` 1,155, `NodeAttributePanel.tsx` 971, `server/storage.ts` 823 |
| Type check | `tsc` clean |
| Unit tests | `node:test`, 14 files. 13 run without a DB: **59/59 pass**. `flow-mutations.test.ts` needs a DB (passes on PGlite) |
| E2E | Playwright, 6 specs. Most mock the API with `page.route`. `clerk-auth`/`invitation-only-registration` need real Clerk credentials |
| DB schema mgmt | `drizzle-kit push` only, **no migration files**. 12 tables, **0 foreign keys** (cascades are hand-written in `storage.ts`) |
| Docs | `replit.md` (partly stale: it still describes username-only `localStorage` auth), `client/requirements.md`, `.agents/memory/*.md` (good architecture decision notes), `metamodel-instance-quality-findings.md` |

### Replit coupling that has to go

- `.replit`, `.config/`, `.agents/`, `.claude/`, `scripts/post-merge.sh` (Replit task-merge hook)
- `package-lock.json`: **33 tarball URLs point at `http://package-firewall.replit.local`**, so
  `npm ci` fails outside Replit (E405). Rewriting them to `registry.npmjs.org` fixes it (verified).
- `@replit/vite-plugin-*` (3 dev plugins) in `vite.config.ts` / `package.json`
- **Replit-managed Clerk**: `server/middlewares/clerkProxyMiddleware.ts` says auth is configured
  through Replit's Auth pane, with no separate Clerk dashboard. The hosted edition will need its own
  Clerk application (see §7).
- Replit Postgres (`DATABASE_URL`) and the `db:push` workflow
- Build artefacts and leftovers: `dist/`, `exports/`, `sqlite.db` (unused, the app runs on
  Postgres), `test-results/`, `script/build.ts` bundling allowlist from a template
  (`stripe`, `openai`, `nodemailer`, … are not used)

### Security findings (act on these first)

1. **A live `GEMINI_API_KEY` is stored in plain text in `.replit`** (`[userenv.shared]`), and
   `.replit` is tracked in the Replit git history. **Rotate the key now.** `.replit` and the
   Replit history will not be imported (see decision D2).
2. `SESSION_SECRET` falls back to the hard-coded `"development-session-secret"` when unset,
   including in production.
3. CORS is `origin: true, credentials: true`, which reflects any origin with cookies.
4. The API request logger writes **full JSON response bodies** (diagram contents, user records)
   to the log.
5. The Express error handler sends a response and then re-throws the error.

---

## 3. Feature inventory and edition classification

Legend: **Core** = open-source, in both editions. **Core (opt.)** = in both editions,
off unless configured. **Hosted** = hosted edition only.

| Feature | Main code | External dependency | Edition | Notes |
| --- | --- | --- | --- | --- |
| Projects: metamodel / instance | `pages/ProjectList.tsx`, `ProjectView.tsx`, `use-projects.ts`, `storage.ts` | – | Core | |
| Method projects | `project-types.ts`, filtered out in `ProjectList.tsx` | – | Core (hidden) | Currently hidden in the UI. Keep or remove? (D5) |
| Views, nodes, per-view placement, edges | `views`, `nodes`, `node_views`, `edges`; `services/flow-mutations.ts` | – | Core | |
| Diagram editor (all node/edge types, styling, attributes, formulas, inheritance, clipboard, undo/redo, table mode, snapping) | `client/src/components/flow/**` | – | Core | Fastest-moving area |
| Metamodel setup and magic types/relations | `shared/metamodel-setup.ts` | – | Core | |
| Referenced metamodels, build/flow mode, playback, external stubs | `useMetamodelParts.ts`, `metamodel-reference-resolution.ts`, `useFlowPlayback.ts` | – | Core | |
| Patterns (save/insert) | `services/patterns.ts`, `SidebarPatternPalette.tsx` | – | Core | The `patterns*` tables are unused (patterns are views with `viewType="pattern"`) |
| Internal views | `services/internal-views.ts`, `INTERNAL_VIEWS_ENABLED=false` | – | Core (flagged) | Move the flag into runtime config |
| Model rules and validation, diagram recovery | `rules/model-rules.ts`, `services/model-validation.ts`, `DiagramRecoveryDialog.tsx` | – | Core | |
| Starter templates and quickstart | `lib/project-templates.ts`, `QuickstartGuide.tsx` | – | Core | |
| Export JSON / CSV, screenshots | `routes.ts` export handler, `useDiagramScreenshot.ts` | – | Core | |
| Roles and authorization model (guest < viewer < engineer < architect < admin) | `shared/authorization.ts`, `server/auth.ts` (`authorizeWorkspaceApi`, `requireProjectRole`) | – | Core | Already role-based. The local user is admin of their own projects |
| **AI metamodel assistant** | `services/gemini-metamodel.ts`, `MetamodelAiAssistant.tsx`, `shared/ai-metamodel.ts` | Gemini API | **Core (opt.)** | Local users can supply their own key. Today the UI is always shown and returns 503 without a key, so it should be hidden instead |
| **Clerk sign-in/up, invitation-only registration, Clerk proxy** | `App.tsx`, `use-auth.ts`, `server/auth.ts`, `clerkProxyMiddleware.ts`, `shared/auth-policy.ts` | Clerk | **Hosted** | `App.tsx` currently throws when no Clerk key is set, which blocks a local run |
| **Guest workspaces** (try without an account, persistent session) | `/api/auth/guest*`, `express-session` + `connect-pg-simple` | – | **Hosted** | Not needed locally |
| **Project members and invitations** | `/api/projects/:id/members/**`, `ProjectMembersDialog.tsx`, `project_memberships`, `project_invitations` | Clerk Invitations API (sends e-mail) | **Hosted** | |
| **Legacy workspace claim** | `/api/auth/legacy*`, `claimLegacyProjects` | – | **Hosted (temporary)** | Replit-era migration of username-only users. Remove after the cut-over |
| **Public diagram share links** (hashed tokens, snapshots, expiry) | `services/diagram-sharing.ts`, `/api/shares/:token`, `SharedDiagramPage.tsx`, `DiagramShareDialog.tsx` | – (needs a public URL) | **Hosted** | No third-party dependency, so it could be offered to self-hosters later via `PUBLIC_BASE_URL` |
| Demo seed ("Default" user + "Demo Project" created on every boot) | end of `registerRoutes` | – | Core (local first run) | Becomes an explicit seed step |

---

## 4. Target architecture

### 4.1 Configuration and editions

```
server/config.ts   (zod-validated env → AppConfig, fail fast)
  edition:   "local" | "hosted"                    (SYMLIT_EDITION, default "local")
  database:  { url? }  → node-postgres if set, else PGlite at SYMLIT_DATA_DIR (default ./data)
  auth:      local → { mode: "local" } | hosted → { mode: "clerk", publishableKey, secretKey, sessionSecret }
  features:  { ai, sharing, members, guestAccess, legacyClaim, internalViews }
             defaults come from the edition; env can override (ai = GEMINI_API_KEY present)
```

In the hosted edition, startup fails if `SESSION_SECRET`, `CLERK_SECRET_KEY` or `DATABASE_URL`
are missing. The local edition needs no env at all.

`GET /api/config` (public) returns the client-safe subset:
`{ edition, auth: { mode, clerkPublishableKey? }, features: {...} }`.

### 4.2 Server

```
server/
  main.ts               ← loads config, createDatabase, createApp, listen
  app.ts                ← createApp(config, deps): express app, no listen (testable)
  config.ts
  db/
    index.ts            ← createDatabase(config) → { db, close }  (pg | pglite)
    migrate.ts          ← runs ./migrations on startup (opt-out flag)
    seed.ts             ← local first-run demo content
  auth/
    provider.ts         ← interface AuthProvider { resolve(req) → { user, kind, role } | { error } }
    local.ts            ← single implicit local owner (core)
    authorize.ts        ← authorizeWorkspaceApi, requireProjectRole (core, unchanged logic)
  routes/               ← split of today's routes.ts, one router per domain
    projects.ts views.ts nodes.ts flow.ts patterns.ts internal-views.ts export.ts config.ts
  services/             ← as today (flow-mutations, patterns, internal-views, model-validation)
  storage/              ← storage.ts split by aggregate; takes `db` via constructor
  modules/              ← optional / hosted modules, mounted by createApp based on config.features
    ai/                 ← AiProvider interface + Gemini implementation + route
    clerk-auth/         ← ClerkAuthProvider, Clerk proxy, invitation-only policy
    guest/              ← guest sessions (express-session + connect-pg-simple)
    members/            ← memberships + invitations (InvitationService interface → Clerk impl)
    sharing/            ← public share links
    legacy-claim/
```

Existing names and contracts stay: `shared/routes.ts` is still the single API contract, and
the 404/405 handler keeps deriving from it.

### 4.3 Client

- Boot: fetch `/api/config`, then render `<AppProviders config>`.
- `AuthContext` with two implementations behind the same `useAuth()` shape:
  - `LocalAuth`: always signed in as the local user. No login page; `/` and `/login` redirect to `/projects`.
  - `ClerkAuth`: today's `use-auth.ts`. `ClerkProvider` and the `SignIn`/`SignUp` routes are loaded with
    `React.lazy` only when `auth.mode === "clerk"`, so the local edition never loads Clerk.
- Feature gating comes from `config.features` instead of `authKind === "clerk"` checks
  (Share button, Access/Members button, AI assistant toggle, guest banners).
- `INTERNAL_VIEWS_ENABLED` moves into `config.features.internalViews`.

### 4.4 Database

- **Versioned migrations** in `migrations/` (`drizzle-kit generate`) replace `db:push`.
  Verified: the current schema generates a clean baseline (`0000_baseline.sql`, 12 tables).
- Migrations run on startup (both editions) and through `npm run db:migrate`.
- Local: PGlite in `./data/pg` by default, or `DATABASE_URL` pointing at
  `docker compose up db`.
- Tests: in-memory PGlite per test file, migrated from the same `migrations/`.

### 4.5 Open-core packaging (decision D1)

| Option | What it means | Pros | Cons |
| --- | --- | --- | --- |
| **A. Single public repo, hosted modules activated by config** *(recommended to start)* | `server/modules/*` and client equivalents live in this repo under Apache-2.0 | Simplest. One CI, one image. The hosted code contains no secrets (those live in env vars) | Anyone can self-host the "hosted" features if they bring Clerk keys |
| B. Public core + private `symlit-hosted` repo | Hosted modules are a private package that registers into the same seams | Hosted code stays closed | Two repos, versioning, two CIs |
| C. `ee/` folder under a separate source-available licence | Like GitLab / Cal.com | One repo, commercial protection | Licence management, contributor confusion |

The module seam in §4.2 is the same for all three options, so the choice can wait until just before
the repo goes public. The GitHub repo is currently **private**. If B is chosen, Phase 4 hosted
modules go to the private repo instead of this one.

---

## 5. Testing strategy

| Layer | Tooling | What it covers | Runs in CI |
| --- | --- | --- | --- |
| Unit (logic) | `node:test` + `tsx` (keep the existing setup) | shared schemas, model rules, formulas, reference resolution, layout, policies | always |
| Storage / service | `node:test` + in-memory PGlite + migrations | flow sync/recovery, patterns, internal views, cascades, transactions | always |
| API integration | `node:test` + `supertest` against `createApp()` + PGlite | every router: happy path, validation (400), not-found (404), contract parity with `shared/routes.ts` | always |
| **Authorization matrix** | table-driven integration test | role × endpoint × method → expected status, for local and hosted auth providers. Guards the most security-critical code in the hosted edition | always |
| E2E local | Playwright against the real server + PGlite (no API mocks) | create metamodel → instance → typed nodes → relationships → save → reload → export | always |
| E2E mocked UI | existing Playwright specs | canvas edge visuals, recovery dialog, AI assistant UI | always |
| E2E hosted | existing Clerk specs | real sign-in, roles, invitation-only | opt-in (CI secrets), nightly |

Coverage gates are introduced per module as it is ported, not globally on day one.

---

## 6. Phased plan (each bullet ≈ one PR)

### Phase 0: Clean import (no behaviour change)
- **0.1 Import snapshot** with a fresh history (D2). Exclude `.replit`, `.config/`, `.agents/`,
  `.claude/`, `scripts/post-merge.sh`, `dist/`, `exports/`, `sqlite.db`, `test-results/`.
  Move `.agents/memory/*.md` to `docs/decisions/`, the QA findings to `docs/qa/`,
  and a few screenshots to `docs/images/`.
- **0.2 Tooling hygiene:** package name `symlit`, licence field `Apache-2.0` (it says MIT today),
  lockfile URLs rewritten to `registry.npmjs.org`, Replit Vite plugins removed, `.nvmrc` and
  `engines` set, `script/build.ts` allowlist trimmed. Remove dependencies with no imports (verify each:
  `passport`, `passport-local`, `memorystore`, `better-sqlite3`, `@types/better-sqlite3`, `ws`,
  `next-themes`, `react-icons`, `@jridgewell/trace-mapping`, `@dnd-kit/*`).
- **0.3 Docs:** `README.md` (what Symlit is, quickstart), `docs/ARCHITECTURE.md` (from `replit.md`,
  corrected for the current auth model), `CONTRIBUTING.md`.
- **0.4 CI:** GitHub Actions running `npm ci`, `tsc`, unit tests and build on every PR.
- *Done when:* CI is green, and the app runs exactly as on Replit given Postgres and Clerk env vars.

### Phase 1: Postgres that runs locally
- **1.1** Baseline migration plus `db:migrate`; migrations run on startup; `db:push` is retired.
- **1.2** `createDatabase(config)` with `pg` and PGlite drivers; remove the import-time `throw` in `server/db.ts`.
- **1.3** `docker-compose.yml` (db + app), updated `.env.example`.
- **1.4** Seed out of `registerRoutes` into `db/seed.ts` (local first run only).
- **1.5** Test DB helper (`createTestDb()`); `flow-mutations.test.ts` runs in CI.
- *Done when:* the server starts against Docker Postgres or PGlite. Clerk is still required until Phase 3.

### Phase 2: Server structure
- **2.1** `config.ts` (zod, fail fast in hosted).
- **2.2** `createApp()` / `main.ts` split. Fix security findings 2–5 (session secret, CORS allowlist,
  log only method/path/status/duration, error handler).
- **2.3** Split `routes.ts` into domain routers (pure move, no logic changes, reviewed by diff).
- **2.4** `GET /api/config`.
- **2.5** API integration tests per router plus a route-table parity test against `shared/routes.ts`.

### Phase 3: Auth abstraction and local edition (milestone: zero-account local run)
- **3.1** `AuthProvider` interface; `LocalAuthProvider`. The Clerk, guest and session middleware are
  only registered when enabled.
- **3.2** Client: config bootstrap, `AuthContext`, lazy Clerk, no login page in local.
- **3.3** UI gating via `config.features`; hide the AI assistant when AI is not configured.
- **3.4** Authorization-matrix tests; local full-stack Playwright smoke test.
- *Done when:* `git clone && npm ci && npm run dev` gives a working Symlit with no env vars,
  and `docker compose up` works too.

### Phase 4: Hosted features as modules (one feature per PR, each with tests and a docs page)
- **4.1** Clerk auth and invitation-only registration (+ proxy). Unit tests with mocked `getAuth`/`clerkClient`.
- **4.2** Guest workspaces.
- **4.3** Members and invitations behind an `InvitationService` interface (Clerk implementation and a test fake).
- **4.4** Legacy workspace claim (kept until the cut-over, then deleted).
- **4.5** Public share links (`features.sharing`, `PUBLIC_BASE_URL`).
- **4.6** AI assistant behind an `AiProvider` interface (Gemini implementation); the model list moves to config.

### Phase 5: Data model hardening
- Clean up orphans, then add foreign keys with `ON DELETE CASCADE` and indexes on
  `views.project_id`, `nodes.project_id`, `node_views.view_id`, `edges.view_id`.
  Simplify the hand-written cascades in `storage.ts`.
- Drop the unused `patterns`, `pattern_nodes` and `pattern_edges` tables (after checking they are
  empty in production).
- `/api/users/:userId/projects` becomes `/api/projects` (the path id is redundant with the session).
- Decide on method projects and internal views (D5).
- Every migration is tested against an anonymised production dump before it ships.

### Phase 6: Hosted deployment from GitHub and cut-over
- Multi-stage `Dockerfile` (one image for both editions); deploy pipeline from `main`/tags; staging environment.
- Hosting target and managed Postgres (D3).
- Own Clerk application. Replit-managed Clerk user IDs will differ, so `users.auth_provider_id` has to
  be remapped (by verified e-mail, or through a Clerk user export/import if Replit allows one).
- Data: `pg_dump` from Replit, restore, mark the baseline migration as applied, run newer migrations,
  smoke-test, switch DNS.
- Rotate all secrets as part of the cut-over.

### Phase 7: Frontend decomposition (continuous, behind E2E coverage)
- Split `DiagramCanvas.tsx`, `Sidebar.tsx` and `NodeAttributePanel.tsx`.
- Remove unused shadcn components (18 candidates with no app imports: accordion, aspect-ratio,
  avatar, breadcrumb, calendar, carousel, chart, context-menu, drawer, hover-card, input-otp,
  menubar, navigation-menu, pagination, progress, resizable, skeleton, toggle; check for
  ui-to-ui imports first).
- Unify the product name (`MBSE Lite` / `SymLit` / `Symlit`).

---

## 7. Risks

| Risk | Mitigation |
| --- | --- |
| Clerk users cannot be moved out of the Replit-managed instance | Find out early (before Phase 4) what Replit exports. Fall back to remapping by e-mail on first sign-in, with the legacy-claim flow as a safety net |
| Production DB has no migration history | Baseline migration marked as applied; dry run on a dump |
| PGlite edge cases (single connection, performance on large models) | PGlite is only the zero-setup default; Docker Postgres is documented as the "serious local" option; both run the same migrations in CI |
| Refactors break the fast-moving canvas code | Phases 2–4 touch the server and auth plumbing first. Canvas splits wait until full-stack E2E exists (Phase 7) |
| Hosted-only behaviour leaks into local or the other way round | Authorization-matrix tests run for both auth providers; `features` is the single gate |

---

## 8. Decisions needed

- **D1 Open-core packaging:** A (single public repo, recommended) / B (private hosted repo) / C (`ee/` licence).
- **D2 Git history:** start fresh (recommended, because the API key is in the Replit history), or import
  the 217 commits after scrubbing them with `git filter-repo`.
- **D3 Hosting target** for the hosted edition (Replit Deployments from GitHub, Fly.io, Render,
  Railway, own VPS) and managed Postgres. Not needed before Phase 6.
- **D4 Local edition single-user:** OK for now? (Multi-user self-hosting, for example via OIDC, could come later.)
- **D5** ~~Keep or remove method projects and internal views?~~ Decided: both removed (migration 0003).
