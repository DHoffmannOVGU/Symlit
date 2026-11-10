# Getting started

## Requirements

**Node.js 20.19 or newer** and npm. Nothing else: with no configuration Symlit keeps its data
in an embedded PostgreSQL database ([PGlite](https://pglite.dev)) under `./data/`.

## Install and run

```bash
git clone https://github.com/DHoffmannOVGU/Symlit.git
cd Symlit
npm ci
npm run dev
```

Open http://localhost:5000. On first start Symlit creates a demo project.

## Take the tutorial

Press **Start the guided tutorial** on the project list. It builds a small drone model with
you in about 15 minutes: seven hands-on lessons covering metamodels, typed models, validation,
model rules, table view, auto layout, patterns and export. Steps tick off as you work, and
**Show me** points at the right button.

## Other ways to run it

**With a dedicated PostgreSQL server (Docker):**

```bash
docker compose up --build
```

This starts PostgreSQL 16 and Symlit at http://localhost:5000. Data is kept in the `symlit-db`
Docker volume.

**Production build:**

```bash
npm run build
npm start
```

See [Configuration](Configuration) for the database, port and host name settings.

## Next

Read [Concepts](Concepts), then create your first [project](Projects).
