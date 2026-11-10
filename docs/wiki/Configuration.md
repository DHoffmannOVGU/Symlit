# Configuration

Everything is optional. Set variables in the environment or in a `.env` file (see
[`.env.example`](https://github.com/DHoffmannOVGU/Symlit/blob/main/.env.example)).

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | – | PostgreSQL connection string. When unset, the embedded database is used. |
| `SYMLIT_DATA_DIR` | `./data` | Where the embedded database is stored (`:memory:` for a throwaway one). |
| `HOST` / `PORT` | `127.0.0.1` / `5000` | Listen address. The default is only reachable from this machine. |
| `SYMLIT_USER_NAME` | `Local user` | Display name of the local user. |
| `SYMLIT_ALLOWED_HOSTS` | – | Extra host names the app may be opened under (comma-separated), e.g. `symlit.lan`. |
| `SYMLIT_SEED_DEMO` | `true` | Create a demo project when the workspace is empty. |
| `GEMINI_API_KEY` | – | Enables the [AI metamodel assistant](AI-Assistant). |
| `GEMINI_MODEL` | built-in list | Gemini model, or a comma-separated fallback list. |

## Database

- **Embedded (default):** PGlite, stored under `SYMLIT_DATA_DIR`. Back it up by copying the folder
  while Symlit is stopped.
- **PostgreSQL:** set `DATABASE_URL`. `docker compose up --build` starts PostgreSQL 16 and Symlit
  together; `docker compose up -d db` starts only the database.

Migrations run automatically on startup. To run them on their own: `npm run db:migrate`.

## Host names and network access

Symlit listens on `127.0.0.1` by default, so only your machine can reach it. `localhost` and IP
addresses always work as the address in the browser. Any other host name is refused unless it
is listed in `SYMLIT_ALLOWED_HOSTS`; this stops other websites from reaching the app.

The local edition has **no login**. If you set `HOST=0.0.0.0`, everyone who can reach the port
can read and change your projects, so only do that on a network you trust.
