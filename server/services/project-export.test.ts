import assert from "node:assert/strict";
import test from "node:test";
import { storage } from "../storage";
import { withTestDatabase } from "../testing/test-db";
import { buildProjectExport, csvCell, toCsv } from "./project-export";

withTestDatabase();

const defaults = {
  format: "json" as const,
  includeProjectDetails: true,
  includeElements: true,
  includeRelationships: true,
  includePatterns: false,
  includeReferencedMetamodels: false,
};

test("CSV cells are quoted and cannot start a spreadsheet formula", () => {
  assert.equal(csvCell('say "hi"'), '"say ""hi"""');
  assert.equal(csvCell(null), '""');
  assert.equal(csvCell(3), '"3"');
  assert.equal(csvCell({ a: 1 }), '"{""a"":1}"');
  for (const dangerous of ["=1+1", "+cmd", "-2+3", "@SUM(A1)", "\tx"]) {
    assert.equal(csvCell(dangerous), `"'${dangerous}"`);
  }
  assert.equal(csvCell(-5), '"-5"', "numbers are not treated as formulas");
  assert.equal(toCsv(["a", "b"], [[1, "x"]]), '"a","b"\n"1","x"');
});

async function seedProjectWithReference() {
  const owner = await storage.getOrCreateUser(`export-${Math.random()}`);
  const metamodel = await storage.createProject({ userId: owner.id, name: "Types", projectType: "metamodel" });
  const mmView = await storage.createView({ projectId: metamodel.id, name: "MM" });
  await storage.syncFlow(mmView.id, [{ id: `mm-${metamodel.id}`, type: "partdef", position: { x: 0, y: 0 }, data: { label: "Sensor" } }], []);
  const instance = await storage.createProject({
    userId: owner.id,
    name: "Fleet / 2026",
    projectType: "instance",
    referencedMetamodels: [metamodel.id],
  });
  const view = await storage.createView({ projectId: instance.id, name: "Ops" });
  await storage.syncFlow(
    view.id,
    [
      { id: `a-${instance.id}`, type: "part", position: { x: 1, y: 2 }, data: { label: "=cmd()", type: "Object" } },
      { id: `b-${instance.id}`, type: "part", position: { x: 3, y: 4 }, data: { label: "Drone", type: "Object" } },
    ],
    [{ id: `ab-${instance.id}`, source: `a-${instance.id}`, target: `b-${instance.id}`, edgeType: "association", sourceHandle: null, targetHandle: null }],
  );
  return { metamodel, instance, view };
}

test("JSON export includes selected content and readable referenced metamodels", async () => {
  const { metamodel, instance } = await seedProjectWithReference();
  const file = await buildProjectExport(
    instance.id,
    { ...defaults, includeReferencedMetamodels: true },
    async () => true,
  );
  assert.match(file.filename, /^instance-model-Fleet_2026-\d+\.json$/);
  const json = JSON.parse(file.body);
  assert.equal(json.export.kind, "instance-model");
  assert.equal(json.views[0].nodes.length, 2);
  assert.equal(json.views[0].edges.length, 1);
  assert.equal(json.referencedMetamodels[0].project.id, metamodel.id);

  const hidden = JSON.parse(
    (await buildProjectExport(instance.id, { ...defaults, includeReferencedMetamodels: true }, async () => false)).body,
  );
  assert.deepEqual(hidden.referencedMetamodels, [], "unreadable metamodels are left out");
});

test("a deleted referenced metamodel does not break the export", async () => {
  const { metamodel, instance } = await seedProjectWithReference();
  await storage.deleteProject(metamodel.id);
  const file = await buildProjectExport(instance.id, { ...defaults, includeReferencedMetamodels: true }, async () => true);
  assert.deepEqual(JSON.parse(file.body).referencedMetamodels, []);
});

test("CSV exports neutralise formulas in element names", async () => {
  const { instance } = await seedProjectWithReference();
  const file = await buildProjectExport(instance.id, { ...defaults, format: "elements-csv" }, async () => true);
  assert.equal(file.contentType, "text/csv; charset=utf-8");
  assert.match(file.body, /"'=cmd\(\)"/);
  const rels = await buildProjectExport(instance.id, { ...defaults, format: "relationships-csv" }, async () => true);
  assert.equal(rels.body.split("\n").length, 2);
});
