import assert from "node:assert/strict";
import test from "node:test";
import type { Edge, Node } from "@xyflow/react";
import { getAutoLayout, LAYOUT_GAP_X, LAYOUT_GAP_Y } from "./autolayout";

const node = (id: string, x = 100, y = 100, width = 300, height = 200): Node => ({
  id,
  position: { x, y },
  data: {},
  measured: { width, height },
});
const side = (source: string, target: string): Edge => ({
  id: `${source}-${target}`,
  source,
  target,
  sourceHandle: "right",
  targetHandle: "left",
});
const down = (source: string, target: string): Edge => ({ id: `${source}-${target}`, source, target });

const boxes = (nodes: Node[]) =>
  nodes.map((n) => ({
    id: n.id,
    left: n.position.x,
    top: n.position.y,
    right: n.position.x + (n.measured?.width ?? 0),
    bottom: n.position.y + (n.measured?.height ?? 0),
  }));
const overlaps = (nodes: Node[]) => {
  const list = boxes(nodes);
  return list.some((a, i) =>
    list.slice(i + 1).some((b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom),
  );
};

test("stacked elements are spread out without overlapping", () => {
  const { nodes } = getAutoLayout([node("a"), node("b"), node("c")], [down("a", "b"), down("a", "c")]);
  assert.equal(overlaps(nodes), false);
});

test("the layout stays compact: gaps match the configured spacing", () => {
  const { nodes } = getAutoLayout([node("root"), node("left"), node("right")], [down("root", "left"), down("root", "right")]);
  const [root, left, right] = ["root", "left", "right"].map((id) => nodes.find((n) => n.id === id)!);
  // Children one row below the parent, separated by the row gap.
  assert.equal(left.position.y - (root.position.y + 200), LAYOUT_GAP_Y);
  assert.equal(left.position.y, right.position.y);
  // Siblings side by side, separated by the column gap (not six times the width).
  assert.equal(Math.abs(right.position.x - left.position.x), 300 + LAYOUT_GAP_X);
});

test("side-to-side relationships keep elements in one row in their current order", () => {
  const { nodes } = getAutoLayout(
    [node("drone", 0, 0), node("battery", 500, 40), node("delivery", 0, 400)],
    [side("drone", "battery"), down("drone", "delivery")],
  );
  const get = (id: string) => nodes.find((n) => n.id === id)!;
  assert.equal(get("drone").position.y, get("battery").position.y, "same row");
  assert.ok(get("drone").position.x < get("battery").position.x, "keeps left-to-right order");
  assert.ok(get("delivery").position.y > get("drone").position.y, "hierarchy goes downwards");
  assert.equal(overlaps(nodes), false);
});

test("the diagram stays where it was and unconnected elements are placed too", () => {
  const { nodes } = getAutoLayout([node("a", 1000, 2000), node("b", 1000, 2000), node("lonely", 1000, 2000)], [down("a", "b")]);
  assert.equal(Math.min(...nodes.map((n) => n.position.x)), 1000);
  assert.equal(Math.min(...nodes.map((n) => n.position.y)), 2000);
  assert.equal(overlaps(nodes), false);
});

test("uses the real element size, and handles empty diagrams and cycles", () => {
  const { nodes } = getAutoLayout([node("big", 0, 0, 600, 400), node("small", 0, 0, 100, 50)], [down("big", "small")]);
  const small = nodes.find((n) => n.id === "small")!;
  assert.equal(small.position.y, 400 + LAYOUT_GAP_Y);
  assert.deepEqual(getAutoLayout([], []).nodes, []);
  const cyclic = getAutoLayout([node("x"), node("y")], [down("x", "y"), down("y", "x")]).nodes;
  assert.equal(overlaps(cyclic), false);
});
