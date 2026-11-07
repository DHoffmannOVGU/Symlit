import { useCallback, useEffect, useState } from "react";
import { EdgeLabelRenderer, useReactFlow, useStore } from "@xyflow/react";
import {
  anchorSides,
  getAnchorPoint,
  getClosestAnchor,
  getHandleIdForSide,
  getSnapPoint,
  getSnapSide,
  type AnchorSide,
  type EdgeAnchor,
  type NodeRect,
} from "../utils/edge-utils";

export const AnchorHandles = ({
  edgeId,
  selected,
  sourceRect,
  targetRect,
  sourceAnchor,
  targetAnchor,
  onDraggingChange,
}: {
  edgeId: string;
  selected: boolean;
  sourceRect: NodeRect | null;
  targetRect: NodeRect | null;
  sourceAnchor: EdgeAnchor;
  targetAnchor: EdgeAnchor;
  onDraggingChange?: (dragging: boolean) => void;
}) => {
  const { screenToFlowPosition, setEdges } = useReactFlow();
  const transform = useStore((state) => state?.transform) ?? [0, 0, 1];
  const [dragging, setDragging] = useState<"source" | "target" | null>(null);
  const [activeSnapSide, setActiveSnapSide] = useState<AnchorSide | null>(null);

  const updateAnchor = useCallback(
    (
      key: "sourceAnchor" | "targetAnchor",
      anchor: EdgeAnchor,
      handleKey: "sourceHandle" | "targetHandle",
      handleId?: string,
    ) => {
      setEdges((eds) =>
        eds.map((edge) =>
          edge.id === edgeId
            ? {
                ...edge,
                data: { ...(edge.data || {}), [key]: anchor },
                [handleKey]: handleId,
              }
            : edge,
        ),
      );
    },
    [edgeId, setEdges],
  );

  useEffect(() => {
    if (!dragging) return;

    const handleMove = (event: PointerEvent) => {
      const rect = dragging === "source" ? sourceRect : targetRect;
      if (!rect) return;
      const flowPoint = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      const threshold = 16 / (transform[2] || 1);
      const snapSide = getSnapSide(rect, flowPoint, threshold);
      const isSource = dragging === "source";
      const anchor: EdgeAnchor = snapSide
        ? { side: snapSide, offset: 0.5 }
        : getClosestAnchor(rect, flowPoint);

      updateAnchor(
        isSource ? "sourceAnchor" : "targetAnchor",
        anchor,
        isSource ? "sourceHandle" : "targetHandle",
        snapSide
          ? getHandleIdForSide(isSource ? "source" : "target", snapSide)
          : undefined,
      );
      setActiveSnapSide(snapSide);
    };

    const handleUp = () => {
      setDragging(null);
      setActiveSnapSide(null);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [
    dragging,
    screenToFlowPosition,
    sourceRect,
    targetRect,
    transform,
    updateAnchor,
  ]);

  useEffect(() => {
    onDraggingChange?.(dragging !== null);
  }, [dragging, onDraggingChange]);

  if (!selected || !sourceRect || !targetRect) return null;

  const sourcePoint = getAnchorPoint(sourceRect, sourceAnchor);
  const targetPoint = getAnchorPoint(targetRect, targetAnchor);
  const activeRect = dragging === "source" ? sourceRect : targetRect;

  return (
    <EdgeLabelRenderer>
      {dragging && activeRect && (
        <>
          {anchorSides.map((side) => {
            const snapPoint = getSnapPoint(activeRect, side);
            const isActive = activeSnapSide === side;
            return (
              <div
                key={side}
                className={`nodrag nopan edge-anchor-snap-point${isActive ? " is-active" : ""}`}
                style={{
                  transform: `translate(-50%, -50%) translate(${snapPoint.x}px,${snapPoint.y}px)`,
                }}
              />
            );
          })}
        </>
      )}
      <div
        className="nodrag nopan edge-anchor-handle"
        style={{
          transform: `translate(-50%, -50%) translate(${sourcePoint.x}px,${sourcePoint.y}px)`,
        }}
        onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setDragging("source");
        }}
      />
      <div
        className="nodrag nopan edge-anchor-handle"
        style={{
          transform: `translate(-50%, -50%) translate(${targetPoint.x}px,${targetPoint.y}px)`,
        }}
        onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setDragging("target");
        }}
      />
    </EdgeLabelRenderer>
  );
};
