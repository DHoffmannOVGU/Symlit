import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { after, before, describe, test } from "node:test";
import { createApp } from "./app";
import type { AppConfig } from "./config";
import type { DatabaseHandle } from "./db";
import { createTestDatabase } from "./testing/test-db";

/*
 * Patterns: the requirements in docs/decisions/patterns.md, one test (or a
 * few) per requirement. Ids in test names (C1, L2, ...) refer to that list.
 */

const config: AppConfig = {
  env: "test",
  port: 0,
  host: "127.0.0.1",
  database: { driver: "pglite", dataDir: null },
  seedDemo: false,
  localUserName: "Test Engineer",
  features: { ai: false },
};

let database: DatabaseHandle;
let baseUrl: string;
let closeServer: () => Promise<void>;

before(async () => {
  database = await createTestDatabase();
  const { httpServer } = await createApp(config, { requestLogging: false });
  await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${(httpServer.address() as AddressInfo).port}`;
  closeServer = () => new Promise((resolve) => httpServer.close(() => resolve()));
});

after(async () => {
  await closeServer();
  await database.close();
});

type Json = any;

async function request(method: string, path: string, body?: unknown) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let json: Json = undefined;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    json = undefined;
  }
  return { status: response.status, json, text };
}

async function ok(method: string, path: string, body?: unknown) {
  const res = await request(method, path, body);
  assert.ok(res.status < 300, `${method} ${path}: ${res.status} ${res.text}`);
  return res.json;
}

let counter = 0;
const uid = (prefix: string) => `${prefix}-${++counter}`;

async function createProject(name: string, projectType: "instance" | "metamodel" = "instance") {
  return (await ok("POST", "/api/projects", { name, projectType })) as { id: number };
}

async function createView(projectId: number, name = "Context") {
  return (await ok("POST", `/api/projects/${projectId}/views`, { name })) as { id: number };
}

/** A metamodel with one type; returns the type id as instance models use it. */
async function createMetamodel(name: string, typeLabel: string, references: number[] = []) {
  const metamodel = await createProject(name, "metamodel");
  if (references.length) {
    await ok("PATCH", `/api/projects/${metamodel.id}`, { referencedMetamodels: references });
  }
  const view = await createView(metamodel.id, "Types");
  const typeNodeId = uid("type");
  await ok("POST", `/api/views/${view.id}/sync`, {
    nodes: [{ id: typeNodeId, type: "partdef", position: { x: 0, y: 0 }, data: { label: typeLabel } }],
    edges: [],
  });
  return { ...metamodel, typeId: `mm:${metamodel.id}:${typeNodeId}` };
}

const element = (id: string, x: number, y: number, data: Record<string, unknown> = {}) => ({
  nodeId: id,
  type: "part",
  position: { x, y },
  data: { label: id, type: "Object", ...data },
});

async function savePattern(projectId: number, body: Record<string, unknown>) {
  return request("POST", `/api/projects/${projectId}/patterns`, { name: "Pattern", edges: [], ...body });
}

async function patternsOf(projectId: number) {
  return (await ok("GET", `/api/projects/${projectId}/patterns`)) as Json[];
}

async function instantiate(viewId: number, patternId: number, position = { x: 0, y: 0 }) {
  return request("POST", `/api/views/${viewId}/patterns/${patternId}/instantiate`, { position });
}

/** A pair of connected elements, as the editor sends them. */
function pair(a = uid("a"), b = uid("b")) {
  return {
    nodes: [element(a, -100, 0), element(b, 100, 0)],
    edges: [
      {
        source: a,
        target: b,
        edgeType: "composition",
        sourceHandle: "right",
        targetHandle: "left",
        data: { label: "contains" },
      },
    ],
  };
}

describe("capturing a pattern", () => {
  test("C1: a single element can be saved as a pattern, an empty selection cannot", async () => {
    const project = await createProject("C1");
    assert.equal((await savePattern(project.id, { nodes: [element(uid("x"), 0, 0)] })).status, 201);
    assert.equal((await savePattern(project.id, { nodes: [] })).status, 400);
  });

  test("C2: relationships must connect two elements of the pattern", async () => {
    const project = await createProject("C2");
    const a = uid("a");
    const res = await savePattern(project.id, {
      nodes: [element(a, 0, 0)],
      edges: [{ source: a, target: "somewhere-else" }],
    });
    assert.equal(res.status, 400, res.text);
    assert.equal((await patternsOf(project.id)).length, 0, "nothing was saved");
  });

  test("C3: types, attributes, relationship details and layout are kept", async () => {
    const metamodel = await createMetamodel("C3 MM", "Motor");
    const project = await createProject("C3");
    await ok("PATCH", `/api/projects/${project.id}`, { referencedMetamodels: [metamodel.id] });
    const view = await createView(project.id);
    const snippet = pair();
    snippet.nodes[0].data = {
      ...snippet.nodes[0].data,
      typeId: metamodel.typeId,
      description: "Main motor",
      attributes: [{ name: "power", value: "200 W" }],
    };
    assert.equal((await savePattern(project.id, snippet)).status, 201);
    const [pattern] = await patternsOf(project.id);

    const copy = (await instantiate(view.id, pattern.id, { x: 500, y: 300 })).json;
    const [first, second] = copy.nodes.sort((p: Json, q: Json) => p.position.x - q.position.x);
    assert.equal(first.data.typeId, metamodel.typeId);
    assert.equal(first.data.description, "Main motor");
    assert.deepEqual(first.data.attributes, [{ name: "power", value: "200 W" }]);
    assert.deepEqual(first.position, { x: 400, y: 300 });
    assert.deepEqual(second.position, { x: 600, y: 300 });
    const [edge] = copy.edges;
    assert.equal(edge.edgeType, "composition");
    assert.equal(edge.data.label, "contains");
    assert.deepEqual([edge.sourceHandle, edge.targetHandle], ["right", "left"]);
    assert.deepEqual([edge.source, edge.target], [first.id, second.id]);
  });

  test("C4: a pattern is a copy, independent of the diagram it was saved from", async () => {
    const project = await createProject("C4");
    const view = await createView(project.id);
    const snippet = pair();
    await ok("POST", `/api/views/${view.id}/sync`, {
      nodes: snippet.nodes.map((n) => ({ id: n.nodeId, type: n.type, position: n.position, data: n.data })),
      edges: [],
    });
    assert.equal((await savePattern(project.id, snippet)).status, 201);
    const [pattern] = await patternsOf(project.id);
    const patternFlow = (await ok("GET", `/api/views/${pattern.id}/flow`)) as Json;
    assert.ok(
      patternFlow.nodes.every((n: Json) => !snippet.nodes.some((s) => s.nodeId === n.id)),
      "pattern elements are new elements",
    );

    // Renaming the source elements does not change the pattern ...
    await ok("POST", `/api/views/${view.id}/sync`, {
      nodes: snippet.nodes.map((n) => ({ id: n.nodeId, type: n.type, position: n.position, data: { label: "Renamed" } })),
      edges: [],
    });
    const after = (await ok("GET", `/api/views/${pattern.id}/flow`)) as Json;
    assert.deepEqual(after.nodes.map((n: Json) => n.data.label).sort(), snippet.nodes.map((n) => n.nodeId).sort());

    // ... and editing the pattern does not change the source.
    await ok("POST", `/api/views/${pattern.id}/sync`, {
      nodes: after.nodes.map((n: Json) => ({ ...n, data: { ...n.data, label: "Edited pattern" } })),
      edges: [],
    });
    const source = (await ok("GET", `/api/views/${view.id}/flow`)) as Json;
    assert.ok(source.nodes.every((n: Json) => n.data.label === "Renamed"));
  });

  test("C5: nesting is kept, and nested elements stay relative to their parent", async () => {
    const project = await createProject("C5");
    const view = await createView(project.id);
    const parent = uid("parent");
    const child = uid("child");
    assert.equal(
      (
        await savePattern(project.id, {
          nodes: [element(parent, 0, 0), { ...element(child, 20, 30), parentId: parent }],
        })
      ).status,
      201,
    );
    const outside = await savePattern(project.id, {
      nodes: [{ ...element(uid("orphan"), 0, 0), parentId: "not-in-pattern" }],
    });
    assert.equal(outside.status, 400, outside.text);

    const [pattern] = await patternsOf(project.id);
    const copy = (await instantiate(view.id, pattern.id, { x: 1000, y: 1000 })).json;
    const copiedParent = copy.nodes.find((n: Json) => !n.parentId);
    const copiedChild = copy.nodes.find((n: Json) => n.parentId);
    assert.equal(copiedChild.parentId, copiedParent.id);
    assert.deepEqual(copiedParent.position, { x: 1000, y: 1000 });
    assert.deepEqual(copiedChild.position, { x: 20, y: 30 });
  });

  test("a pattern saved from inserted copies does not claim to be a copy", async () => {
    const project = await createProject("Origin");
    const view = await createView(project.id);
    await savePattern(project.id, pair());
    const [pattern] = await patternsOf(project.id);
    const copy = (await instantiate(view.id, pattern.id)).json;
    const res = await savePattern(project.id, {
      name: "Second",
      nodes: copy.nodes.map((n: Json) => ({ nodeId: n.id, type: n.type, position: n.position, data: n.data })),
      edges: copy.edges.map((e: Json) => ({ ...e, id: undefined, viewId: undefined })),
    });
    assert.equal(res.status, 201, res.text);
    const second = (await patternsOf(project.id)).find((p) => p.name === "Second");
    const flow = (await ok("GET", `/api/views/${second.id}/flow`)) as Json;
    assert.ok(flow.nodes.every((n: Json) => n.data.pattern === undefined));
    assert.ok(flow.edges.every((e: Json) => e.data?.pattern === undefined));
  });
});

describe("where patterns live", () => {
  test("L1: a project's own patterns are listed and usable in all its diagrams", async () => {
    const project = await createProject("L1");
    await savePattern(project.id, { name: "Own", nodes: [element(uid("x"), 0, 0)] });
    const [pattern] = await patternsOf(project.id);
    assert.equal(pattern.ownedByProject, true);
    assert.equal(pattern.projectName, "L1");
    for (const name of ["First", "Second"]) {
      const view = await createView(project.id, name);
      assert.equal((await instantiate(view.id, pattern.id)).status, 200);
    }
  });

  test("L2: patterns of every metamodel in the reference chain are offered, read-only", async () => {
    const base = await createMetamodel("Base MM", "Component");
    const domain = await createMetamodel("Domain MM", "Drone", [base.id]);
    const unrelated = await createMetamodel("Unrelated MM", "Other");
    for (const [metamodel, name] of [
      [base, "Base pattern"],
      [domain, "Domain pattern"],
      [unrelated, "Unrelated pattern"],
    ] as const) {
      const res = await savePattern(metamodel.id, {
        name,
        nodes: [element(uid("x"), 0, 0, { typeId: metamodel.typeId })],
      });
      assert.equal(res.status, 201, res.text);
    }

    const project = await createProject("L2");
    await ok("PATCH", `/api/projects/${project.id}`, { referencedMetamodels: [domain.id] });
    const view = await createView(project.id);
    const listed = await patternsOf(project.id);
    assert.deepEqual(
      listed.map((p) => [p.name, p.projectName, p.ownedByProject]),
      [
        ["Domain pattern", "Domain MM", false],
        ["Base pattern", "Base MM", false],
      ],
    );

    const fromBase = listed.find((p) => p.name === "Base pattern");
    const copy = await instantiate(view.id, fromBase.id);
    assert.equal(copy.status, 200, copy.text);
    assert.equal(copy.json.nodes[0].data.typeId, base.typeId);

    const [notReferenced] = await patternsOf(unrelated.id);
    assert.equal((await instantiate(view.id, notReferenced.id)).status, 400);
  });

  test("L3: pattern elements are not part of the model", async () => {
    const project = await createProject("L3");
    await createView(project.id, "Diagram");
    await savePattern(project.id, { nodes: [element(uid("x"), 0, 0)] });
    const views = (await ok("GET", `/api/projects/${project.id}/views`)) as Json[];
    assert.deepEqual(views.map((v) => v.name), ["Diagram"]);
  });

  test("L4: deleting a pattern keeps the copies already made from it", async () => {
    const project = await createProject("L4");
    const view = await createView(project.id);
    await savePattern(project.id, pair());
    const [pattern] = await patternsOf(project.id);
    const copy = (await instantiate(view.id, pattern.id)).json;
    await ok("POST", `/api/views/${view.id}/sync`, copy);
    assert.equal((await request("DELETE", `/api/views/${pattern.id}`)).status, 204);
    const flow = (await ok("GET", `/api/views/${view.id}/flow`)) as Json;
    assert.equal(flow.nodes.length, 2);
    assert.equal(flow.edges.length, 1);
  });
});

describe("inserting a pattern (clone and own)", () => {
  test("I1: every insert is a new, unsaved copy that remembers its origin", async () => {
    const project = await createProject("I1");
    const view = await createView(project.id);
    await savePattern(project.id, pair());
    const [pattern] = await patternsOf(project.id);
    const patternFlow = (await ok("GET", `/api/views/${pattern.id}/flow`)) as Json;

    const first = (await instantiate(view.id, pattern.id)).json;
    const second = (await instantiate(view.id, pattern.id)).json;
    const ids = [...first.nodes, ...second.nodes, ...first.edges, ...second.edges].map((x: Json) => x.id);
    assert.equal(new Set(ids).size, 6, "all ids are new");
    assert.ok(!ids.some((id) => patternFlow.nodes.some((n: Json) => n.id === id)));

    const saved = (await ok("GET", `/api/views/${view.id}/flow`)) as Json;
    assert.equal(saved.nodes.length, 0, "instantiating saves nothing");

    for (const copy of [first, second]) {
      const origins = [...copy.nodes, ...copy.edges].map((x: Json) => x.data.pattern);
      assert.ok(origins.every((o: Json) => o.patternId === pattern.id && o.projectId === project.id));
      assert.equal(new Set(origins.map((o: Json) => o.insertionId)).size, 1, "one insert, one insertion id");
      assert.deepEqual(
        copy.nodes.map((n: Json) => n.data.pattern.elementId).sort(),
        patternFlow.nodes.map((n: Json) => n.id).sort(),
      );
    }
    assert.notEqual(first.nodes[0].data.pattern.insertionId, second.nodes[0].data.pattern.insertionId);

    // Both copies are saved with the diagram, origin included, and stay independent.
    await ok("POST", `/api/views/${view.id}/sync`, {
      nodes: [...first.nodes, ...second.nodes],
      edges: [...first.edges, ...second.edges],
    });
    const both = (await ok("GET", `/api/views/${view.id}/flow`)) as Json;
    assert.equal(both.nodes.length, 4);
    assert.equal(both.edges.length, 2);
    assert.ok(both.nodes.every((n: Json) => n.data.pattern?.patternId === pattern.id));
  });

  test("I4: every type a pattern uses must be known, when saving and when inserting", async () => {
    const metamodel = await createMetamodel("I4 MM", "Battery");
    const project = await createProject("I4");
    await ok("PATCH", `/api/projects/${project.id}`, { referencedMetamodels: [metamodel.id] });
    const view = await createView(project.id);

    const unknown = await savePattern(project.id, {
      nodes: [element(uid("x"), 0, 0, { typeId: "mm:999999:nope" })],
    });
    assert.equal(unknown.status, 400, unknown.text);

    const definition = await savePattern(project.id, {
      nodes: [{ ...element(uid("x"), 0, 0), type: "partdef" }],
    });
    assert.equal(definition.status, 400, "patterns hold model elements, not type definitions");

    assert.equal(
      (await savePattern(project.id, { nodes: [element(uid("x"), 0, 0, { typeId: metamodel.typeId })] })).status,
      201,
    );
    const [pattern] = await patternsOf(project.id);
    assert.equal((await instantiate(view.id, pattern.id)).status, 200);

    // Once the project no longer references the metamodel, its types are unknown.
    await ok("PATCH", `/api/projects/${project.id}`, { referencedMetamodels: [] });
    const refused = await instantiate(view.id, pattern.id);
    assert.equal(refused.status, 400, refused.text);
    assert.match(refused.json.message, /not known/);
  });

  test("patterns are inserted into instance models only", async () => {
    const metamodel = await createMetamodel("Target MM", "Type");
    await savePattern(metamodel.id, { nodes: [element(uid("x"), 0, 0, { typeId: metamodel.typeId })] });
    const [pattern] = await patternsOf(metamodel.id);
    const mmView = await createView(metamodel.id, "More types");
    assert.equal((await instantiate(mmView.id, pattern.id)).status, 400);
  });
});
