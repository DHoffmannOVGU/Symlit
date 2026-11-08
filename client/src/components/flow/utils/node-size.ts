import type { Node } from "@xyflow/react";

/** Fallback size for elements React Flow has not measured yet. */
export const NODE_WIDTH = 200;
export const NODE_HEIGHT = 100;

/** Gap between elements in a row, and between rows. */
export const LAYOUT_GAP_X = 80;
export const LAYOUT_GAP_Y = 100;

/** Rendered size of an element: measured by React Flow, else explicit, else a default. */
export function nodeSize(node: Node): { width: number; height: number } {
  const style = (node.style ?? {}) as { width?: unknown; height?: unknown };
  const width =
    node.measured?.width ?? node.width ?? (typeof style.width === "number" ? style.width : undefined);
  const height =
    node.measured?.height ?? node.height ?? (typeof style.height === "number" ? style.height : undefined);
  return { width: width ?? NODE_WIDTH, height: height ?? NODE_HEIGHT };
}
