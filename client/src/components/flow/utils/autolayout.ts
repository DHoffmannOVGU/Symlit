// src/diagram/layout/autoLayout.ts
import type { Node, Edge } from "@xyflow/react";
import { layoutFromMap } from "entitree-flex";

export const NODE_WIDTH = 200;
export const NODE_HEIGHT = 100;

type Id = string;

export function getLayoutedElementsEntitree<
  TNode extends Node,
  TEdge extends Edge,
>(nodes: TNode[], edges: TEdge[]) {
  const { roots, children } = buildHierarchy(nodes, edges);
  const nodeIds = new Set(nodes.map((n) => n.id));
  const horizontalGroups = getHorizontalGroups(nodeIds, edges);

  const VROOT = "__VROOT__";

  const treeMap: Record<string, { id: string; children: string[] }> = {};
  for (const n of nodes) {
    treeMap[n.id] = { id: n.id, children: children.get(n.id) ?? [] };
  }
  treeMap[VROOT] = { id: VROOT, children: roots };

  const laidOutResult = layoutFromMap(VROOT, treeMap, {
    orientation: "vertical",
    nodeWidth: NODE_WIDTH,
    nodeHeight: NODE_HEIGHT,
  });

  const laidOut = (laidOutResult as any).nodes as {
    id: string;
    x: number;
    y: number;
  }[];
  const layoutMap = new Map(laidOut.map((n) => [n.id, n]));

  // GUARANTEED spacing effect:
  const SCALE_X = 6;
  const SCALE_Y = 6;

  const positioned = new Map<string, { x: number; y: number }>();
  for (const n of nodes) {
    const p = layoutMap.get(n.id);
    if (!p) continue;
    positioned.set(n.id, {
      x: p.x * SCALE_X - NODE_WIDTH / 2,
      y: p.y * SCALE_Y - NODE_HEIGHT / 2,
    });
  }

  for (const group of horizontalGroups) {
    if (group.length < 2) continue;
    const groupPositions = group
      .map((id) => positioned.get(id))
      .filter((pos): pos is { x: number; y: number } => !!pos);
    if (groupPositions.length < 2) continue;
    const avgY =
      groupPositions.reduce((sum, pos) => sum + pos.y, 0) /
      groupPositions.length;
    for (const id of group) {
      const existing = positioned.get(id);
      if (existing) {
        positioned.set(id, { ...existing, y: avgY });
      }
    }
  }

  const newNodes = nodes.map((n) => {
    const position = positioned.get(n.id);
    if (!position) return n;
    return {
      ...n,
      position,
    };
  });

  return { nodes: newNodes, edges };
}

function buildHierarchy(nodes: Node[], edges: Edge[]) {
  const nodeIds = new Set(nodes.map((n) => n.id));

  const vEdges = edges
    .filter(isVerticalEdge)
    .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target));

  const parent = new Map<Id, Id>();
  const children = new Map<Id, Id[]>();

  for (const e of vEdges) {
    if (!parent.has(e.target)) parent.set(e.target, e.source);
  }

  for (const n of nodes) children.set(n.id, []);
  for (const [child, p] of Array.from(parent.entries())) {
    children.get(p)!.push(child);
  }

  const roots = nodes.map((n) => n.id).filter((id) => !parent.has(id));
  return { roots, parent, children, vEdges };
}

function getHorizontalGroups(nodeIds: Set<Id>, edges: Edge[]) {
  const parent = new Map<Id, Id>();
  const find = (id: Id): Id => {
    const current = parent.get(id) ?? id;
    if (current === id) return current;
    const root = find(current);
    parent.set(id, root);
    return root;
  };
  const union = (a: Id, b: Id) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  for (const id of Array.from(nodeIds)) parent.set(id, id);

  edges
    .filter(isHorizontalEdge)
    .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
    .forEach((e) => union(e.source, e.target));

  const groups = new Map<Id, Id[]>();
  for (const id of Array.from(nodeIds)) {
    const root = find(id);
    const group = groups.get(root) ?? [];
    group.push(id);
    groups.set(root, group);
  }

  return Array.from(groups.values());
}

function isHorizontalEdge(e: Edge) {
  const sh = e.sourceHandle ?? "";
  const th = e.targetHandle ?? "";
  const sH = sh.includes("left") || sh.includes("right");
  const tH = th.includes("left") || th.includes("right");
  const data = e.data as
    | { sourceAnchor?: { side?: string }; targetAnchor?: { side?: string } }
    | undefined;
  const sSide = data?.sourceAnchor?.side;
  const tSide = data?.targetAnchor?.side;
  const sAnchor = sSide === "left" || sSide === "right";
  const tAnchor = tSide === "left" || tSide === "right";
  return (sH || sAnchor) && (tH || tAnchor);
}

function isVerticalEdge(e: Edge) {
  return !isHorizontalEdge(e);
}
