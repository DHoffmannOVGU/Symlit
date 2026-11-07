import dagre from "@dagrejs/dagre";
import type { Edge, Node } from "@xyflow/react";

/** Fallback size for elements React Flow has not measured yet. */
export const NODE_WIDTH = 200;
export const NODE_HEIGHT = 100;

/** Gap between elements in a row, and between rows. */
export const LAYOUT_GAP_X = 80;
export const LAYOUT_GAP_Y = 100;

type Id = string;

/** Rendered size of an element: measured by React Flow, else explicit, else a default. */
export function nodeSize(node: Node): { width: number; height: number } {
  const style = (node.style ?? {}) as { width?: unknown; height?: unknown };
  const width =
    node.measured?.width ?? node.width ?? (typeof style.width === "number" ? style.width : undefined);
  const height =
    node.measured?.height ?? node.height ?? (typeof style.height === "number" ? style.height : undefined);
  return { width: width ?? NODE_WIDTH, height: height ?? NODE_HEIGHT };
}

/**
 * Lays out a whole diagram.
 *
 * Relationships drawn between the sides of two elements (left/right
 * handles) keep those elements in one row; all other relationships form a
 * top-to-bottom hierarchy. Rows are laid out with dagre using the elements'
 * real sizes, and members of a row keep their current left-to-right order.
 */
export function getAutoLayout<TNode extends Node, TEdge extends Edge>(
  nodes: TNode[],
  edges: TEdge[],
) {
  if (nodes.length === 0) return { nodes, edges };
  const nodeIds = new Set(nodes.map((node) => node.id));
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const relevant = edges.filter(
    (edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target) && edge.source !== edge.target,
  );

  // Rows: elements joined by side-to-side relationships.
  const rows = getHorizontalGroups(nodeIds, relevant).map((members) =>
    members
      .map((id) => byId.get(id)!)
      .sort((a, b) => a.position.x - b.position.x || a.position.y - b.position.y),
  );
  const rowOf = new Map<Id, number>();
  rows.forEach((row, index) => row.forEach((node) => rowOf.set(node.id, index)));
  const rowSize = rows.map((row) => ({
    width:
      row.reduce((sum, node) => sum + nodeSize(node).width, 0) + LAYOUT_GAP_X * (row.length - 1),
    height: Math.max(...row.map((node) => nodeSize(node).height)),
  }));

  const graph = new dagre.graphlib.Graph({ multigraph: false });
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({ rankdir: "TB", nodesep: LAYOUT_GAP_X, ranksep: LAYOUT_GAP_Y, marginx: 0, marginy: 0 });
  rows.forEach((_, index) => graph.setNode(String(index), rowSize[index]));
  for (const edge of relevant) {
    if (isHorizontalEdge(edge)) continue;
    const from = rowOf.get(edge.source)!;
    const to = rowOf.get(edge.target)!;
    if (from !== to) graph.setEdge(String(from), String(to));
  }
  dagre.layout(graph);

  // Keep the diagram where it was: align the new layout's top-left corner
  // with the old one so the view does not jump far away.
  const originX = Math.min(...nodes.map((node) => node.position.x));
  const originY = Math.min(...nodes.map((node) => node.position.y));

  const positions = new Map<Id, { x: number; y: number }>();
  rows.forEach((row, index) => {
    const center = graph.node(String(index)) as { x: number; y: number };
    const { width, height } = rowSize[index];
    let x = center.x - width / 2;
    for (const node of row) {
      const size = nodeSize(node);
      positions.set(node.id, { x, y: center.y - height / 2 + (height - size.height) / 2 });
      x += size.width + LAYOUT_GAP_X;
    }
  });
  const minX = Math.min(...Array.from(positions.values()).map((p) => p.x));
  const minY = Math.min(...Array.from(positions.values()).map((p) => p.y));

  const laidOut = nodes.map((node) => {
    const position = positions.get(node.id);
    if (!position) return node;
    return {
      ...node,
      position: {
        x: Math.round(position.x - minX + originX),
        y: Math.round(position.y - minY + originY),
      },
    };
  });
  return { nodes: laidOut, edges };
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
  for (const id of Array.from(nodeIds)) parent.set(id, id);
  edges.filter(isHorizontalEdge).forEach((edge) => {
    const a = find(edge.source);
    const b = find(edge.target);
    if (a !== b) parent.set(a, b);
  });
  const groups = new Map<Id, Id[]>();
  for (const id of Array.from(nodeIds)) {
    const root = find(id);
    groups.set(root, [...(groups.get(root) ?? []), id]);
  }
  return Array.from(groups.values());
}

/** A relationship drawn between the left/right sides of two elements. */
export function isHorizontalEdge(edge: Edge) {
  const sourceHandle = edge.sourceHandle ?? "";
  const targetHandle = edge.targetHandle ?? "";
  const data = edge.data as
    | { sourceAnchor?: { side?: string }; targetAnchor?: { side?: string } }
    | undefined;
  const isSide = (handle: string, anchorSide?: string) =>
    handle.includes("left") ||
    handle.includes("right") ||
    anchorSide === "left" ||
    anchorSide === "right";
  return (
    isSide(sourceHandle, data?.sourceAnchor?.side) && isSide(targetHandle, data?.targetAnchor?.side)
  );
}
