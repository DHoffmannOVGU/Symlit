import { useCallback, useEffect, useRef, useState } from "react";
import { EdgeLabelRenderer, useReactFlow } from "@xyflow/react";
import {
  clamp,
  getAnchorPoint,
  type EdgeAnchor,
  type NodeRect,
} from "../utils/edge-utils";

export const StraightEdgeDragHandle = ({
  edgeId,
  selected,
  sourceRect,
  targetRect,
  sourceAnchor,
  targetAnchor,
  midX,
  midY,
  pathType,
  onDraggingChange,
}: {
  edgeId: string;
  selected: boolean;
  sourceRect: NodeRect | null;
  targetRect: NodeRect | null;
  sourceAnchor: EdgeAnchor;
  targetAnchor: EdgeAnchor;
  midX: number;
  midY: number;
  pathType?: string;
  onDraggingChange?: (dragging: boolean) => void;
}) => {
  const { screenToFlowPosition, setEdges } = useReactFlow();
  const [dragging, setDragging] = useState(false);
  const dragState = useRef<{
    startPoint: { x: number; y: number };
    sourceOffset: number;
    targetOffset: number;
  } | null>(null);

  const isStraight = pathType === "straight";
  const sourceSide = sourceAnchor.side;
  const targetSide = targetAnchor.side;
  const isVerticalSides =
    (sourceSide === "top" || sourceSide === "bottom") &&
    (targetSide === "top" || targetSide === "bottom");
  const isHorizontalSides =
    (sourceSide === "left" || sourceSide === "right") &&
    (targetSide === "left" || targetSide === "right");

  const anchoredSource = sourceRect
    ? getAnchorPoint(sourceRect, sourceAnchor)
    : null;
  const anchoredTarget = targetRect
    ? getAnchorPoint(targetRect, targetAnchor)
    : null;

  const dx =
    anchoredSource && anchoredTarget ? anchoredTarget.x - anchoredSource.x : 0;
  const dy =
    anchoredSource && anchoredTarget ? anchoredTarget.y - anchoredSource.y : 0;

  const isVertical = isVerticalSides;
  const isHorizontal = isHorizontalSides;

  const updateOffsets = useCallback(
    (sourceOffset: number, targetOffset: number) => {
      setEdges((eds) =>
        eds.map((edge) =>
          edge.id === edgeId
            ? {
                ...edge,
                data: {
                  ...(edge.data || {}),
                  sourceAnchor: { ...sourceAnchor, offset: sourceOffset },
                  targetAnchor: { ...targetAnchor, offset: targetOffset },
                },
              }
            : edge,
        ),
      );
    },
    [edgeId, setEdges, sourceAnchor, targetAnchor],
  );

  useEffect(() => {
    if (!dragging) return;

    const handleMove = (event: PointerEvent) => {
      if (!dragState.current || !sourceRect || !targetRect) return;
      const currentPoint = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      const deltaX = currentPoint.x - dragState.current.startPoint.x;
      const deltaY = currentPoint.y - dragState.current.startPoint.y;

      if (isVertical) {
        const sourceWidth = sourceRect.width || 1;
        const targetWidth = targetRect.width || 1;
        updateOffsets(
          clamp(dragState.current.sourceOffset + deltaX / sourceWidth),
          clamp(dragState.current.targetOffset + deltaX / targetWidth),
        );
      } else if (isHorizontal) {
        const sourceHeight = sourceRect.height || 1;
        const targetHeight = targetRect.height || 1;
        updateOffsets(
          clamp(dragState.current.sourceOffset + deltaY / sourceHeight),
          clamp(dragState.current.targetOffset + deltaY / targetHeight),
        );
      }
    };

    const handleUp = () => {
      setDragging(false);
      dragState.current = null;
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [
    dragging,
    isHorizontal,
    isVertical,
    screenToFlowPosition,
    sourceRect,
    targetRect,
    updateOffsets,
  ]);

  useEffect(() => {
    onDraggingChange?.(dragging);
  }, [dragging, onDraggingChange]);

  if (
    !selected ||
    !isStraight ||
    !sourceRect ||
    !targetRect ||
    (!isVertical && !isHorizontal)
  ) {
    return null;
  }

  const cursor = isVertical ? "ew-resize" : "ns-resize";
  const angle =
    anchoredSource && anchoredTarget ? (Math.atan2(dy, dx) * 180) / Math.PI : 0;
  const rotation = ` rotate(${angle}deg)`;

  return (
    <EdgeLabelRenderer>
      <div
        className="nodrag nopan edge-drag-handle"
        style={{
          transform: `translate(-50%, -50%) translate(${midX}px,${midY}px)${rotation}`,
          cursor,
        }}
        onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
          dragState.current = {
            startPoint: screenToFlowPosition({
              x: event.clientX,
              y: event.clientY,
            }),
            sourceOffset: sourceAnchor.offset,
            targetOffset: targetAnchor.offset,
          };
          setDragging(true);
        }}
      />
    </EdgeLabelRenderer>
  );
};
