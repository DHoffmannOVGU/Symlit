import { useCallback, useMemo, useState } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  type EdgeProps,
  useStore,
} from "@xyflow/react";
import * as Icons from "lucide-react";
import { dispatchDiagramEvent } from "@/lib/diagram-events";
import { AnchorHandles } from "./EdgeHandles";
import { StraightEdgeDragHandle } from "./StraightEdgeDragHandle";
import {
  getAnchorPoint,
  getLineStyle,
  getNodeRect,
  getPathFunctionForAnchors,
  getEdgeMarkerOverrides,
  positionToAnchor,
  sideToPosition,
  DEFAULT_EDGE_STROKE_COLOR,
  type CustomEdgeData,
} from "../utils/edge-utils";
import { EdgeRelationConfirmationControl } from "./EdgeRelationConfirmation";

export type EdgeAction =
  | "edit"
  | "delete"
  | "toggle-type"
  | "reverse-direction";

export interface CustomEdgeConfig {
  /** Lucide icon name used for the "switch edge type" toolbar button. */
  toolbarIconName: keyof typeof Icons;
  /** Optional override for `markerStart` (e.g. aggregation diamond). */
  markerStartOverride?: string;
  /** When set, applied as inline `zIndex` on the label/toolbar containers. */
  labelZIndex?: number;
}

export const dispatchEdgeAction = (edgeId: string, action: EdgeAction) => {
  dispatchDiagramEvent("diagram-edge-action-request", { edgeId, action });
};

interface BaseCustomEdgeProps extends EdgeProps {
  config: CustomEdgeConfig;
}

export const BaseCustomEdge = ({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  data,
  selected,
  markerStart,
  markerEnd,
  type,
  config,
}: BaseCustomEdgeProps) => {
  const [isManipulating, setIsManipulating] = useState(false);
  // React Flow's EdgeTypes registry erases each custom edge's data generic.
  // Diagram state is typed as DiagramEdge, so this is the renderer boundary.
  const edgeData = data as CustomEdgeData | undefined;
  const nodeLookup = useStore((state) => state?.nodeLookup) || new Map();
  const sourceRect = getNodeRect(nodeLookup.get(source));
  const targetRect = getNodeRect(nodeLookup.get(target));

  const fallbackSourceAnchor = useMemo(
    () => positionToAnchor(sourcePosition),
    [sourcePosition],
  );
  const fallbackTargetAnchor = useMemo(
    () => positionToAnchor(targetPosition),
    [targetPosition],
  );

  const resolvedSourceAnchor = edgeData?.sourceAnchor || fallbackSourceAnchor;
  const resolvedTargetAnchor = edgeData?.targetAnchor || fallbackTargetAnchor;

  const anchoredSource = sourceRect
    ? getAnchorPoint(sourceRect, resolvedSourceAnchor)
    : { x: sourceX, y: sourceY };
  const anchoredTarget = targetRect
    ? getAnchorPoint(targetRect, resolvedTargetAnchor)
    : { x: targetX, y: targetY };

  const anchoredSourcePosition = sideToPosition(resolvedSourceAnchor.side);
  const anchoredTargetPosition = sideToPosition(resolvedTargetAnchor.side);

  const pathFn = getPathFunctionForAnchors(
    edgeData?.pathType,
    resolvedSourceAnchor,
    resolvedTargetAnchor,
  );
  const [edgePath, labelX, labelY] = pathFn({
    sourceX: anchoredSource.x,
    sourceY: anchoredSource.y,
    sourcePosition: anchoredSourcePosition,
    targetX: anchoredTarget.x,
    targetY: anchoredTarget.y,
    targetPosition: anchoredTargetPosition,
  });

  const finalStrokeWidth =
    edgeData?.ruleStrokeWidth ?? edgeData?.strokeWidth ?? (selected ? 3 : 2);
  const finalStrokeColor =
    edgeData?.ruleStrokeColor ||
    edgeData?.strokeColor ||
    (selected ? "hsl(var(--primary))" : DEFAULT_EDGE_STROKE_COLOR);
  const finalLineStyle = edgeData?.ruleLineStyle ?? edgeData?.lineStyle;
  const finalAnimated = edgeData?.ruleAnimated ?? edgeData?.animated;
  const showToolbar = selected && !isManipulating;
  const isMostlyHorizontal =
    Math.abs(anchoredTarget.x - anchoredSource.x) >=
    Math.abs(anchoredTarget.y - anchoredSource.y);
  const toolbarPosition = isMostlyHorizontal
    ? {
        x: labelX,
        y: labelY - (edgeData?.pathType === "straight" ? 34 : 22),
      }
    : {
        x: labelX + (edgeData?.pathType === "straight" ? 58 : 46),
        y: labelY,
      };

  const handleEdgeAction = useCallback(
    (action: EdgeAction) => dispatchEdgeAction(id, action),
    [id],
  );

  const labelOverlayStyle = config.labelZIndex
    ? { zIndex: config.labelZIndex }
    : undefined;

  const ToolbarIcon = Icons[config.toolbarIconName] as Icons.LucideIcon;
  const relationMarkers = getEdgeMarkerOverrides(edgeData?.edgeType ?? type);
  const resolvedMarkerStart =
    config.markerStartOverride ?? relationMarkers.markerStart ?? markerStart;
  const resolvedMarkerEnd = relationMarkers.markerEnd ?? markerEnd;

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={resolvedMarkerEnd}
        markerStart={resolvedMarkerStart}
        style={{
          ...style,
          strokeWidth: finalStrokeWidth,
          stroke: finalStrokeColor,
          strokeDasharray: getLineStyle(finalLineStyle),
        }}
        interactionWidth={20}
      />
      {finalAnimated && (
        <path
          d={edgePath}
          fill="none"
          stroke={finalStrokeColor}
          strokeWidth={finalStrokeWidth}
          strokeDasharray="5,5"
          className="animate-edge-flow"
        />
      )}
      {(edgeData?.label || edgeData?.multiplicity) && (
        <EdgeLabelRenderer>
          {(() => {
            const labelOffsetY =
              edgeData?.pathType === "straight" && selected ? -16 : 0;
            return (
              <div
                style={{
                  position: "absolute",
                  transform: `translate(-50%, -50%) translate(${labelX}px,${labelY + labelOffsetY}px)`,
                  pointerEvents: "all",
                  ...labelOverlayStyle,
                }}
                className="nodrag nopan px-2 py-1 bg-background border border-border rounded text-xs shadow-sm"
              >
                {edgeData?.label && (
                  <span className="font-medium">{edgeData.label}</span>
                )}
                {edgeData?.label && edgeData?.multiplicity && (
                  <span className="mx-1">·</span>
                )}
                {edgeData?.multiplicity && (
                  <span className="text-muted-foreground">
                    [{edgeData.multiplicity}]
                  </span>
                )}
                {edgeData?.label && (
                  <div className="absolute bottom-full left-full mb-1 -ml-2">
                    <EdgeRelationConfirmationControl edgeId={id} />
                  </div>
                )}
              </div>
            );
          })()}
        </EdgeLabelRenderer>
      )}
      {!edgeData?.label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: "all",
              ...labelOverlayStyle,
            }}
          >
            <EdgeRelationConfirmationControl edgeId={id} />
          </div>
        </EdgeLabelRenderer>
      )}
      {showToolbar && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${toolbarPosition.x}px,${toolbarPosition.y}px)`,
              pointerEvents: "all",
              ...labelOverlayStyle,
            }}
            className="nodrag nopan flex items-center gap-1 rounded-lg border border-slate-200 bg-white/96 p-1 shadow-lg backdrop-blur"
          >
            <button
              type="button"
              className="inline-flex h-5 w-5 items-center justify-center rounded-md text-slate-700 transition-colors hover:bg-slate-100"
              title="Switch edge type"
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                handleEdgeAction("toggle-type");
              }}
            >
              <ToolbarIcon className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className="inline-flex h-5 w-5 items-center justify-center rounded-md text-slate-700 transition-colors hover:bg-slate-100"
              title="Reverse edge direction"
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                handleEdgeAction("reverse-direction");
              }}
            >
              <Icons.RefreshCw className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className="inline-flex h-5 w-5 items-center justify-center rounded-md text-slate-700 transition-colors hover:bg-slate-100"
              title="Edit edge"
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                handleEdgeAction("edit");
              }}
            >
              <Icons.Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className="inline-flex h-5 w-5 items-center justify-center rounded-md text-rose-600 transition-colors hover:bg-rose-50"
              title="Delete edge"
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                handleEdgeAction("delete");
              }}
            >
              <Icons.Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </EdgeLabelRenderer>
      )}
      <StraightEdgeDragHandle
        edgeId={id}
        selected={!!selected}
        sourceRect={sourceRect}
        targetRect={targetRect}
        sourceAnchor={resolvedSourceAnchor}
        targetAnchor={resolvedTargetAnchor}
        midX={labelX}
        midY={labelY}
        pathType={edgeData?.pathType}
        onDraggingChange={setIsManipulating}
      />
      <AnchorHandles
        edgeId={id}
        selected={!!selected}
        sourceRect={sourceRect}
        targetRect={targetRect}
        sourceAnchor={resolvedSourceAnchor}
        targetAnchor={resolvedTargetAnchor}
        onDraggingChange={setIsManipulating}
      />
    </>
  );
};
