import type { Edge, Node } from "@xyflow/react";
import { nodeSize } from "./node-size";
import { normalizeHandleId, type HandleSide } from "./edge-utils";

/** Where a handle sits on an element. */
function handlePoint(node: Node, side: HandleSide) {
  const { width, height } = nodeSize(node);
  const { x, y } = node.position;
  return side === "top"
    ? { x: x + width / 2, y }
    : side === "bottom"
      ? { x: x + width / 2, y: y + height }
      : side === "left"
        ? { x, y: y + height / 2 }
        : { x: x + width, y: y + height / 2 };
}

type Point = { x: number; y: number };
const cross = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
const segmentsCross = (p1: Point, p2: Point, q1: Point, q2: Point) =>
  cross(p1, p2, q1) * cross(p1, p2, q2) < 0 && cross(q1, q2, p1) * cross(q1, q2, p2) < 0;

/** Does the handle face the other element (e.g. a bottom handle with the other element below)? */
function faces(side: HandleSide, from: Point, to: Point) {
  return side === "bottom" ? to.y > from.y : side === "top" ? to.y < from.y : side === "right" ? to.x > from.x : to.x < from.x;
}

/**
 * Simple quality measures for a laid-out diagram, treating relationships as
 * straight lines between their handles.
 */
export function layoutMetrics(nodes: Node[], edges: Edge[]) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const boxes = nodes.map((node) => ({ ...node.position, ...nodeSize(node) }));
  let overlaps = 0;
  boxes.forEach((a, i) =>
    boxes.slice(i + 1).forEach((b) => {
      if (a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height) overlaps += 1;
    }),
  );
  const lines = edges
    .filter((edge) => byId.has(edge.source) && byId.has(edge.target))
    .map((edge) => {
      const sourceSide = normalizeHandleId("source", edge.sourceHandle);
      const targetSide = normalizeHandleId("target", edge.targetHandle);
      const from = handlePoint(byId.get(edge.source)!, sourceSide);
      const to = handlePoint(byId.get(edge.target)!, targetSide);
      return { edge, from, to, facing: faces(sourceSide, from, to) && faces(targetSide, to, from) };
    });
  let crossings = 0;
  lines.forEach((a, i) =>
    lines.slice(i + 1).forEach((b) => {
      const shared = [a.edge.source, a.edge.target].some((id) => id === b.edge.source || id === b.edge.target);
      if (!shared && segmentsCross(a.from, a.to, b.from, b.to)) crossings += 1;
    }),
  );
  const length = lines.reduce((sum, line) => sum + Math.hypot(line.to.x - line.from.x, line.to.y - line.from.y), 0);
  const right = Math.max(...boxes.map((b) => b.x + b.width)) - Math.min(...boxes.map((b) => b.x));
  const bottom = Math.max(...boxes.map((b) => b.y + b.height)) - Math.min(...boxes.map((b) => b.y));
  return {
    overlaps,
    crossings,
    edgeLength: Math.round(length),
    area: `${Math.round(right)}×${Math.round(bottom)}`,
    handlesFacing: `${lines.filter((line) => line.facing).length}/${lines.length}`,
  };
}

