import assert from "node:assert/strict";
import test from "node:test";
import { getViewportForBottomPanel } from "./rules-panel-viewport";

test("zooms out while preserving the world-space center in the remaining canvas", () => {
  const width = 1200;
  const height = 900;
  const panelHeight = 450;
  const original = { x: 100, y: -50, zoom: 1.5 };
  const next = getViewportForBottomPanel(original, width, height, panelHeight);
  assert.equal(next.zoom, 0.75);
  assert.deepEqual(
    {
      x: (width / 2 - next.x) / next.zoom,
      y: ((height - panelHeight) / 2 - next.y) / next.zoom,
    },
    {
      x: (width / 2 - original.x) / original.zoom,
      y: (height / 2 - original.y) / original.zoom,
    },
  );
});

test("calculates from the original viewport and respects minimum zoom", () => {
  const original = { x: 0, y: 0, zoom: 0.5 };
  assert.equal(getViewportForBottomPanel(original, 1000, 800, 400).zoom, 0.25);
  assert.equal(getViewportForBottomPanel(original, 1000, 800, 760).zoom, 0.1);
});
