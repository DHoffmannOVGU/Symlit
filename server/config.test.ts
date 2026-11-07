import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { loadConfig } from "./config";

test("runs with no environment at all: embedded database, loopback, AI off", () => {
  const config = loadConfig({});
  assert.equal(config.port, 5000);
  assert.equal(config.host, "127.0.0.1");
  assert.deepEqual(config.database, {
    driver: "pglite",
    dataDir: path.resolve("./data", "pg"),
  });
  assert.equal(config.seedDemo, true);
  assert.deepEqual(config.features, { ai: false });
});

test("uses PostgreSQL when DATABASE_URL is set", () => {
  const config = loadConfig({ DATABASE_URL: "postgres://u:p@db:5432/symlit" });
  assert.deepEqual(config.database, { driver: "postgres", url: "postgres://u:p@db:5432/symlit" });
});

test("an empty DATABASE_URL falls back to the embedded database", () => {
  assert.equal(loadConfig({ DATABASE_URL: "" }).database.driver, "pglite");
});

test(":memory: data dir keeps the embedded database in RAM", () => {
  assert.deepEqual(loadConfig({ SYMLIT_DATA_DIR: ":memory:" }).database, {
    driver: "pglite",
    dataDir: null,
  });
});

test("enables optional features from the environment", () => {
  const config = loadConfig({
    GEMINI_API_KEY: "key",
    SYMLIT_SEED_DEMO: "0",
  });
  assert.deepEqual(config.features, { ai: true });
  assert.equal(config.seedDemo, false);
});

test("a blank AI key does not enable the assistant", () => {
  assert.equal(loadConfig({ GEMINI_API_KEY: "   " }).features.ai, false);
});

test("rejects invalid values with a readable message", () => {
  assert.throws(() => loadConfig({ PORT: "not-a-port" }), /Invalid Symlit configuration:[\s\S]*PORT/);
  assert.throws(() => loadConfig({ SYMLIT_SEED_DEMO: "maybe" }), /SYMLIT_SEED_DEMO/);
});

test("migrations are found next to the entry point when not in the working directory", async () => {
  const { mkdtemp, mkdir, writeFile, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { resolveMigrationsDir } = await import("./db");
  const root = await mkdtemp(path.join(tmpdir(), "symlit-root-"));
  try {
    const real = path.join(root, "app", "migrations");
    await mkdir(path.join(real, "meta"), { recursive: true });
    await writeFile(path.join(real, "meta", "_journal.json"), "{}");
    const missing = path.join(root, "elsewhere", "migrations");
    assert.equal(resolveMigrationsDir([missing, real]), real);
    assert.equal(resolveMigrationsDir([missing]), missing, "falls back to the first candidate");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
