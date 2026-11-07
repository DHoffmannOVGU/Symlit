import { mkdir } from "node:fs/promises";
import path from "node:path";
import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate as migratePg } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import * as schema from "@shared/schema";
import type { DatabaseConfig } from "./config";

/**
 * Both drivers expose the same Drizzle Postgres query builder. The PGlite
 * instance is typed as the node-postgres flavour so the rest of the server
 * has a single `Database` type to depend on.
 */
export type Database = NodePgDatabase<typeof schema>;

export interface DatabaseHandle {
  db: Database;
  driver: DatabaseConfig["driver"];
  close: () => Promise<void>;
}

const uninitialised = new Proxy({} as Database, {
  get() {
    throw new Error("Database is not initialised. Call initDatabase() first.");
  },
});

/**
 * The active database. Services import this live binding; it is set once by
 * `initDatabase()` during startup (or by the test helper).
 */
export let db: Database = uninitialised;

export const MIGRATIONS_DIR = path.resolve(process.cwd(), "migrations");

export async function openDatabase(
  config: DatabaseConfig,
  options: { migrationsDir?: string; runMigrations?: boolean } = {},
): Promise<DatabaseHandle> {
  const migrationsFolder = options.migrationsDir ?? MIGRATIONS_DIR;
  const runMigrations = options.runMigrations ?? true;

  if (config.driver === "postgres") {
    const pool = new pg.Pool({ connectionString: config.url });
    const database = drizzlePg(pool, { schema });
    if (runMigrations) await migratePg(database, { migrationsFolder });
    return { db: database, driver: "postgres", close: () => pool.end() };
  }

  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle: drizzlePglite } = await import("drizzle-orm/pglite");
  const { migrate: migratePglite } = await import("drizzle-orm/pglite/migrator");
  if (config.dataDir) await mkdir(config.dataDir, { recursive: true });
  const client = config.dataDir ? new PGlite(config.dataDir) : new PGlite();
  const database = drizzlePglite(client, { schema });
  if (runMigrations) await migratePglite(database, { migrationsFolder });
  return {
    db: database as unknown as Database,
    driver: "pglite",
    close: () => client.close(),
  };
}

/** Opens the database, runs migrations and makes it the active `db`. */
export async function initDatabase(
  config: DatabaseConfig,
  options?: { migrationsDir?: string; runMigrations?: boolean },
): Promise<DatabaseHandle> {
  const handle = await openDatabase(config, options);
  db = handle.db;
  return handle;
}
