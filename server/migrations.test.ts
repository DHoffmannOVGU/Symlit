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

test("relationships are normalised so every stored one passes the save checks", async (t) => {
  const upTo0004 = await mkdtemp(path.join(tmpdir(), "symlit-migrations-"));
  t.after(() => rm(upTo0004, { recursive: true, force: true }));
  await cp(MIGRATIONS_DIR, upTo0004, { recursive: true });
  const journalPath = path.join(upTo0004, "meta", "_journal.json");
  const journal = JSON.parse(await readFile(journalPath, "utf8"));
  journal.entries = journal.entries.filter((entry: { tag: string }) => entry.tag < "0005");
  await writeFile(journalPath, JSON.stringify(journal));

  const db = await openDatabase({ driver: "pglite", dataDir: null }, { migrationsDir: upTo0004 });
  t.after(() => db.close());
  const run = (query: string) => db.db.execute(sql.raw(query));

  await run(`INSERT INTO users (id, username) VALUES (1, 'local')`);
  await run(`INSERT INTO projects (id, user_id, name) VALUES (1, 1, 'p')`);
  await run(`INSERT INTO views (id, project_id, name) VALUES (1, 1, 'v')`);
  await run(`INSERT INTO nodes (id, project_id, data) VALUES ('a', 1, '{}'), ('b', 1, '{}')`);
  await run(`INSERT INTO node_views (node_id, view_id, position) VALUES ('a', 1, '{"x":0,"y":0}'), ('b', 1, '{"x":1,"y":1}')`);
  const edge = (id: string, edgeType: string, sourceHandle: string | null, targetHandle: string | null, data: string | null) =>
    run(`INSERT INTO edges (id, view_id, source, target, edge_type, source_handle, target_handle, data) VALUES
      ('${id}', 1, 'a', 'b', '${edgeType}', ${sourceHandle ? `'${sourceHandle}'` : "NULL"}, ${targetHandle ? `'${targetHandle}'` : "NULL"}, ${data === null ? "NULL" : `'${data}'::jsonb`})`);
  await edge("clean", "composition", "right", "left", '{"edgeType":"composition","label":"has","lineStyle":"solid"}');
  await edge("legacy-handles", "association", "top-source", "bottom-target", '{"edgeType":"association"}');
  await edge("null-handles", "association", null, null, null);
  await edge("odd-handles", "association", "source", "weird", '"just a string"');
  await edge("unknown-type", "partflow", "left-source", "right-target", '{"edgeType":"partflow","label":"flows"}');
  await edge("mismatch", "dependency", "right", "left", '{"edgeType":"association","multiplicity":"1..*"}');
  await edge(
    "junk-fields",
    "association",
    "right",
    "left",
    JSON.stringify({
      label: 5, description: ["x"], strokeWidth: "3", animated: "yes", lineStyle: "wavy", pathType: "step",
      sourceAnchor: { side: "top", offset: "half" }, targetAnchor: { side: "left", offset: 0.25 },
      ruleStrokeColor: "#f00", custom: { kept: true },
    }),
  );
  await edge("too-wide", "association", "right", "left", '{"strokeWidth":500,"strokeColor":"#123"}');

  const { migrate } = await import("drizzle-orm/pglite/migrator");
  await migrate(db.db as never, { migrationsFolder: MIGRATIONS_DIR });

  const rows = (await run(`SELECT id, edge_type, source_handle, target_handle, data FROM edges ORDER BY id`)).rows as Array<{
    id: string;
    edge_type: string;
    source_handle: string;
    target_handle: string;
    data: Record<string, unknown>;
  }>;
  const byId = Object.fromEntries(rows.map((row) => [row.id, row]));

  // Every stored relationship now passes what saving requires.
  const { flowEdgeInputSchema } = await import("@shared/routes");
  for (const row of rows) {
    const parsed = flowEdgeInputSchema.safeParse({
      id: row.id, source: "a", target: "b", edgeType: row.edge_type,
      sourceHandle: row.source_handle, targetHandle: row.target_handle, data: row.data,
    });
    assert.ok(parsed.success, `${row.id}: ${parsed.success ? "" : parsed.error.message}`);
    assert.equal(row.data.edgeType, row.edge_type, `${row.id}: data.edgeType mirrors the column`);
    assert.ok(["top", "right", "bottom", "left"].includes(row.source_handle), `${row.id}: source handle`);
    assert.ok(["top", "right", "bottom", "left"].includes(row.target_handle), `${row.id}: target handle`);
  }

  assert.deepEqual(byId.clean.data, { edgeType: "composition", label: "has", lineStyle: "solid" }, "clean data is untouched");
  assert.deepEqual([byId["legacy-handles"].source_handle, byId["legacy-handles"].target_handle], ["top", "bottom"]);
  assert.deepEqual([byId["null-handles"].source_handle, byId["null-handles"].target_handle], ["bottom", "top"]);
  assert.deepEqual([byId["odd-handles"].source_handle, byId["odd-handles"].target_handle], ["bottom", "top"]);
  assert.deepEqual(byId["odd-handles"].data, { edgeType: "association" });
  assert.equal(byId["unknown-type"].edge_type, "association");
  assert.equal(byId["unknown-type"].data.label, "flows");
  assert.equal(byId.mismatch.data.edgeType, "dependency", "the column wins over data.edgeType");
  assert.deepEqual(byId["junk-fields"].data, {
    edgeType: "association",
    pathType: "step",
    targetAnchor: { side: "left", offset: 0.25 },
    custom: { kept: true },
  });
  assert.deepEqual(byId["too-wide"].data, { edgeType: "association", strokeColor: "#123" });
});

test("both tutorial projects are marked with the one tutorial template", async (t) => {
  const upTo0005 = await mkdtemp(path.join(tmpdir(), "symlit-migrations-"));
  t.after(() => rm(upTo0005, { recursive: true, force: true }));
  await cp(MIGRATIONS_DIR, upTo0005, { recursive: true });
  const journalPath = path.join(upTo0005, "meta", "_journal.json");
  const journal = JSON.parse(await readFile(journalPath, "utf8"));
  journal.entries = journal.entries.filter((entry: { tag: string }) => entry.tag < "0006");
  await writeFile(journalPath, JSON.stringify(journal));

  const db = await openDatabase({ driver: "pglite", dataDir: null }, { migrationsDir: upTo0005 });
  t.after(() => db.close());
  const run = (query: string) => db.db.execute(sql.raw(query));
  await run(`INSERT INTO users (id, username) VALUES (1, 'local')`);
  await run(`INSERT INTO projects (id, user_id, name, template_id) VALUES
    (1, 1, 'mm', 'tutorial-metamodel'), (2, 1, 'model', 'tutorial-instance'), (3, 1, 'mine', NULL), (4, 1, 'other', 'system-context')`);

  const { migrate } = await import("drizzle-orm/pglite/migrator");
  await migrate(db.db as never, { migrationsFolder: MIGRATIONS_DIR });

  const rows = (await run(`SELECT id, template_id FROM projects ORDER BY id`)).rows as Array<{ template_id: string | null }>;
  assert.deepEqual(rows.map((row) => row.template_id), ["tutorial", "tutorial", null, "system-context"]);
});
