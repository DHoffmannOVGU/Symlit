import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";
import { createApp } from "./app";
import type { AuthProvider } from "./auth";
import type { AppConfig } from "./config";
import type { DatabaseHandle } from "./db";
import { storage } from "./storage";
import { createTestDatabase } from "./testing/test-db";

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

// A stand-in for a hosted sign-in: the "x-test-user" header plays the session.
const testAuth: AuthProvider = {
  kind: "test",
  signInUrl: "/auth/login",
  signOutUrl: "/auth/logout",
  setup(app) {
    app.get("/auth/login", (_req, res) => res.send("login page"));
  },
  async attachUser(req, _res, next) {
    const name = req.header("x-test-user");
    if (name) {
      req.workspaceUser = await storage.getOrCreateUser(name);
      req.workspaceRole = "admin";
    }
    next();
  },
};

let database: DatabaseHandle;
let baseUrl: string;
let closeServer: () => Promise<void>;

before(async () => {
  database = await createTestDatabase();
  const { httpServer } = await createApp(config, { requestLogging: false, auth: testAuth });
  await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${(httpServer.address() as AddressInfo).port}`;
  closeServer = () => new Promise((resolve) => httpServer.close(() => resolve()));
});

after(async () => {
  await closeServer();
  await database.close();
});

test("a custom auth provider's routes are mounted", async () => {
  const response = await fetch(`${baseUrl}/auth/login`);
  assert.equal(await response.text(), "login page");
});

test("signed-out API requests get 401 with the sign-in URL", async () => {
  const response = await fetch(`${baseUrl}/api/projects`);
  assert.equal(response.status, 401);
  assert.equal((await response.json()).signInUrl, "/auth/login");
});

test("signed-in requests report the provider and its sign-out URL", async () => {
  const response = await fetch(`${baseUrl}/api/auth/me`, { headers: { "x-test-user": "alice" } });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.user.username, "alice");
  assert.equal(body.authKind, "test");
  assert.equal(body.signOutUrl, "/auth/logout");
});

test("users only see their own projects", async () => {
  const headers = (user: string) => ({ "x-test-user": user, "content-type": "application/json" });
  const created = await fetch(`${baseUrl}/api/projects`, {
    method: "POST",
    headers: headers("alice"),
    body: JSON.stringify({ name: "Alice's project", type: "metamodel" }),
  });
  assert.ok(created.ok, `create failed: ${created.status} ${await created.clone().text()}`);
  const project = await created.json();
  const asBob = await fetch(`${baseUrl}/api/projects/${project.id}`, { headers: headers("bob") });
  assert.equal(asBob.status, 403);
});
