import { matchesTypeStyle, withoutElementStyle } from "@/lib/element-style";
import { currentKindLabel } from "@shared/metamodel-setup";
import type { FlowData } from "@/components/layout/sidebar-parts/types";
import type { InsertFlowEdge, InsertFlowNode } from "@/hooks/use-flow";
import type { ProjectType } from "@shared/schema";
import { isMagicRelationType } from "@shared/metamodel-setup";
import { normalizeHandleId, normalizeRelationship } from "@shared/relationships";
import type { DiagramEdge, DiagramNode } from "../types";
import { getEdgeMarkers, type CustomEdgeData } from "../edges/CustomEdges";

/*
 * Converting diagrams between the stored form (API) and the canvas form
 * (React Flow nodes/edges), and the signature used to detect unsaved changes.
 * Pure functions, tested in diagram-serialization.test.ts.
 */

type SerializableNode = {
  id: string;
  type?: string | null;
  position: { x: number; y: number };
  data?: unknown;
  parentId?: string | null;
};

type SerializableEdge = {
  id: string;
  source: string;
  target: string;
  edgeType?: unknown;
  type?: unknown;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  data?: unknown;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
export const normalizeFlow = (
  nodes: SerializableNode[],
  edges: SerializableEdge[],
  projectType: ProjectType,
) => {
  const defaultType =
    projectType === "metamodel"
      ? "partdef"
      : "part";
  const normalizedNodes = nodes
    .map((node) => {
      const rawData = isRecord(node.data) ? node.data : {};
      // An instance element that matches its type shows the type's style, which
      // the canvas copies onto it after loading. That copy is not an edit, so
      // the style is left out when comparing; matching or not still counts.
      const data =
        (node.type || defaultType) === "part" && matchesTypeStyle(rawData)
          ? { ...withoutElementStyle(rawData), inheritStyle: true }
          : rawData;
      return {
        id: node.id,
        type: node.type || defaultType,
        position: { x: node.position.x, y: node.position.y },
        data: {
          ...data,
          ...(currentKindLabel(data.type, { nodeType: node.type, typeId: data.typeId }) !== undefined
            ? { type: currentKindLabel(data.type, { nodeType: node.type, typeId: data.typeId }) }
            : {}),
        },
        parentId: node.parentId ?? null,
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));

  const normalizedEdges = edges
    .map((edge) => {
      const data = isRecord(edge.data) ? edge.data : {};
      const edgeType = normalizeEdgeType(
        edge.edgeType ?? edge.type ?? data.edgeType,
      );
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        edgeType,
        sourceHandle: normalizeHandleId("source", edge.sourceHandle),
        targetHandle: normalizeHandleId("target", edge.targetHandle),
        data: { ...data, edgeType },
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));

  return JSON.stringify({ nodes: normalizedNodes, edges: normalizedEdges });
};

/** Stored diagram -> canvas: restores sizes, canonical type labels, relationship styles and side handles. */
export function toCanvasGraph(flow: FlowData): { nodes: DiagramNode[]; edges: DiagramEdge[] } {
  const nodes: DiagramNode[] = flow.nodes.map((n) => {
    const nodeData = isRecord(n.data) ? n.data : {};
    const savedStyle = readSavedNodeStyle(nodeData._nodeStyle);
    return {
      id: n.id,
      type: n.type,
      position: n.position as { x: number; y: number },
      data: {
        ...nodeData,
        ...(currentKindLabel(nodeData.type, { nodeType: n.type, typeId: nodeData.typeId }) !== undefined
          ? { type: currentKindLabel(nodeData.type, { nodeType: n.type, typeId: nodeData.typeId }) }
          : {}),
      },
      ...(n.parentId ? { parentId: n.parentId, extent: "parent" as const } : {}),
      // Restore the size an element was resized to (saved as data._nodeStyle).
      ...(savedStyle ? { style: savedStyle } : {}),
    };
  });

  const edges: DiagramEdge[] = flow.edges.map((e) => {
    const edgeData = isRecord(e.data) ? e.data : {};
    const edgeType = normalizeEdgeType(e.edgeType);
    const { data, markerStart, markerEnd } = getEdgeMarkers({ ...edgeData, edgeType });
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: normalizeHandleId("source", e.sourceHandle),
      targetHandle: normalizeHandleId("target", e.targetHandle),
      type: edgeType,
      data,
      markerStart,
      markerEnd,
    };
  });
  return { nodes, edges };
}

/** Canvas -> what the save endpoint takes. Element sizes are kept in data._nodeStyle. */
export function toSavePayload(
  nodes: DiagramNode[],
  edges: DiagramEdge[],
  projectType: ProjectType,
): { nodes: InsertFlowNode[]; edges: InsertFlowEdge[] } {
  return {
    nodes: nodes.map((n) => {
      const nodeStyle = n.style as { width?: number; height?: number } | undefined;
      const shouldSaveStyle = nodeStyle?.width != null || nodeStyle?.height != null;
      return {
        id: n.id,
        type: n.type || (projectType === "metamodel" ? "partdef" : "part"),
        position: n.position,
        data: {
          ...n.data,
          ...(shouldSaveStyle ? { _nodeStyle: { width: nodeStyle!.width, height: nodeStyle!.height } } : {}),
        },
        parentId: n.parentId ?? null,
      };
    }) as InsertFlowNode[],
    // The server stores relationships in this canonical form (known type,
    // side handles, type mirrored in data); see shared/relationships.ts.
    edges: edges.map((e) =>
      normalizeRelationship({
        id: e.id,
        source: e.source,
        target: e.target,
        edgeType: e.type || e.data?.edgeType,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
        data: e.data,
      }),
    ) as InsertFlowEdge[],
  };
}

/** Signature of a diagram's content, for "unsaved changes" (ignores selection and order). */
export const diagramSignature = (
  nodes: SerializableNode[] | DiagramNode[] | InsertFlowNode[],
  edges: SerializableEdge[] | DiagramEdge[] | InsertFlowEdge[],
  projectType: ProjectType,
) => normalizeFlow(nodes as SerializableNode[], edges as SerializableEdge[], projectType);

const normalizeEdgeType = (
  value: unknown,
): CustomEdgeData["edgeType"] =>
  isMagicRelationType(value)
    ? value
    : "association";

const readSavedNodeStyle = (
  value: unknown,
): { width?: number; height?: number } | undefined => {
  if (!isRecord(value)) return undefined;
  const width = typeof value.width === "number" ? value.width : undefined;
  const height = typeof value.height === "number" ? value.height : undefined;
  return width === undefined && height === undefined
    ? undefined
    : { width, height };
};
