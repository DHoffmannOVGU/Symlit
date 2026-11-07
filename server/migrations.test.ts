import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { sql } from "drizzle-orm";
import { MIGRATIONS_DIR, openDatabase } from "./db";

/**
 * Upgrades a database created by the first migration, which had no foreign
 * keys, and checks that broken rows left by earlier versions are cleaned up
 * instead of making the upgrade fail.
 */
test("upgrading a database with leftover rows from earlier versions succeeds", async (t) => {
  const firstOnly = await mkdtemp(path.join(tmpdir(), "symlit-migrations-"));
  t.after(() => rm(firstOnly, { recursive: true, force: true }));
  await cp(MIGRATIONS_DIR, firstOnly, { recursive: true });
  const journalPath = path.join(firstOnly, "meta", "_journal.json");
  const journal = JSON.parse(await readFile(journalPath, "utf8"));
  journal.entries = journal.entries.slice(0, 1);
  await writeFile(journalPath, JSON.stringify(journal));

  const old = await openDatabase({ driver: "pglite", dataDir: null }, { migrationsDir: firstOnly });
  t.after(() => old.close());
  const run = (query: string) => old.db.execute(sql.raw(query));

  await run(`INSERT INTO users (id, username) VALUES (1, 'local')`);
  await run(`INSERT INTO projects (id, user_id, name) VALUES (1, 1, 'kept'), (2, 99, 'owner gone')`);
  await run(`INSERT INTO views (id, project_id, name, parent_view_id) VALUES (1, 1, 'kept', 42), (2, 77, 'project gone', NULL)`);
  await run(`INSERT INTO nodes (id, project_id, data) VALUES ('placed', 1, '{}'), ('placed-2', 1, '{}'), ('unplaced', 1, '{}')`);
  await run(`INSERT INTO node_views (node_id, view_id, position) VALUES ('placed', 1, '{"x":0,"y":0}'), ('placed-2', 1, '{"x":1,"y":1}'), ('ghost', 1, '{"x":0,"y":0}')`);
  await run(`INSERT INTO edges (id, view_id, source, target) VALUES ('ok', 1, 'placed', 'placed-2'), ('dangling', 1, 'placed', 'ghost')`);

  // Apply the remaining migrations to the same database.
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  await migrate(old.db as never, { migrationsFolder: MIGRATIONS_DIR });

  const ids = async (query: string) =>
    ((await run(query)).rows as Array<{ id: string | number }>).map((row) => String(row.id)).sort();
  assert.deepEqual(await ids(`SELECT id FROM projects`), ["1"]);
  assert.deepEqual(await ids(`SELECT id FROM views`), ["1"]);
  assert.deepEqual(await ids(`SELECT id FROM nodes`), ["placed", "placed-2"]);
  assert.deepEqual(await ids(`SELECT node_id AS id FROM node_views`), ["placed", "placed-2"]);
  assert.deepEqual(await ids(`SELECT id FROM edges`), ["ok"]);

  // The constraints are now enforced.
  await assert.rejects(run(`INSERT INTO edges (id, view_id, source, target) VALUES ('bad', 1, 'placed', 'nope')`));
  // Deleting a project removes everything below it.
  await run(`DELETE FROM projects WHERE id = 1`);
  assert.deepEqual(await ids(`SELECT id FROM nodes`), []);
  assert.deepEqual(await ids(`SELECT id FROM edges`), []);
});

test("removing method projects and internal views deletes their data", async (t) => {
  const upTo0002 = await mkdtemp(path.join(tmpdir(), "symlit-migrations-"));
  t.after(() => rm(upTo0002, { recursive: true, force: true }));
  await cp(MIGRATIONS_DIR, upTo0002, { recursive: true });
  const journalPath = path.join(upTo0002, "meta", "_journal.json");
  const journal = JSON.parse(await readFile(journalPath, "utf8"));
  journal.entries = journal.entries.filter((entry: { tag: string }) => entry.tag < "0003");
  await writeFile(journalPath, JSON.stringify(journal));

  const db = await openDatabase({ driver: "pglite", dataDir: null }, { migrationsDir: upTo0002 });
  t.after(() => db.close());
  const run = (query: string) => db.db.execute(sql.raw(query));

  await run(`INSERT INTO users (id, username) VALUES (1, 'local')`);
  await run(`INSERT INTO projects (id, user_id, name, project_type) VALUES (1, 1, 'instance', 'instance'), (2, 1, 'method', 'method')`);
  await run(`INSERT INTO views (id, project_id, name, view_type, parent_node_id) VALUES (1, 1, 'main', 'view', NULL), (2, 1, 'inside', 'internal', 'outer'), (3, 2, 'method view', 'view', NULL)`);
  await run(`INSERT INTO nodes (id, project_id, data) VALUES ('outer', 1, '{}'), ('inner', 1, '{}'), ('m', 2, '{}')`);
  await run(`INSERT INTO node_views (node_id, view_id, position) VALUES ('outer', 1, '{"x":0,"y":0}'), ('inner', 2, '{"x":0,"y":0}'), ('m', 3, '{"x":0,"y":0}')`);

  const { migrate } = await import("drizzle-orm/pglite/migrator");
  await migrate(db.db as never, { migrationsFolder: MIGRATIONS_DIR });

  const ids = async (query: string) =>
    ((await run(query)).rows as Array<{ id: string | number }>).map((row) => String(row.id)).sort();
  assert.deepEqual(await ids(`SELECT id FROM projects`), ["1"]);
  assert.deepEqual(await ids(`SELECT id FROM views`), ["1"]);
  assert.deepEqual(await ids(`SELECT id FROM nodes`), ["outer"], "only elements still in a diagram remain");
  const columns = await ids(
    `SELECT column_name AS id FROM information_schema.columns WHERE table_name IN ('views', 'projects') AND column_name IN ('parent_node_id', 'parent_view_id', 'method_metadata')`,
  );
  assert.deepEqual(columns, []);
});
