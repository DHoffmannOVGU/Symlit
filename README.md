# Symlit

Symlit is a lightweight, MBSE-style modeling workspace that runs in your browser.
You define your own **metamodels** (the types and relationships you care about),
then build **instance models** typed against them, all on a diagram canvas.

![Symlit diagram canvas](docs/images/symlit-quickstart-canvas.jpg)

This repository contains the **local edition**: a single-user app you run on your own
machine. It needs no accounts and no cloud services.

## Features

- **Metamodel projects:** define node types (Object, Behavior, Concern, Performer,
  Need, Event, Capability) and relationship types (Association, Aggregation,
  Composition, Generalization, Dependency, Realization), with attributes, units,
  derived formulas, styling and inheritance.
- **Instance projects** that reference one or more metamodels, with typed elements,
  validated relationships, and a *build* and *flow* mode (flow playback).
- **Multiple views per project:** an element is stored once and can appear in several diagrams.
- **Patterns:** save a selection as a reusable pattern and insert it elsewhere.
- **Model rules and validation**, plus a guided recovery dialog for damaged diagrams.
- **A guided tutorial** built around one question (can the drone fly the city route?): about
  25 minutes, six hands-on lessons covering types and elements, attributes, typed models, validation,
  model rules, table view, auto layout and patterns. Steps tick off when the model shows their result,
  each lesson ends with one question, and the last lesson is done without step-by-step instructions.
- **Project templates:** start from an example; templates can bring their metamodel along.
- **Export** to JSON or CSV (elements and relationships), and diagram screenshots.
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
demo project on first start. New to Symlit? Press **Start the guided tutorial** on the project list.

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

## Status

Symlit was originally built on Replit and is being moved to GitHub step by step. See
[docs/MIGRATION_PLAN.md](docs/MIGRATION_PLAN.md). Hosted features (accounts, team members
and invitations, public share links) are deliberately not part of this repository yet.

## License

[Apache License 2.0](LICENSE)
