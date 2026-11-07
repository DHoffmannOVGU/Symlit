# Contributing to Symlit

## Setup

```bash
npm ci
npm run dev        # http://localhost:5000, embedded database in ./data
```

Delete `./data` to start over with an empty workspace.

## Before you open a pull request

```bash
npm run check      # types
npm test           # unit, database and API tests (in-memory PGlite)
npm run test:e2e   # browser tests; run `npx playwright install chromium` once first
```

CI also runs the database and API tests against PostgreSQL 16, builds the app, and checks that
migrations match the schema. To run the PostgreSQL tests locally:

```bash
docker compose up -d db
npm run test:postgres
```

## Guidelines

- **API changes** start in `shared/routes.ts` (the contract), then the handler in `server/routes.ts`,
  then the client hook. Add a test in `server/app.test.ts`.
- **Schema changes:** edit `shared/schema.ts`, then run `npm run db:generate` and commit the new file in
  `migrations/`. Never edit a migration that has already been merged.
- **Business logic** goes into `server/services/*`, not `server/storage.ts` or route handlers.
- **Tests:** new behaviour comes with tests at the lowest level that can show it works. Use
  `useTestDatabase()` from `server/testing/test-db.ts` for anything that touches the database.
  Do not skip or weaken a failing test to get CI green; fix the cause.
- **Browser tests** that mock `/api/**` must call `mockLocalSession(page)` after registering their
  routes (see `e2e/support/local-session.ts`).
- Keep pull requests focused: one feature or fix per PR.

## License

By contributing you agree that your contributions are licensed under the
[Apache License 2.0](LICENSE).
