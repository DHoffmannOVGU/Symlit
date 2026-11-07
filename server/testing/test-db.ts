import { randomUUID } from "node:crypto";
import { after, before } from "node:test";
import pg from "pg";
import { initDatabase, type DatabaseHandle } from "../db";

/**
 * Creates a fresh, fully migrated database and makes it the active `db`.
 *
 * - Default: in-memory PGlite (no setup needed).
 * - With TEST_DATABASE_URL set: a throwaway database is created on that
 *   PostgreSQL server and dropped again on close.
 */
export async function createTestDatabase(): Promise<DatabaseHandle> {
  const serverUrl = process.env.TEST_DATABASE_URL;
  if (!serverUrl) return initDatabase({ driver: "pglite", dataDir: null });

  const name = `symlit_test_${randomUUID().replace(/-/g, "")}`;
  const admin = async (sql: string) => {
    const client = new pg.Client({ connectionString: serverUrl });
    await client.connect();
    try {
      await client.query(sql);
    } finally {
      await client.end();
    }
  };
  await admin(`CREATE DATABASE ${name}`);
  const url = new URL(serverUrl);
  url.pathname = `/${name}`;
  const handle = await initDatabase({ driver: "postgres", url: url.toString() });
  return {
    ...handle,
    close: async () => {
      await handle.close();
      await admin(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    },
  };
}

/** Registers a fresh test database for the current test file. */
export function withTestDatabase() {
  let handle: DatabaseHandle | undefined;
  before(async () => {
    handle = await createTestDatabase();
  });
  after(async () => {
    await handle?.close();
  });
}
