import { useEffect, useId, useRef, useState } from "react";
import {
  Position,
  getSmoothStepPath,
  getStraightPath,
  useConnection,
  useStore,
} from "@xyflow/react";
import {
  EDGE_CREATE_MARKER_DELAY_MS,
  EDGE_CREATE_MARKER_MOVE_THRESHOLD_PX,
} from "../utils/edge-create";

export const ConnectionPreviewLine = ({
  fromX,
  fromY,
  toX,
  toY,
}: {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}) => {
  const markerId = useId();
  const { isValid, fromPosition, toPosition, inProgress } = useConnection((state) =>
    state.inProgress
      ? {
          isValid: state.isValid,
          fromPosition: state.fromPosition,
          toPosition: state.toPosition,
          inProgress: state.inProgress,
        }
      : {
          isValid: null,
          fromPosition: null,
          toPosition: null,
          inProgress: false,
        },
  );
  const isVerticalOpposite =
    (fromPosition === Position.Top && toPosition === Position.Bottom) ||
    (fromPosition === Position.Bottom && toPosition === Position.Top);
  const isHorizontalOpposite =
    (fromPosition === Position.Left && toPosition === Position.Right) ||
    (fromPosition === Position.Right && toPosition === Position.Left);
  const useSmoothStep = !isVerticalOpposite && !isHorizontalOpposite;
  const [edgePath] = useSmoothStep
    ? getSmoothStepPath({
        sourceX: fromX,
        sourceY: fromY,
        sourcePosition: fromPosition ?? Position.Bottom,
        targetX: toX,
        targetY: toY,
        targetPosition: toPosition ?? Position.Top,
      })
    : getStraightPath({
        sourceX: fromX,
        sourceY: fromY,
        targetX: toX,
        targetY: toY,
      });
  const strokeColor =
    isValid === true
      ? "hsl(var(--muted-foreground))"
      : "hsl(var(--muted-foreground) / 0.35)";
  const [markerVisible, setMarkerVisible] = useState(false);
  const transform = useStore((state) => state?.transform) ?? [0, 0, 1];
  const screenX = toX * transform[2] + transform[0];
  const screenY = toY * transform[2] + transform[1];
  const elementAtPointer =
    typeof document !== "undefined"
      ? document.elementFromPoint(screenX, screenY)
      : null;
  const isOverNode = !!elementAtPointer?.closest?.(".react-flow__node");
  const showCreateMarker =
    inProgress && isValid !== true && markerVisible && !isOverNode;
  const markerFill = "hsl(var(--background))";
  const markerStroke = "hsl(var(--muted-foreground))";
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!inProgress || isValid === true) {
      setMarkerVisible(false);
      lastPointRef.current = null;
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      return;
    }

    const lastPoint = lastPointRef.current;
    const moved =
      !lastPoint ||
      Math.hypot(toX - lastPoint.x, toY - lastPoint.y) >
        EDGE_CREATE_MARKER_MOVE_THRESHOLD_PX;
    lastPointRef.current = { x: toX, y: toY };

    if (moved) {
      setMarkerVisible(false);
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = window.setTimeout(() => {
        setMarkerVisible(true);
        timeoutRef.current = null;
      }, EDGE_CREATE_MARKER_DELAY_MS);
    }
  }, [inProgress, isValid, toX, toY]);

  return (
    <g>
      <defs>
        <marker
          id={markerId}
          viewBox="0 0 10 10"
          refX="10"
          refY="5"
          markerWidth="8"
          markerHeight="8"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M 0 0 L 10 5 L 0 10 Z" fill={strokeColor} />
        </marker>
      </defs>
      <path
        d={edgePath}
        fill="none"
        stroke={strokeColor}
        strokeWidth={2}
        markerEnd={`url(#${markerId})`}
      />
      {showCreateMarker && (
        <g
          transform={`translate(${(() => {
            const dx = toX - fromX;
            const dy = toY - fromY;
            const length = Math.hypot(dx, dy) || 1;
            const offset = 30;
            const offsetX = (dx / length) * offset;
            const offsetY = (dy / length) * offset;
            return `${toX + offsetX}, ${toY + offsetY}`;
          })()})`}
          pointerEvents="none"
        >
          <g
            style={{
              transform: `scale(${markerVisible ? 1 : 0.7})`,
              transformOrigin: "center",
              opacity: markerVisible ? 1 : 0,
              transition: "transform 180ms ease, opacity 180ms ease",
            }}
          >
          <circle
            r={10}
            fill={markerFill}
            stroke={markerStroke}
            strokeWidth={1.5}
            opacity={0.9}
          />
          <path
            d="M -4 0 L 4 0 M 0 -4 L 0 4"
            stroke={markerStroke}
            strokeWidth={1.5}
            strokeLinecap="round"
          />
          </g>
        </g>
      )}
    </g>
  );
};
