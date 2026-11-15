# Symlit

Symlit is a lightweight modeling workspace for systems engineering (MBSE) that runs in your
browser. Instead of a fixed notation, you first define a **metamodel**: the types of things
you care about and the relationships allowed between them. Then you build **models** from
elements of those types on a diagram canvas, and Symlit checks them against the metamodel.

![Symlit diagram canvas](docs/images/symlit-quickstart-canvas.jpg)

Symlit runs entirely on your own machine: one Node.js process with an embedded database,
no account, no cloud service, and no external requests unless you turn on the optional
AI assistant.

## Features

- **Metamodels:** define types of seven kinds (Object, Behavior, Concern, Performer, Need,
  Event, Capability) and connect them with six relationships (Association, Aggregation,
  Composition, Generalization, Dependency, Realization). Types have attributes with units
  and derived formulas, a style (icon, colour, shape, border) and inheritance.
- **Models** that use one or more metamodels: a searchable palette of all their types, and
  only the relationships the metamodel allows.
- **Several diagrams per project:** an element is stored once and can appear in several diagrams.
- **Diagram editor** with auto layout, table view, undo/redo, rename on the card (F2),
  screenshots and optional auto-save. A diagram changed elsewhere is never overwritten
  unnoticed; you choose which version to keep.
- **Validation and model rules:** Validate lists what does not fit the metamodel or your own
  rules in a panel beside the canvas. Damaged diagrams open in a guided recovery dialog.
- **Flow mode:** step through the behavior of a model from a start to an end element.
- **Patterns:** save a selection as a reusable pattern and insert it elsewhere; metamodels can
  ship pattern libraries.
- **Projects:** start empty, from a metamodel, or from a template (templates can bring their
  metamodel along); duplicate a project; see when each was last edited.
- **Import and export:** JSON project files (export, and import as a new project) and CSV
  tables of elements and relationships.
- **Two guided tutorials.** *Symlit basics* (about 25 minutes) teaches the tool around one question,
  can the drone fly the city route: types and elements, attributes, typed models, validation, model
  rules, table view, auto layout and patterns. *Production with PPR* (about 30 minutes) teaches a
  method: modelling production as products, processes and resources, starting from the customer's
  requirements and tracing each of them to what satisfies it. In both, steps tick off when the model
  shows their result, each lesson ends with one question, and the last lesson is done without
  step-by-step instructions.
- **Optional AI metamodel assistant** (Google Gemini, bring your own API key).

## Quick start

Requirements: **Node.js 20.19 or newer** and npm.

```bash
git clone https://github.com/DHoffmannOVGU/Symlit.git
cd Symlit
npm ci
npm run dev
```

Open http://localhost:5000. That's it: with no configuration, Symlit stores its data in an
embedded PostgreSQL database ([PGlite](https://pglite.dev)) under `./data/`, and creates a
demo project on first start. New to Symlit? Start the **Symlit basics** tutorial on the project list.

### With a dedicated PostgreSQL server (Docker)

```bash
docker compose up --build
```

This starts PostgreSQL 16 and Symlit at http://localhost:5000. Data is kept in the
`symlit-db` Docker volume.

To run the dev server against that database instead of the embedded one:

```bash
docker compose up -d db
DATABASE_URL=postgres://symlit:symlit@localhost:5432/symlit npm run dev
```

### Production build

```bash
npm run build
npm start
```

## Configuration

Everything is optional. Set variables in the environment or in a `.env` file
(see [`.env.example`](.env.example)).

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | – | PostgreSQL connection string. When unset, the embedded database is used. |
| `SYMLIT_DATA_DIR` | `./data` | Where the embedded database is stored (`:memory:` for a throwaway one). |
| `HOST` / `PORT` | `127.0.0.1` / `5000` | Listen address. The default is only reachable from this machine. |
| `SYMLIT_USER_NAME` | `Local user` | Display name of the local user. |
| `SYMLIT_ALLOWED_HOSTS` | – | Extra host names the app may be opened under (comma-separated), e.g. `symlit.lan`. `localhost` and IP addresses always work; other names are refused to stop other websites from reaching the app. |
| `SYMLIT_SEED_DEMO` | `true` | Create a demo project when the workspace is empty. |
| `GEMINI_API_KEY` | – | Enables the AI metamodel assistant. |
| `GEMINI_MODEL` | built-in list | Gemini model, or a comma-separated fallback list. |

Database migrations run automatically on startup. To run them on their own, use `npm run db:migrate`.

## Development

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload (API and client on one port) |
| `npm run check` | TypeScript type check |
| `npm run lint` | ESLint |
| `npm test` | Unit, database and API tests against an in-memory PGlite |
| `npm run test:postgres` | The same tests against a real PostgreSQL (`TEST_DATABASE_URL`, default: the Compose database) |
| `npm run test:e2e` | Playwright browser tests (run `npx playwright install chromium` once first) |
| `npm run db:generate` | Create a migration after changing `shared/schema.ts` |

See [CONTRIBUTING.md](CONTRIBUTING.md) for the workflow and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
for how the code is organised.

## Documentation

The user guide lives in the [wiki](https://github.com/DHoffmannOVGU/Symlit/wiki). Its pages are
kept in [`docs/wiki/`](docs/wiki/Home.md) and published with `bash script/publish-wiki.sh`.

## Status

Version 0.1.0 is the first **local edition**: single-user and complete for everyday modeling.
The [changelog](CHANGELOG.md) lists what changed, and the [backlog](docs/BACKLOG.md) what is
known and planned (among others: saving your own templates and a SysML v2 textual export).

Symlit began as a hosted app on Replit. The hosted features (accounts, team members and
invitations, public share links) are deliberately not part of this repository; see
[docs/MIGRATION_PLAN.md](docs/MIGRATION_PLAN.md) for the background.

## License

[Apache License 2.0](LICENSE)
