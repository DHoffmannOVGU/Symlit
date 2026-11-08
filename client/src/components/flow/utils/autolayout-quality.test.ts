import assert from "node:assert/strict";
import test from "node:test";
import { getAutoLayout } from "./autolayout";
import { LAYOUT_SAMPLES } from "./layout-samples";
import { layoutMetrics } from "./layout-metrics";

// Quality floor for Auto Layout on realistic sample diagrams. If a change to
// the layout makes these worse, it should be a deliberate decision.
// Measured 2026-11 (dagre + side-relationship rows); see
// docs/decisions/diagram-editor-state-and-libraries.md for the ELK comparison.
const MAX_CROSSINGS: Record<string, number> = {
  "drone system (tree + side links)": 3,
  "process chain (side to side)": 0,
  "random mix (all handle sides)": 14,
  "tutorial instance": 0,
};

for (const sample of LAYOUT_SAMPLES) {
  test(`auto layout of "${sample.name}" has no overlaps and few crossings`, () => {
    const { nodes } = getAutoLayout(sample.nodes, sample.edges);
    const metrics = layoutMetrics(nodes, sample.edges);
    assert.equal(metrics.overlaps, 0);
    assert.ok(
      metrics.crossings <= MAX_CROSSINGS[sample.name],
      `${metrics.crossings} crossings (allowed ${MAX_CROSSINGS[sample.name]})`,
    );
  });
}

test("side-to-side chains stay in one row", () => {
  const chain = LAYOUT_SAMPLES.find((sample) => sample.name.startsWith("process chain"))!;
  const { nodes } = getAutoLayout(chain.nodes, chain.edges);
  const rows = new Set(nodes.filter((node) => node.id !== "pick").map((node) => node.position.y));
  assert.equal(rows.size, 1);
});
