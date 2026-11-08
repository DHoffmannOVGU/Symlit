import dagre from "@dagrejs/dagre";
import type { Edge, Node } from "@xyflow/react";
import { NODE_HEIGHT, NODE_WIDTH } from "./node-size";

type Direction = "TB" | "LR";

export function layoutSelectedNodesWithDagre(
  nodes: Node[],
  edges: Edge[],
  selectedNodeIds: string[],
  direction: Direction,
) {
  if (selectedNodeIds.length === 0) return nodes;

  const selectedSet = new Set(selectedNodeIds);
  const selectedNodes = nodes.filter((node) => selectedSet.has(node.id));
  if (selectedNodes.length === 0) return nodes;

  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({
    rankdir: direction,
    ranksep: 120,
    nodesep: 60,
  });

  selectedNodes.forEach((node) => {
    const width = node.width ?? NODE_WIDTH;
    const height = node.height ?? NODE_HEIGHT;
    graph.setNode(node.id, { width, height });
  });

  edges.forEach((edge) => {
    if (!selectedSet.has(edge.source) || !selectedSet.has(edge.target)) return;
    graph.setEdge(edge.source, edge.target);
  });

  dagre.layout(graph);

  let layoutMinX = Number.POSITIVE_INFINITY;
  let layoutMinY = Number.POSITIVE_INFINITY;
  let layoutMaxX = Number.NEGATIVE_INFINITY;
  let layoutMaxY = Number.NEGATIVE_INFINITY;

  selectedNodes.forEach((node) => {
    const pos = graph.node(node.id) as { x: number; y: number } | undefined;
    if (!pos) return;
    const width = node.width ?? NODE_WIDTH;
    const height = node.height ?? NODE_HEIGHT;
    const left = pos.x - width / 2;
    const top = pos.y - height / 2;
    const right = pos.x + width / 2;
    const bottom = pos.y + height / 2;
    layoutMinX = Math.min(layoutMinX, left);
    layoutMinY = Math.min(layoutMinY, top);
    layoutMaxX = Math.max(layoutMaxX, right);
    layoutMaxY = Math.max(layoutMaxY, bottom);
  });

  const selectionMinX = Math.min(
    ...selectedNodes.map((node) => node.position.x),
  );
  const selectionMinY = Math.min(
    ...selectedNodes.map((node) => node.position.y),
  );

  const offsetX =
    Number.isFinite(layoutMinX) ? selectionMinX - layoutMinX : 0;
  const offsetY =
    Number.isFinite(layoutMinY) ? selectionMinY - layoutMinY : 0;

  return nodes.map((node) => {
    if (!selectedSet.has(node.id)) return node;
    const pos = graph.node(node.id) as { x: number; y: number } | undefined;
    if (!pos) return node;
    const width = node.width ?? NODE_WIDTH;
    const height = node.height ?? NODE_HEIGHT;
    return {
      ...node,
      position: {
        x: pos.x - width / 2 + offsetX,
        y: pos.y - height / 2 + offsetY,
      },
    };
  });
}
