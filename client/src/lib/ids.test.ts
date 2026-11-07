import assert from "node:assert/strict";
import test from "node:test";
import { newEdgeId, newNodeId, randomId } from "./ids";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

test("ids are unique even when created in the same millisecond", () => {
  const ids = new Set(Array.from({ length: 5000 }, () => newNodeId()));
  assert.equal(ids.size, 5000);
  assert.match(newNodeId(), /^node_/);
  assert.match(newEdgeId(), /^edge_/);
});

test("falls back to getRandomValues outside secure contexts", (t) => {
  const original = globalThis.crypto.randomUUID;
  t.after(() => {
    Object.defineProperty(globalThis.crypto, "randomUUID", { value: original, configurable: true });
  });
  Object.defineProperty(globalThis.crypto, "randomUUID", { value: undefined, configurable: true });
  assert.match(randomId(), UUID);
});
