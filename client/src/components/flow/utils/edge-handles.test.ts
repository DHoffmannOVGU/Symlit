import assert from "node:assert/strict";
import test from "node:test";
import { normalizeHandleId, OPPOSITE_SIDE } from "./edge-utils";

test("old source/target handle ids map to the side handles", () => {
  assert.equal(normalizeHandleId("source", "top-source"), "top");
  assert.equal(normalizeHandleId("source", "left-source"), "left");
  assert.equal(normalizeHandleId("source", "right"), "right");
  assert.equal(normalizeHandleId("target", "right-target"), "right");
  assert.equal(normalizeHandleId("target", "bottom-target"), "bottom");
  assert.equal(normalizeHandleId("target", "left"), "left");
});

test("missing handle ids use the old defaults: sources leave at the bottom, targets enter at the top", () => {
  assert.equal(normalizeHandleId("source", null), "bottom");
  assert.equal(normalizeHandleId("target", undefined), "top");
  assert.equal(normalizeHandleId("target", "nonsense"), "top");
});

test("new side ids are kept, and each side has an opposite", () => {
  for (const side of ["top", "right", "bottom", "left"] as const) {
    assert.equal(normalizeHandleId("source", side), side);
    assert.equal(OPPOSITE_SIDE[OPPOSITE_SIDE[side]], side);
  }
});
