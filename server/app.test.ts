import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { after, before, describe, test } from "node:test";
import { createApp } from "./app";
import type { AppConfig } from "./config";
import type { DatabaseHandle } from "./db";
import { createTestDatabase } from "./testing/test-db";
import { seedDemoProject } from "./seed";
import { storage } from "./storage";

const config: AppConfig = {
  env: "test",
  port: 0,
  host: "127.0.0.1",
  database: { driver: "pglite", dataDir: null },
  seedDemo: false,
  localUserName: "Test Engineer",
  features: { ai: false, internalViews: false },
};

let database: DatabaseHandle;
let baseUrl: string;
let closeServer: () => Promise<void>;
let localUserId: number;

before(async () => {
  database = await createTestDatabase();
  const { httpServer, resolveLocalUser } = await createApp(config, { requestLogging: false });
  await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${(httpServer.address() as AddressInfo).port}`;
  closeServer = () => new Promise((resolve) => httpServer.close(() => resolve()));
  localUserId = (await resolveLocalUser()).id;
});

after(async () => {
  await closeServer();
  await database.close();
});

async function request(method: string, path: string, body?: unknown) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let json: any = undefined;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    json = undefined;
  }
  return { status: response.status, json, text, headers: response.headers };
}

async function createProject(overrides: Record<string, unknown> = {}) {
  const res = await request("POST", "/api/projects", {
    userId: localUserId,
    name: "Drone",
    description: "Quadcopter",
    projectType: "instance",
    ...overrides,
  });
  assert.equal(res.status, 201, res.text);
  return res.json as { id: number; userId: number; projectType: string };
}

async function createView(projectId: number, name = "Context") {
  const res = await request("POST", `/api/projects/${projectId}/views`, { name });
  assert.equal(res.status, 201, res.text);
  return res.json as { id: number; projectId: number };
}

const sampleFlow = (prefix: string) => ({
  nodes: [
    { id: `${prefix}-a`, type: "part", position: { x: 0, y: 0 }, data: { label: "Frame", type: "Object" } },
    { id: `${prefix}-b`, type: "part", position: { x: 200, y: 50 }, data: { label: "Motor", type: "Object" } },
  ],
  edges: [
    {
      id: `${prefix}-ab`,
      source: `${prefix}-a`,
      target: `${prefix}-b`,
      edgeType: "association",
      sourceHandle: null,
      targetHandle: null,
    },
  ],
});

describe("configuration and identity", () => {
  test("GET /api/config exposes the local edition and its features", async () => {
    const res = await request("GET", "/api/config");
    assert.equal(res.status, 200);
    assert.equal(res.json.edition, "local");
    assert.deepEqual(res.json.features, { ai: false, internalViews: false });
    assert.equal(typeof res.json.version, "string");
  });

  test("GET /api/auth/me resolves the implicit local owner", async () => {
    const res = await request("GET", "/api/auth/me");
    assert.equal(res.status, 200);
    assert.equal(res.json.authKind, "local");
    assert.equal(res.json.role, "admin");
    assert.equal(res.json.user.id, localUserId);
    assert.equal(res.json.user.displayName, "Test Engineer");
    assert.equal(res.json.capabilities.canEditMetamodels, true);
  });

  test("hosted-only endpoints are not part of the local API", async () => {
    for (const [method, path] of [
      ["POST", "/api/auth/login"],
      ["POST", "/api/auth/guest"],
      ["GET", "/api/shares/abc"],
      ["GET", "/api/projects/1/members"],
    ] as const) {
      const res = await request(method, path, method === "POST" ? {} : undefined);
      assert.ok([403, 404, 405].includes(res.status), `${method} ${path} -> ${res.status}`);
    }
  });
});

describe("projects", () => {
  test("create, list, get, update and delete", async () => {
    const project = await createProject({ name: "Rover" });
    assert.equal(project.userId, localUserId);

    const list = await request("GET", `/api/users/${localUserId}/projects`);
    assert.equal(list.status, 200);
    assert.ok(list.json.some((p: { id: number }) => p.id === project.id));

    const updated = await request("PATCH", `/api/projects/${project.id}`, { name: "Rover v2" });
    assert.equal(updated.status, 200);
    assert.equal(updated.json.name, "Rover v2");

    const fetched = await request("GET", `/api/projects/${project.id}`);
    assert.equal(fetched.json.name, "Rover v2");

    const deleted = await request("DELETE", `/api/projects/${project.id}`);
    assert.equal(deleted.status, 204);
    const gone = await request("GET", `/api/projects/${project.id}`);
    assert.equal(gone.status, 404);
  });

  test("rejects invalid input with 400", async () => {
    const res = await request("POST", "/api/projects", { userId: localUserId });
    assert.equal(res.status, 400);
  });

  test("the session user owns new projects regardless of the submitted userId", async () => {
    const project = await createProject({ userId: 999_999 });
    assert.equal(project.userId, localUserId);
  });

  test("instance projects keep referenced metamodels", async () => {
    const metamodel = await createProject({ name: "Vocabulary", projectType: "metamodel" });
    const instance = await createProject({ name: "Fleet" });
    const res = await request("PATCH", `/api/projects/${instance.id}`, {
      referencedMetamodels: [metamodel.id],
    });
    assert.equal(res.status, 200);
    assert.deepEqual(res.json.referencedMetamodels, [metamodel.id]);
  });
});

describe("authorization", () => {
  test("projects owned by another user are not accessible", async () => {
    const stranger = await storage.getOrCreateUser("someone-else");
    const foreign = await storage.createProject({
      userId: stranger.id,
      name: "Not mine",
      projectType: "instance",
    });
    const foreignView = await storage.createView({ projectId: foreign.id, name: "Hidden" });

    assert.equal((await request("GET", `/api/projects/${foreign.id}`)).status, 403);
    assert.equal((await request("DELETE", `/api/projects/${foreign.id}`)).status, 403);
    assert.equal((await request("GET", `/api/projects/${foreign.id}/views`)).status, 403);
    assert.equal((await request("GET", `/api/views/${foreignView.id}`)).status, 403);
    assert.equal((await request("GET", `/api/views/${foreignView.id}/flow`)).status, 403);
    assert.equal(
      (await request("POST", `/api/views/${foreignView.id}/sync`, sampleFlow("x"))).status,
      403,
    );
    assert.equal((await request("GET", `/api/users/${stranger.id}/projects`)).status, 403);
    assert.ok(await storage.getProject(foreign.id), "foreign project must survive");
  });

  test("unknown views and nodes return 404", async () => {
    assert.equal((await request("GET", "/api/views/987654")).status, 404);
    assert.equal((await request("GET", "/api/nodes/does-not-exist")).status, 404);
  });
});

describe("views and diagrams", () => {
  test("flow sync round-trips nodes, positions and edges", async () => {
    const project = await createProject();
    const view = await createView(project.id);
    const flow = sampleFlow(`p${project.id}`);

    const sync = await request("POST", `/api/views/${view.id}/sync`, flow);
    assert.ok(sync.status >= 200 && sync.status < 300, sync.text);

    const loaded = await request("GET", `/api/views/${view.id}/flow`);
    assert.equal(loaded.status, 200);
    assert.deepEqual(
      loaded.json.nodes.map((n: any) => [n.id, n.position]).sort(),
      flow.nodes.map((n) => [n.id, n.position]).sort(),
    );
    assert.equal(loaded.json.edges.length, 1);
    assert.equal(loaded.json.edges[0].source, flow.nodes[0].id);
  });

  test("a node can be placed in a second view of the same project", async () => {
    const project = await createProject();
    const first = await createView(project.id, "First");
    const second = await createView(project.id, "Second");
    const flow = sampleFlow(`shared${project.id}`);
    await request("POST", `/api/views/${first.id}/sync`, flow);

    const insert = await request(
      "POST",
      `/api/views/${second.id}/nodes/${flow.nodes[0].id}/insert`,
      { position: { x: 42, y: 24 } },
    );
    assert.ok(insert.status >= 200 && insert.status < 300, insert.text);

    const loaded = await request("GET", `/api/views/${second.id}/flow`);
    assert.deepEqual(loaded.json.nodes.map((n: any) => n.id), [flow.nodes[0].id]);
    assert.deepEqual(loaded.json.nodes[0].position, { x: 42, y: 24 });
  });

  test("rejects edges whose endpoints are missing", async () => {
    const project = await createProject();
    const view = await createView(project.id);
    const flow = sampleFlow(`bad${project.id}`);
    flow.edges[0].target = "missing-node";
    const res = await request("POST", `/api/views/${view.id}/sync`, flow);
    assert.equal(res.status, 400, res.text);
  });

  test("deleting a project removes its views and diagram content", async () => {
    const project = await createProject();
    const view = await createView(project.id);
    const flow = sampleFlow(`del${project.id}`);
    await request("POST", `/api/views/${view.id}/sync`, flow);

    assert.equal((await request("DELETE", `/api/projects/${project.id}`)).status, 204);
    assert.equal(await storage.getView(view.id), undefined);
    assert.equal(await storage.getNodeById(flow.nodes[0].id), undefined);
  });
});

describe("export", () => {
  test("exports JSON and CSV", async () => {
    const project = await createProject({ name: "Export me" });
    const view = await createView(project.id);
    await request("POST", `/api/views/${view.id}/sync`, sampleFlow(`exp${project.id}`));

    const json = await request("POST", `/api/projects/${project.id}/export`, { format: "json" });
    assert.equal(json.status, 200, json.text);
    assert.match(json.text, /Frame/);

    const csv = await request("POST", `/api/projects/${project.id}/export`, {
      format: "elements-csv",
    });
    assert.equal(csv.status, 200);
    assert.match(csv.headers.get("content-type") ?? "", /text\/csv/);
    assert.match(csv.text, /Motor/);
  });
});

describe("optional features", () => {
  test("the AI assistant reports 503 when no API key is configured", async () => {
    const project = await createProject({ projectType: "metamodel" });
    const view = await createView(project.id);
    const res = await request("POST", `/api/projects/${project.id}/views/${view.id}/ai/metamodel`, {
      messages: [{ role: "user", content: "Model a drone" }],
    });
    assert.equal(res.status, 503);
  });
});

describe("API routing", () => {
  test("unknown API paths return JSON 404 and wrong methods 405", async () => {
    const missing = await request("GET", "/api/definitely-not-a-route");
    assert.equal(missing.status, 404);
    assert.equal(missing.json.error, "Not Found");

    const wrongMethod = await request("PUT", "/api/config");
    assert.equal(wrongMethod.status, 405);
    assert.match(wrongMethod.headers.get("allow") ?? "", /GET/);
  });
});

describe("demo seed", () => {
  test("creates the demo project once for an empty workspace", async () => {
    const owner = await storage.getOrCreateUser("seed-owner");
    assert.equal(await seedDemoProject(owner.id), true);
    assert.equal(await seedDemoProject(owner.id), false);
    const projects = await storage.getProjectsByUser(owner.id);
    assert.equal(projects.length, 1);
    const [view] = await storage.getViews(projects[0].id);
    const flow = await storage.getFlow(view.id);
    assert.equal(flow.nodes.length, 2);
    assert.equal(flow.edges.length, 1);
  });

  test("seeding two workspaces does not collide on node ids", async () => {
    const other = await storage.getOrCreateUser("seed-owner-2");
    assert.equal(await seedDemoProject(other.id), true);
  });
});
