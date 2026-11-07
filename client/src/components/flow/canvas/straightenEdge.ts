import type { Edge, Node } from "@xyflow/react";
import {
  clamp,
  getAnchorPoint,
  getHandleIdForSide,
  type EdgeAnchor,
} from "../utils/edge-utils";
import type { CustomEdgeData } from "../edges/CustomEdges";

export interface StraightenedEdgePatch {
  data: CustomEdgeData;
  sourceHandle: string;
  targetHandle: string;
}

const getRect = (node: Node) => {
  const width =
    (node as { measured?: { width?: number } }).measured?.width ??
    (node as { width?: number }).width ??
    0;
  const height =
    (node as { measured?: { height?: number } }).measured?.height ??
    (node as { height?: number }).height ??
    0;
  return { x: node.position.x, y: node.position.y, width, height };
};

const getCenter = (rect: ReturnType<typeof getRect>) => ({
  x: rect.x + rect.width / 2,
  y: rect.y + rect.height / 2,
});

/**
 * Compute the anchor/handle changes needed to straighten a straight-path edge
 * so its endpoints share an axis. Returns null when the edge or its endpoints
 * are not eligible for straightening.
 */
export function computeStraightenedEdge(
  selectedEdge: Edge,
  nodes: Node[],
): StraightenedEdgePatch | null {
  const edgeData = selectedEdge.data as CustomEdgeData | undefined;
  if (edgeData?.pathType !== "straight") return null;

  const sourceNode = nodes.find((node) => node.id === selectedEdge.source);
  const targetNode = nodes.find((node) => node.id === selectedEdge.target);
  if (!sourceNode || !targetNode) return null;

  const sourceRect = getRect(sourceNode);
  const targetRect = getRect(targetNode);
  if (
    !sourceRect.width ||
    !sourceRect.height ||
    !targetRect.width ||
    !targetRect.height
  ) {
    return null;
  }

  const sourceCenter = getCenter(sourceRect);
  const targetCenter = getCenter(targetRect);
  const dx = Math.abs(sourceCenter.x - targetCenter.x);
  const dy = Math.abs(sourceCenter.y - targetCenter.y);

  let sourceAnchor: EdgeAnchor;
  let targetAnchor: EdgeAnchor;

  const fallbackSourceAnchor: EdgeAnchor =
    dx >= dy
      ? {
          side: sourceCenter.x <= targetCenter.x ? "right" : "left",
          offset: 0.5,
        }
      : {
          side: sourceCenter.y <= targetCenter.y ? "bottom" : "top",
          offset: 0.5,
        };
  const fallbackTargetAnchor: EdgeAnchor =
    dx >= dy
      ? {
          side: fallbackSourceAnchor.side === "right" ? "left" : "right",
          offset: 0.5,
        }
      : {
          side: fallbackSourceAnchor.side === "bottom" ? "top" : "bottom",
          offset: 0.5,
        };

  const currentSourceAnchor = edgeData.sourceAnchor ?? fallbackSourceAnchor;
  const currentTargetAnchor = edgeData.targetAnchor ?? fallbackTargetAnchor;
  const currentSourcePoint = getAnchorPoint(sourceRect, currentSourceAnchor);
  const currentTargetPoint = getAnchorPoint(targetRect, currentTargetAnchor);

  if (dx >= dy) {
    const sharedY =
      currentSourcePoint.x <= currentTargetPoint.x
        ? currentSourcePoint.y
        : currentTargetPoint.y;
    const sourceSide: EdgeAnchor["side"] =
      sourceCenter.x <= targetCenter.x ? "right" : "left";
    const targetSide: EdgeAnchor["side"] =
      sourceSide === "right" ? "left" : "right";
    sourceAnchor = {
      side: sourceSide,
      offset: clamp((sharedY - sourceRect.y) / sourceRect.height),
    };
    targetAnchor = {
      side: targetSide,
      offset: clamp((sharedY - targetRect.y) / targetRect.height),
    };
  } else {
    const sharedX =
      currentSourcePoint.y <= currentTargetPoint.y
        ? currentSourcePoint.x
        : currentTargetPoint.x;
    const sourceSide: EdgeAnchor["side"] =
      sourceCenter.y <= targetCenter.y ? "bottom" : "top";
    const targetSide: EdgeAnchor["side"] =
      sourceSide === "bottom" ? "top" : "bottom";
    sourceAnchor = {
      side: sourceSide,
      offset: clamp((sharedX - sourceRect.x) / sourceRect.width),
    };
    targetAnchor = {
      side: targetSide,
      offset: clamp((sharedX - targetRect.x) / targetRect.width),
    };
  }

  const sourceHandle = getHandleIdForSide("source", sourceAnchor.side);
  const targetHandle = getHandleIdForSide("target", targetAnchor.side);
  if (!sourceHandle || !targetHandle) return null;

  return {
    data: {
      ...edgeData,
      pathType: "straight",
      sourceAnchor,
      targetAnchor,
    },
    sourceHandle,
    targetHandle,
  };
}
