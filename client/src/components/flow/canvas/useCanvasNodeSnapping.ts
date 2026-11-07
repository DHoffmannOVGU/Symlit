import { useCallback, useRef, useState } from "react";
import type {
  DiagramEdge,
  DiagramNode as Node,
} from "../types";

interface UseCanvasNodeSnappingArgs {
  nodes: Node[];
  edges: DiagramEdge[];
  snapNodesEnabled: boolean;
  setNodes: (updater: (current: Node[]) => Node[]) => void;
  takeSnapshot: (nodes: Node[], edges: DiagramEdge[]) => void;
}

interface AlignmentGuides {
  x: number | null;
  y: number | null;
}

const SNAP_THRESHOLD = 6;
const RELEASE_THRESHOLD = 12;

const getNodeSize = (node: Node) => ({
  width: node.measured?.width ?? node.width ?? 0,
  height: node.measured?.height ?? node.height ?? 0,
});

const getNodeCenter = (node: Node) => {
  const size = getNodeSize(node);
  return {
    x: node.position.x + size.width / 2,
    y: node.position.y + size.height / 2,
  };
};

/**
 * Centerline snapping for node drag interactions. Owns the dragging-node id,
 * the alignment guide coordinates, and the React Flow drag handlers used by
 * the canvas.
 */
export function useCanvasNodeSnapping({
  nodes,
  edges,
  snapNodesEnabled,
  setNodes,
  takeSnapshot,
}: UseCanvasNodeSnappingArgs) {
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [alignmentGuides, setAlignmentGuides] = useState<AlignmentGuides>({
    x: null,
    y: null,
  });
  const alignmentLockRef = useRef<AlignmentGuides>({ x: null, y: null });
  const snappedNodePositionsRef = useRef<Map<string, { x: number; y: number }>>(
    new Map(),
  );

  const computeNodeSnapPosition = useCallback(
    (draggedNode: Node) => {
      if (!snapNodesEnabled) {
        setAlignmentGuides({ x: null, y: null });
        snappedNodePositionsRef.current.delete(draggedNode.id);
        return null;
      }

      const draggedSize = getNodeSize(draggedNode);
      const draggedCenter = getNodeCenter(draggedNode);

      let bestX: number | null = null;
      let bestY: number | null = null;
      let bestXDiff = Infinity;
      let bestYDiff = Infinity;

      nodes.forEach((node) => {
        if (node.id === draggedNode.id) return;
        const center = getNodeCenter(node);
        const dx = Math.abs(center.x - draggedCenter.x);
        const dy = Math.abs(center.y - draggedCenter.y);

        if (dx <= SNAP_THRESHOLD && dx < bestXDiff) {
          bestXDiff = dx;
          bestX = center.x;
        }
        if (dy <= SNAP_THRESHOLD && dy < bestYDiff) {
          bestYDiff = dy;
          bestY = center.y;
        }
      });

      const lockedX = alignmentLockRef.current.x;
      const lockedY = alignmentLockRef.current.y;

      if (lockedX !== null) {
        const lockedDiff = Math.abs(lockedX - draggedCenter.x);
        if (lockedDiff <= RELEASE_THRESHOLD) {
          bestX = lockedX;
        } else {
          alignmentLockRef.current.x = null;
        }
      }
      if (lockedY !== null) {
        const lockedDiff = Math.abs(lockedY - draggedCenter.y);
        if (lockedDiff <= RELEASE_THRESHOLD) {
          bestY = lockedY;
        } else {
          alignmentLockRef.current.y = null;
        }
      }

      if (bestX !== null) alignmentLockRef.current.x = bestX;
      if (bestY !== null) alignmentLockRef.current.y = bestY;

      setAlignmentGuides({ x: bestX, y: bestY });

      if (bestX === null && bestY === null) {
        snappedNodePositionsRef.current.delete(draggedNode.id);
        return null;
      }

      const nextPosition = {
        x:
          bestX !== null
            ? bestX - draggedSize.width / 2
            : draggedNode.position.x,
        y:
          bestY !== null
            ? bestY - draggedSize.height / 2
            : draggedNode.position.y,
      };

      snappedNodePositionsRef.current.set(draggedNode.id, nextPosition);
      return nextPosition;
    },
    [nodes, snapNodesEnabled],
  );

  const handleNodeDrag = useCallback(
    (_event: unknown, draggedNode: Node) => {
      const nextPosition = computeNodeSnapPosition(draggedNode);
      if (!nextPosition) return;

      if (
        Math.abs(nextPosition.x - draggedNode.position.x) < 0.1 &&
        Math.abs(nextPosition.y - draggedNode.position.y) < 0.1
      ) {
        return;
      }

      setNodes((current) =>
        current.map((node) =>
          node.id === draggedNode.id
            ? { ...node, position: nextPosition }
            : node,
        ),
      );
    },
    [computeNodeSnapPosition, setNodes],
  );

  const handleNodeDragStart = useCallback(
    (_event: unknown, node: Node) => {
      setDraggingNodeId(node.id);
      takeSnapshot(nodes, edges);
    },
    [edges, nodes, takeSnapshot],
  );

  const handleNodeDragStop = useCallback(
    (_event: unknown, draggedNode: Node) => {
      setDraggingNodeId(null);
      const snappedPosition =
        snappedNodePositionsRef.current.get(draggedNode.id) ??
        computeNodeSnapPosition(draggedNode);

      if (snappedPosition) {
        requestAnimationFrame(() => {
          setNodes((current) =>
            current.map((node) =>
              node.id === draggedNode.id
                ? { ...node, position: snappedPosition }
                : node,
            ),
          );
        });
      }

      alignmentLockRef.current = { x: null, y: null };
      snappedNodePositionsRef.current.delete(draggedNode.id);
      setAlignmentGuides({ x: null, y: null });
    },
    [computeNodeSnapPosition, setNodes],
  );

  return {
    draggingNodeId,
    alignmentGuides,
    handleNodeDrag,
    handleNodeDragStart,
    handleNodeDragStop,
  };
}
