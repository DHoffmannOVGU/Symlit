import assert from "node:assert/strict";
import test from "node:test";
import { findFreeSpot } from "./free-spot";

const size = { width: 200, height: 100 };

test("an empty spot is used as is", () => {
  assert.deepEqual(findFreeSpot({ x: 500, y: 300 }, size, []), { x: 400, y: 250 });
});

test("a new element does not cover one already in the middle", () => {
  const existing = { x: 400, y: 250, width: 200, height: 100 };
  const spot = findFreeSpot({ x: 500, y: 300 }, size, [existing]);
  const overlapsExisting =
    spot.x < existing.x + existing.width && spot.x + size.width > existing.x &&
    spot.y < existing.y + existing.height && spot.y + size.height > existing.y;
  assert.equal(overlapsExisting, false);
  // ...and stays close: the next cell, not far away.
  assert.ok(Math.hypot(spot.x - 400, spot.y - 250) <= 250);
});

test("repeated placements each find their own spot", () => {
  const occupied: Array<{ x: number; y: number; width: number; height: number }> = [];
  for (let i = 0; i < 6; i += 1) {
    const spot = findFreeSpot({ x: 500, y: 300 }, size, occupied);
    assert.ok(!occupied.some((o) => o.x === spot.x && o.y === spot.y));
    occupied.push({ ...spot, ...size });
  }
});
