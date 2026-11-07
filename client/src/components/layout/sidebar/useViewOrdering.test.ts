import assert from "node:assert/strict";
import test from "node:test";
import { applyPreferredOrder } from "./useViewOrdering";

test("orders items by the stored order and keeps unknown items at the end", () => {
  const items = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
  const ordered = applyPreferredOrder(items, (item) => item.id, ["c", "a"]);
  assert.deepEqual(ordered.map((item) => item.id), ["c", "a", "b", "d"]);
  assert.deepEqual(items.map((item) => item.id), ["a", "b", "c", "d"], "input is not mutated");
  assert.deepEqual(applyPreferredOrder(items, (item) => item.id).map((item) => item.id), ["a", "b", "c", "d"]);
});
