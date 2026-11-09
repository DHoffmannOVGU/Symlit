import assert from "node:assert/strict";
import test from "node:test";
import { chooseFit } from "./fit-text";

const options = { maxSize: 14, minSize: 10, lineHeight: 1.5 };

test("text that fits keeps the largest size", () => {
  assert.deepEqual(chooseFit(() => true, 60, options), { fontSize: 14, clampLines: null });
});

test("longer text shrinks until it fits", () => {
  assert.deepEqual(chooseFit((size) => size <= 12, 60, options), { fontSize: 12, clampLines: null });
});

test("text that does not fit even at the smallest size is cut after the whole lines that fit", () => {
  // 60 px box, 10 px font at line height 1.5 = 15 px lines: 4 lines.
  assert.deepEqual(chooseFit(() => false, 60, options), { fontSize: 10, clampLines: 4 });
  assert.deepEqual(chooseFit(() => false, 5, options), { fontSize: 10, clampLines: 1 });
});
