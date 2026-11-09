import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { after, before, describe, test } from "node:test";
import type { ProjectFileInput } from "@shared/project-file";
import { createApp } from "./app";
import type { AppConfig } from "./config";
import type { DatabaseHandle } from "./db";
import { importProjectFile } from "./services/project-import";
import { createTestDatabase } from "./testing/test-db";

/*
 * Project templates and project files: the requirements in
 * docs/decisions/project-templates.md. Ids in test names (T1, F2, ...) refer
 * to that list.
 */

const config: AppConfig = {
  env: "test",
  port: 0,
  host: "127.0.0.1",
  database: { driver: "pglite", dataDir: null },
  seedDemo: false,
  localUserName: "Test Engineer",
  allowedHosts: [],
  features: { ai: false },
};

let database: DatabaseHandle;
let baseUrl: string;
let closeServer: () => Promise<void>;
let userId: number;

before(async () => {
  database = await createTestDatabase();
  const { httpServer, resolveLocalUser } = await createApp(config, { requestLogging: false });
  await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${(httpServer.address() as AddressInfo).port}`;
  closeServer = () => new Promise((resolve) => httpServer.close(() => resolve()));
  userId = (await resolveLocalUser()).id;
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
  return { status: response.status, json: text ? JSON.parse(text) : undefined, text };
}

async function ok(method: string, path: string, body?: unknown) {
  const res = await request(method, path, body);
  assert.ok(res.status < 300, `${method} ${path}: ${res.status} ${res.text}`);
  return res.json as Json;
}

const projectCount = async () => ((await ok("GET", "/api/projects")) as Json[]).length;
const viewsOf = async (projectId: number) => (await ok("GET", `/api/projects/${projectId}/views`)) as Json[];
const flowOf = async (viewId: number) => (await ok("GET", `/api/views/${viewId}/flow`)) as Json;
const patternsOf = async (projectId: number) => (await ok("GET", `/api/projects/${projectId}/patterns`)) as Json[];

/** A metamodel with two types and a model typed by it, using ids from another database. */
function bundleFile(): ProjectFileInput {
  return {
    export: { version: 1 },
    project: {
      id: 20,
      name: "Fleet",
      projectType: "instance",
      referencedMetamodels: [10],
    },
    views: [
      {
        id: 200,
        name: "Overview",
        nodes: [
          { id: "drone", type: "part", position: { x: 0, y: 0 }, data: { label: "Courier", typeId: "mm:10:t-drone" } },
          { id: "battery", type: "part", position: { x: 300, y: 0 }, data: { label: "Pack", typeId: "mm:10:t-battery" } },
          // A metamodel element placed in the model's diagram.
          { id: "t-drone", projectId: 10, type: "partdef", position: { x: 0, y: 200 }, data: { label: "Drone" } },
        ],
        edges: [{ id: "e1", source: "drone", target: "battery", edgeType: "composition", sourceHandle: "right", targetHandle: "left" }],
        modelRules: [
          {
            id: "r1",
            name: "Drones need a name",
            enabled: true,
            targetType: "mm:10:t-drone",
            condition: { kind: "comparison", source: "connected", targetType: "mm:10:t-battery", field: "name", operator: "missing" },
            outcome: { kind: "issue", severity: "warning" },
          } as Json,
        ],
      },
      {
        id: 201,
        name: "Battery detail",
        // The same element in a second diagram.
        nodes: [{ id: "battery", type: "part", position: { x: 50, y: 50 }, data: { label: "Pack", typeId: "mm:10:t-battery" } }],
        edges: [],
      },
    ],
    referencedMetamodels: [
      {
        project: { id: 10, name: "Fleet types", projectType: "metamodel", referencedMetamodels: [] },
        views: [
          {
            id: 100,
            name: "Types",
            nodes: [
              { id: "t-drone", type: "partdef", position: { x: 0, y: 0 }, data: { label: "Drone" } },
              { id: "t-battery", type: "partdef", position: { x: 300, y: 0 }, data: { label: "Battery" } },
            ],
            edges: [{ id: "te", source: "t-drone", target: "t-battery", edgeType: "composition" }],
          },
        ],
        patterns: [
          {
            id: 110,
            name: "Drone kit",
            nodes: [{ id: "p-drone", type: "part", position: { x: 0, y: 0 }, data: { label: "Kit drone", typeId: "mm:10:t-drone" } }],
            edges: [],
          },
        ],
      },
    ],
  };
}

describe("built-in project templates", () => {
  test("T1: listed templates are offered with what they create; the tutorial's is not listed", async () => {
    const templates = (await ok("GET", "/api/project-templates")) as Json[];
    const ids = templates.map((t) => t.id);
    assert.deepEqual(ids, ["system-context", "requirements-baseline"]);
    const systemContext = templates.find((t) => t.id === "system-context");
    assert.equal(systemContext.projectType, "instance");
    assert.equal(systemContext.projectName, "System Context");
    assert.deepEqual(systemContext.includedMetamodels, []);
  });

  test("T2/T3: creating from a template creates fresh projects each time and records the template", async () => {
    const first = await ok("POST", "/api/project-templates/system-context/projects", {});
    const second = await ok("POST", "/api/project-templates/system-context/projects", { name: "My context" });
    assert.notEqual(first.project.id, second.project.id);
    assert.equal(first.project.templateId, "system-context");
    assert.equal(second.project.name, "My context");
    const a = await flowOf(first.firstViewId);
    const b = await flowOf(second.firstViewId);
    assert.equal(a.nodes.length, 3);
    assert.equal(a.edges.length, 2);
    const shared = a.nodes.filter((n: Json) => b.nodes.some((m: Json) => m.id === n.id));
    assert.equal(shared.length, 0, "every creation has its own elements");
  });

  test("T4: a metamodel template keeps its setup unless one is chosen", async () => {
    const plain = await ok("POST", "/api/project-templates/requirements-baseline/projects", {});
    assert.equal(plain.project.projectType, "metamodel");
    assert.equal(plain.project.metamodelSetup.purpose, "requirements");
    const custom = await ok("POST", "/api/project-templates/requirements-baseline/projects", {
      description: "Ours",
      metamodelSetup: { version: 1, purpose: "custom", description: "", nodeTypes: ["partdef"], relationTypes: [] },
    });
    assert.equal(custom.project.description, "Ours");
    assert.equal(custom.project.metamodelSetup.purpose, "custom");
  });

  test("T5: the tutorial is a template bundle: a metamodel and a model typed by it", async () => {
    const tutorial = await ok("POST", "/api/tutorial");
    assert.equal(tutorial.metamodel.templateId, "tutorial");
    assert.equal(tutorial.instance.templateId, "tutorial");
    assert.deepEqual(tutorial.instance.referencedMetamodels, [tutorial.metamodel.id]);
    const { issues } = await ok("POST", `/api/views/${tutorial.instanceViewId}/validate`);
    assert.ok(
      !issues.some((issue: Json) => /missing type|no type/.test(issue.message)),
      "every element of the model has a type from the new metamodel",
    );
    await ok("DELETE", "/api/tutorial");
  });

  test("T6: an unknown template is a 404 and creates nothing", async () => {
    const before = await projectCount();
    assert.equal((await request("POST", "/api/project-templates/nope/projects", {})).status, 404);
    assert.equal(await projectCount(), before);
  });
});

describe("importing a project file", () => {
  test("F1: every project of the bundle is created, with references rewired", async () => {
    const result = await importProjectFile(bundleFile(), { userId, templateId: "fleet" });
    const metamodel = result.projects.get(10)!;
    const model = result.projects.get(20)!;
    assert.equal(result.project.id, model.id, "the main project is the file's project");
    assert.deepEqual(model.referencedMetamodels, [metamodel.id]);
    assert.equal(metamodel.templateId, "fleet");
    assert.equal(model.templateId, "fleet");

    const types = await flowOf(result.firstViewIds.get(10)!);
    const typeIdOf = (label: string) => `mm:${metamodel.id}:${types.nodes.find((n: Json) => n.data.label === label).id}`;
    const overview = await flowOf(result.firstViewId!);
    const courier = overview.nodes.find((n: Json) => n.data.label === "Courier");
    assert.equal(courier.data.typeId, typeIdOf("Drone"));
    assert.ok(!overview.nodes.some((n: Json) => n.id === "drone"), "ids are fresh");

    // F2: the metamodel element shown in the model's diagram is the new metamodel's element.
    const placedType = overview.nodes.find((n: Json) => n.data.label === "Drone");
    assert.equal(placedType.projectId, metamodel.id);
    assert.equal(`mm:${metamodel.id}:${placedType.id}`, typeIdOf("Drone"));

    // F3: model rules point at the new types.
    const [view] = (await viewsOf(model.id)).filter((v) => v.name === "Overview");
    assert.equal(view.modelRules[0].targetType, typeIdOf("Drone"));
    assert.equal(view.modelRules[0].condition.targetType, typeIdOf("Battery"));

    const { issues } = await ok("POST", `/api/views/${result.firstViewId}/validate`);
    assert.ok(!issues.some((issue: Json) => /missing type/.test(issue.message)), JSON.stringify(issues));
  });

  test("F4: an element shown in several diagrams stays one element", async () => {
    const result = await importProjectFile(bundleFile(), { userId });
    const model = result.projects.get(20)!;
    const [overview, detail] = (await viewsOf(model.id)).sort((a, b) => a.id - b.id);
    const pack = (await flowOf(overview.id)).nodes.find((n: Json) => n.data.label === "Pack");
    const packInDetail = (await flowOf(detail.id)).nodes[0];
    assert.equal(packInDetail.id, pack.id);
    assert.deepEqual(packInDetail.position, { x: 50, y: 50 }, "each diagram keeps its own position");
  });

  test("F5: patterns come along, also those of metamodels", async () => {
    const result = await importProjectFile(bundleFile(), { userId });
    const metamodel = result.projects.get(10)!;
    const listed = await patternsOf(result.project.id);
    assert.deepEqual(listed.map((p) => [p.name, p.projectName]), [["Drone kit", "Fleet types"]]);
    const kit = (await flowOf(listed[0].id)).nodes[0];
    assert.match(kit.data.typeId, new RegExp(`^mm:${metamodel.id}:`));
  });

  test("F6: copies of a pattern keep pointing at the imported pattern", async () => {
    const file = bundleFile() as Json;
    file.views[0].nodes[0].data.pattern = { patternId: 110, projectId: 10, elementId: "p-drone", insertionId: "i1" };
    file.views[0].nodes[1].data.pattern = { patternId: 999, projectId: 77, elementId: "x", insertionId: "i2" };
    const result = await importProjectFile(file, { userId });
    const [kit] = await patternsOf(result.project.id);
    const kitElement = (await flowOf(kit.id)).nodes[0];
    const overview = await flowOf(result.firstViewId!);
    const courier = overview.nodes.find((n: Json) => n.data.label === "Courier");
    assert.deepEqual(courier.data.pattern, {
      patternId: kit.id,
      projectId: result.projects.get(10)!.id,
      elementId: kitElement.id,
      insertionId: "i1",
    });
    const pack = overview.nodes.find((n: Json) => n.data.label === "Pack");
    assert.equal(pack.data.pattern, undefined, "origins outside the file are dropped");
  });

  test("F7: a broken file is refused as a whole", async () => {
    const before = await projectCount();
    const missingMetamodel = bundleFile() as Json;
    delete missingMetamodel.referencedMetamodels;
    await assert.rejects(importProjectFile(missingMetamodel, { userId }), /not in the file/);

    const danglingRelationship = bundleFile() as Json;
    danglingRelationship.views[1].edges = [{ source: "battery", target: "drone" }];
    await assert.rejects(importProjectFile(danglingRelationship, { userId }), /outside the diagram/);

    await assert.rejects(importProjectFile({ export: { version: 2 } }, { userId }), /Not a valid project file/);
    assert.equal(await projectCount(), before, "nothing was saved");
  });

  test("F8: an export with its metamodels and patterns imports back to the same model", async () => {
    const original = await importProjectFile(bundleFile(), { userId });
    const exported = await ok("POST", `/api/projects/${original.project.id}/export`, {
      includeReferencedMetamodels: true,
      includePatterns: true,
    });
    const copy = await importProjectFile(exported, { userId });
    const summary = async (projectId: number) =>
      Promise.all(
        (await viewsOf(projectId)).map(async (view) => {
          const flow = await flowOf(view.id);
          return [view.name, flow.nodes.length, flow.edges.length];
        }),
      );
    assert.deepEqual(await summary(copy.project.id), await summary(original.project.id));
    assert.equal(copy.projects.size, 2);
    assert.deepEqual((await patternsOf(copy.project.id)).map((p) => p.name), ["Drone kit"]);
    const { issues } = await ok("POST", `/api/views/${copy.firstViewId}/validate`);
    assert.ok(!issues.some((issue: Json) => /missing type/.test(issue.message)), JSON.stringify(issues));
  });
});
