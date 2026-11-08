import {
  MarkerType,
  Position,
  getBezierPath,
  getStraightPath,
  getSmoothStepPath,
  type EdgeMarker,
} from "@xyflow/react";
import {
  magicRelationTypeCatalog,
  type MagicRelationType,
} from "@shared/metamodel-setup";
import type { AnchorSide, CustomEdgeData, EdgeAnchor } from "../types";

export type { AnchorSide, CustomEdgeData, EdgeAnchor };

export interface NodeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const DEFAULT_TARGET_ARROW: CustomEdgeData["targetArrow"] = "arrowclosed";
export const DEFAULT_EDGE_STROKE_COLOR = "hsl(var(--muted-foreground))";

export const RELATION_MARKER_IDS = {
  aggregation: "aggregation-diamond-marker",
  composition: "composition-diamond-marker",
  generalization: "generalization-triangle-marker",
} as const;

export type RelationMarker =
  | "none"
  | "aggregation"
  | "composition"
  | "generalization";

const relationSemanticsById = new Map(
  magicRelationTypeCatalog.map((relation) => [relation.id, relation.semantics]),
);

export const getRelationSemantics = (edgeType?: string) =>
  relationSemanticsById.get(edgeType as MagicRelationType) ??
  relationSemanticsById.get("association")!;

export const getEdgeSemanticDefaults = (
  edgeType?: string,
): Pick<CustomEdgeData, "lineStyle" | "sourceArrow" | "targetArrow"> => {
  const semantics = getRelationSemantics(edgeType);
  return {
    lineStyle: semantics.lineStyle,
    sourceArrow: "none",
    targetArrow:
      semantics.targetMarker === "arrow"
        ? "arrow"
        : semantics.targetMarker === "arrowclosed"
          ? "arrowclosed"
          : "none",
  };
};

export const getEdgeMarkerOverrides = (edgeType?: string) => {
  const semantics = getRelationSemantics(edgeType);
  const markerUrl = (marker: RelationMarker) =>
    marker === "none"
      ? undefined
      : `url(#${RELATION_MARKER_IDS[marker]})`;
  return {
    markerStart: markerUrl(semantics.sourceMarker),
    markerEnd: markerUrl(semantics.targetMarker === "generalization" ? "generalization" : "none"),
  };
};

export const anchorSides: AnchorSide[] = ["top", "right", "bottom", "left"];

export const clamp = (value: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value));

export const sideToPosition = (side: AnchorSide) => {
  switch (side) {
    case "top":
      return Position.Top;
    case "right":
      return Position.Right;
    case "bottom":
      return Position.Bottom;
    default:
      return Position.Left;
  }
};

export const positionToAnchor = (position?: Position): EdgeAnchor => {
  switch (position) {
    case Position.Top:
      return { side: "top", offset: 0.5 };
    case Position.Right:
      return { side: "right", offset: 0.5 };
    case Position.Left:
      return { side: "left", offset: 0.5 };
    case Position.Bottom:
    default:
      return { side: "bottom", offset: 0.5 };
  }
};

/** The parts of a React Flow node (or internal node) needed to know its rectangle. */
type NodeRectSource = {
  measured?: { width?: number | null; height?: number | null };
  width?: number | null;
  height?: number | null;
  internals?: { bounds?: { width?: number | null; height?: number | null }; positionAbsolute?: { x: number; y: number } };
  positionAbsolute?: { x: number; y: number };
  position?: { x: number; y: number };
};

export const getNodeRect = (node: NodeRectSource | null | undefined): NodeRect | null => {
  if (!node) return null;
  const width =
    node.measured?.width ?? node.width ?? node.internals?.bounds?.width ?? 0;
  const height =
    node.measured?.height ?? node.height ?? node.internals?.bounds?.height ?? 0;
  if (!width || !height) return null;
  const position =
    node.internals?.positionAbsolute ??
    node.positionAbsolute ??
    node.position ??
    { x: 0, y: 0 };
  return {
    x: position.x,
    y: position.y,
    width,
    height,
  };
};

export const getAnchorPoint = (rect: NodeRect, anchor: EdgeAnchor) => {
  const offset = clamp(anchor.offset);
  switch (anchor.side) {
    case "top":
      return { x: rect.x + rect.width * offset, y: rect.y };
    case "bottom":
      return { x: rect.x + rect.width * offset, y: rect.y + rect.height };
    case "left":
      return { x: rect.x, y: rect.y + rect.height * offset };
    default:
      return { x: rect.x + rect.width, y: rect.y + rect.height * offset };
  }
};

export const getSnapPoint = (rect: NodeRect, side: AnchorSide) =>
  getAnchorPoint(rect, { side, offset: 0.5 });

export const getSnapSide = (
  rect: NodeRect,
  point: { x: number; y: number },
  threshold: number,
): AnchorSide | null => {
  let bestSide: AnchorSide | null = null;
  let bestDistance = Infinity;

  for (const side of anchorSides) {
    const snapPoint = getSnapPoint(rect, side);
    const distance = Math.hypot(point.x - snapPoint.x, point.y - snapPoint.y);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestSide = side;
    }
  }

  return bestDistance <= threshold ? bestSide : null;
};

export { HANDLE_SIDES, normalizeHandleId, type HandleSide } from "@shared/relationships";
import type { HandleSide } from "@shared/relationships";

/** The side facing a given side, e.g. a new element dropped to the right connects on its left. */
export const OPPOSITE_SIDE: Record<HandleSide, HandleSide> = {
  top: "bottom",
  right: "left",
  bottom: "top",
  left: "right",
};

export const getHandleIdForSide = (
  _kind: "source" | "target",
  side: AnchorSide,
): HandleSide => side;


export const getClosestAnchor = (
  rect: NodeRect,
  point: { x: number; y: number },
): EdgeAnchor => {
  const leftDist = Math.abs(point.x - rect.x);
  const rightDist = Math.abs(point.x - (rect.x + rect.width));
  const topDist = Math.abs(point.y - rect.y);
  const bottomDist = Math.abs(point.y - (rect.y + rect.height));
  const minDist = Math.min(leftDist, rightDist, topDist, bottomDist);

  if (minDist === leftDist) {
    return { side: "left", offset: clamp((point.y - rect.y) / rect.height) };
  }
  if (minDist === rightDist) {
    return { side: "right", offset: clamp((point.y - rect.y) / rect.height) };
  }
  if (minDist === topDist) {
    return { side: "top", offset: clamp((point.x - rect.x) / rect.width) };
  }
  return { side: "bottom", offset: clamp((point.x - rect.x) / rect.width) };
};

export const getLineStyle = (style?: "solid" | "dashed" | "dotted") => {
  switch (style) {
    case "dashed":
      return "5,5";
    case "dotted":
      return "2,2";
    default:
      return undefined;
  }
};

export const getPathFunction = (type?: string) => {
  switch (type) {
    case "straight":
      return getStraightPath;
    case "smoothstep":
      return getSmoothStepPath;
    default:
      return getBezierPath;
  }
};

export const getPathFunctionForAnchors = (
  pathType: CustomEdgeData["pathType"] | undefined,
  sourceAnchor: EdgeAnchor,
  targetAnchor: EdgeAnchor,
) => {
  if (pathType === "straight") {
    const sourceSide = sourceAnchor.side;
    const targetSide = targetAnchor.side;
    const isVerticalOpposite =
      (sourceSide === "top" && targetSide === "bottom") ||
      (sourceSide === "bottom" && targetSide === "top");
    const isHorizontalOpposite =
      (sourceSide === "left" && targetSide === "right") ||
      (sourceSide === "right" && targetSide === "left");

    if (!isVerticalOpposite && !isHorizontalOpposite) {
      return getSmoothStepPath;
    }
  }

  return getPathFunction(pathType);
};

const getArrowMarker = (
  arrow: CustomEdgeData["sourceArrow"] | CustomEdgeData["targetArrow"] | undefined,
  color?: string,
  strokeWidth?: number,
): EdgeMarker | undefined => {
  if (!arrow || arrow === "none") return undefined;
  const type = arrow === "arrow" ? MarkerType.Arrow : MarkerType.ArrowClosed;
  return { type, color, strokeWidth };
};

export const normalizeEdgeData = (data?: CustomEdgeData): CustomEdgeData => ({
  ...data,
  edgeType: data?.edgeType ?? "association",
  pathType: data?.pathType ?? "straight",
  ...getEdgeSemanticDefaults(data?.edgeType),
  lineStyle:
    data?.lineStyle ??
    getEdgeSemanticDefaults(data?.edgeType).lineStyle,
  sourceArrow: data?.sourceArrow ?? "none",
  targetArrow:
    data?.targetArrow ??
    getEdgeSemanticDefaults(data?.edgeType).targetArrow ??
    DEFAULT_TARGET_ARROW,
});

export const getEdgeMarkers = (data?: CustomEdgeData) => {
  const normalized = normalizeEdgeData(data);
  const markerColor = normalized.strokeColor ?? DEFAULT_EDGE_STROKE_COLOR;
  const markerStrokeWidth = normalized.strokeWidth ?? 2;
  const relationMarkers = getEdgeMarkerOverrides(normalized.edgeType);
  return {
    data: normalized,
    markerStart:
      relationMarkers.markerStart ??
      getArrowMarker(normalized.sourceArrow, markerColor, markerStrokeWidth),
    markerEnd:
      relationMarkers.markerEnd ??
      getArrowMarker(normalized.targetArrow, markerColor, markerStrokeWidth),
  };
};
