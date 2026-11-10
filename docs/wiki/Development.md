# Development

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload (API and client on one port) |
| `npm run check` | TypeScript type check |
| `npm run lint` | ESLint |
| `npm test` | Unit, database and API tests against an in-memory PGlite |
| `npm run test:postgres` | The same tests against a real PostgreSQL (`TEST_DATABASE_URL`, default: the Compose database) |
| `npm run test:e2e` | Playwright browser tests (run `npx playwright install chromium` once first) |
| `npm run db:generate` | Create a migration after changing `shared/schema.ts` |

## Code layout

```
client/   React single-page app (Vite)
server/   Express API, database access, startup
shared/   Database schema, API contract and domain logic used by both sides
```

- **Client:** React 18, Vite, wouter, TanStack Query, Tailwind CSS with shadcn/ui, `@xyflow/react`
  for the canvas, Zustand for the editor state.
- **Server:** Express 4, Drizzle ORM, PostgreSQL (`pg`) or embedded PGlite.
- **Shared:** Zod schemas. `shared/routes.ts` is the single source of truth for every API endpoint.

## Further reading (in the repository)

- [Architecture](https://github.com/DHoffmannOVGU/Symlit/blob/main/docs/ARCHITECTURE.md)
- [Contributing](https://github.com/DHoffmannOVGU/Symlit/blob/main/CONTRIBUTING.md)
- [Backlog](https://github.com/DHoffmannOVGU/Symlit/blob/main/docs/BACKLOG.md)
- [Decision records](https://github.com/DHoffmannOVGU/Symlit/tree/main/docs/decisions)
- [Changelog](https://github.com/DHoffmannOVGU/Symlit/blob/main/CHANGELOG.md)

## Editing this wiki

The wiki pages are kept in the repository under `docs/wiki/` and published from there with
`script/publish-wiki.sh`. Change them in the repository so that they are reviewed with the
code; edits made directly in the wiki are overwritten by the next publish.
