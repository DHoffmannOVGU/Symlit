import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  getRecentProjects,
  rememberRecentProject,
} from "./recent-projects";

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  clear() {
    this.values.clear();
  }
}

const originalWindow = (globalThis as { window?: unknown }).window;
const storage = new MemoryStorage();

function installWindow() {
  storage.clear();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { localStorage: storage },
  });
}

afterEach(() => {
  storage.clear();
  if (originalWindow === undefined) {
    Reflect.deleteProperty(globalThis, "window");
  } else {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: originalWindow,
    });
  }
});

test("migrates legacy ID-only recent projects when reading", () => {
  installWindow();
  storage.setItem(
    "symlit_recent_projects:7",
    JSON.stringify([41, 42, { projectId: 43, openedAt: 1234 }, 0, "invalid"]),
  );

  assert.deepEqual(getRecentProjects(7), [
    { projectId: 41, openedAt: 0 },
    { projectId: 42, openedAt: 0 },
    { projectId: 43, openedAt: 1234 },
  ]);
});

test("updates timestamps and moves reopened projects to the front", () => {
  installWindow();
  const originalNow = Date.now;
  let now = 1000;
  Date.now = () => now;

  try {
    rememberRecentProject(7, 41);
    now = 2000;
    rememberRecentProject(7, 42);
    now = 3000;
    rememberRecentProject(7, 41);

    assert.deepEqual(getRecentProjects(7), [
      { projectId: 41, openedAt: 3000 },
      { projectId: 42, openedAt: 2000 },
    ]);
  } finally {
    Date.now = originalNow;
  }
});