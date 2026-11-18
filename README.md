# Symlit

Symlit is a lightweight modeling workspace for systems engineering (MBSE) that runs in your
browser. Instead of a fixed notation, you first define a **metamodel**: the types of things you
care about and the relationships allowed between them. Then you build **models** from elements of
those types, calculate with their attributes, and let **rules** tag elements and check the model.

![A model of an espresso machine in Symlit: typed elements, relationships, and tags given by rules](docs/images/symlit-model.png)

Symlit runs entirely on your own machine: one Node.js process with an embedded database, no
account, no cloud service, and no external requests unless you turn on the optional AI assistant.

## Features

- **Your own metamodel.**
  - Types come in seven kinds: Object, Behavior, Concern, Performer, Need, Event and Capability.
  - Six relationship kinds connect them: Association, Aggregation, Composition, Generalization,
    Dependency and Realization.
  - Attributes come in eight kinds: text, number with a unit, yes/no, date, list, multiselect,
    Derived Formula and Related Formula.
  - Each type has a style: icon, colour, shape and border.
  - Types inherit attributes and allowed relationships through Generalization.
- **Models typed by one or more metamodels.** The palette lists all their types. Only the
  relationships the metamodel allows are offered, and **Validate** shows what does not fit.
- **Calculations.**
  - A Derived Formula calculates from its own element:
    `[price] - [total cost]`, with min, max, sum, avg, round, floor, ceil, abs and sqrt.
  - A Related Formula calculates over the related elements, across all diagrams of the project:
    `sum([mass] of "consists of" where [status] = "released")`.
  - Totals over several levels come from formulas that read the related elements' own.
  - Formulas follow renamed attributes and relationships.
- **Model rules.** A rule is one line of text, or the same rule built with lists:
  `for Machine where any of "consists of" has [lead time] > 30`.
  - A rule either tags elements (on the cards and in the table) or reports an issue when you validate.
  - Conditions can compare two values or calculations (`[total mass] > [max mass]`) and check
    related elements.

  ![The rules panel: each rule as text, the same rule in lists, and the live results](docs/images/symlit-rules.png)

- **Diagrams.** A project can have several diagrams. An element is stored once and can appear in
  several of them.
- **Editing.**
  - The editor has auto layout, undo/redo and rename on the card (F2).
  - The table view shows attribute values, which can be edited there, and can be filtered by name or tag.
  - You can take screenshots and turn on auto-save.
  - A diagram changed elsewhere is never overwritten unnoticed: you choose which version to keep.
  - Damaged diagrams open in a guided recovery dialog.
- **Patterns.** Save a selection as a reusable pattern and insert it elsewhere. Metamodels can ship
  pattern libraries.
- **Projects.** Start empty, from a metamodel, or from a template (a template can bring its
  metamodel along). Projects can be duplicated, exported and imported as JSON files, and exported
  as CSV tables.
- **Six guided tutorials.** Each is built around one question and its own example:
  - *Symlit basics*: a delivery drone.
  - *Production with PPR*: a shelf bracket.
  - *Calculate with attributes*: 3D-printing quotes.
  - *Classify and review*: a control cabinet.
  - *Structure and views*: an espresso machine.
  - *Reuse and variants*: sensor nodes.

  Steps tick off when the model shows their result, and each lesson ends with a question.
- **Optional AI metamodel assistant** (Google Gemini, bring your own API key).

## Download

Ready-to-run files for Windows, macOS and Linux are attached to each
[release](https://github.com/DHoffmannOVGU/Symlit/releases/latest): download, start, and Symlit
opens in your browser. No installation and no Node.js needed. See
[Getting started](https://github.com/DHoffmannOVGU/Symlit/wiki/Getting-Started) for the
first-start warnings on unsigned files and where your data is stored.

## Quick start

Requirements: **Node.js 20.19 or newer** and npm.

```bash
git clone https://github.com/DHoffmannOVGU/Symlit.git
cd Symlit
npm ci
npm run dev
```

Open http://localhost:5000. With no configuration, Symlit stores its data in an embedded
PostgreSQL database ([PGlite](https://pglite.dev)) under `./data/` and creates a demo project on
first start. New to Symlit? Start the **Symlit basics** tutorial on the project list.

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
| `npm run build:exe` | Single-file executable for this platform, in `release/` |
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

## License

[Apache License 2.0](LICENSE)
