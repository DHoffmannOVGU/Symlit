import type { CustomEdgeData } from "../edges/CustomEdges";

export const METAMODEL_NODE_TYPES = new Set([
  "partdef",
  "actiondef",
  "concerndef",
  "agentdef",
  "requirementdef",
  "eventdef",
  "capabilitydef",
]);

export type ReferencedFlowNode = {
  id: string;
  projectId?: number;
  type?: string | null;
  data?: Record<string, unknown> | null;
};

export type ReferencedFlowEdge = {
  id: string;
  source: string;
  target: string;
  edgeType?: string | null;
  type?: string | null;
  data?: Record<string, unknown> | null;
};

export type ReferencedPartDef = {
  id: string;
  label: string;
  type?: string;
  data: Record<string, unknown>;
};

export type ResolvedReferencedFlow = {
  partDefs: Array<{ id: string; label: string }>;
  partDefNodes: Array<{
    id: string;
    type: string;
    position: { x: number; y: number };
    data: Record<string, unknown>;
  }>;
  partDefEdges: Array<{
    id: string;
    edgeType: CustomEdgeData["edgeType"];
    flowType?: CustomEdgeData["flowType"];
    label?: string;
    multiplicity?: string;
    sourceTypeId: string;
    targetTypeId: string;
  }>;
};

const isSupportedMetamodelNode = (
  node: ReferencedFlowNode,
): node is ReferencedFlowNode & { type: string } =>
  typeof node.type === "string" && METAMODEL_NODE_TYPES.has(node.type);

const getEdgeType = (value: unknown): CustomEdgeData["edgeType"] =>
  typeof value === "string" && value.length > 0 ? (value as CustomEdgeData["edgeType"]) : "association";

/**
 * Converts one referenced metamodel flow into the canonical IDs consumed by
 * the instance palette and validation. IDs include the owning project so two
 * referenced projects can safely use the same local node ID.
 */
export function resolveReferencedMetamodelFlow({
  metamodelId,
  viewId,
  nodes,
  edges,
}: {
  metamodelId: number;
  viewId: number;
  nodes: ReferencedFlowNode[];
  edges: ReferencedFlowEdge[];
}): ResolvedReferencedFlow {
  const canonicalIdByRawId = new Map<string, string>();
  const nodeProjectIdByRawId = new Map<string, number>();

  const mmPartDefs = nodes
    .filter(isSupportedMetamodelNode)
    .map((node): ReferencedPartDef | null => {
      const ownerProjectId =
        typeof node.projectId === "number" ? node.projectId : metamodelId;
      const id = `mm:${ownerProjectId}:${node.id}`;
      canonicalIdByRawId.set(node.id, id);
      nodeProjectIdByRawId.set(node.id, ownerProjectId);

      const rawData = node.data ?? {};
      const rawTypeId =
        typeof rawData.typeId === "string" ? rawData.typeId : undefined;
      const mappedTypeId = rawTypeId
        ? `mm:${ownerProjectId}:${rawTypeId}`
        : undefined;
      const label = typeof rawData.label === "string" ? rawData.label : undefined;
      if (!label) return null;

      return {
        id,
        label,
        type: node.type,
        data: {
          ...rawData,
          _referenceTypeId: id,
          _originTypeId: node.id,
          _originProjectId: ownerProjectId,
          _loadedFromMetamodelId: metamodelId,
          ...(mappedTypeId ? { typeId: mappedTypeId } : {}),
        },
      };
    })
    .filter((node): node is ReferencedPartDef => node !== null);

  const partDefEdges = edges
    .filter(
      (edge) =>
        canonicalIdByRawId.has(edge.source) &&
        canonicalIdByRawId.has(edge.target),
    )
    .map((edge) => {
      const data = edge.data;
      const edgeType = getEdgeType(edge.edgeType || edge.type || data?.edgeType);
      const sourceProjectId = nodeProjectIdByRawId.get(edge.source) ?? metamodelId;
      const targetProjectId = nodeProjectIdByRawId.get(edge.target) ?? metamodelId;

      return {
        id: `mm:${metamodelId}:${viewId}:${edge.id}`,
        edgeType,
        flowType: data?.flowType as CustomEdgeData["flowType"] | undefined,
        label: typeof data?.label === "string" ? data.label : undefined,
        multiplicity: typeof data?.multiplicity === "string" ? data.multiplicity : undefined,
        sourceTypeId: `mm:${sourceProjectId}:${edge.source}`,
        targetTypeId: `mm:${targetProjectId}:${edge.target}`,
      };
    });

  return {
    partDefs: mmPartDefs.map(({ id, label }) => ({ id, label })),
    partDefNodes: mmPartDefs.map(({ id, type, data }) => ({
      id,
      type: type || "partdef",
      position: { x: 0, y: 0 },
      data,
    })),
    partDefEdges,
  };
}

/**
 * Traverses nested project references without repeatedly loading the same
 * project. Missing projects are returned as warnings so callers can surface
 * a partial reference instead of silently treating it as a valid empty graph.
 */
export function collectReferencedMetamodelIds(
  initialIds: number[],
  projectsById: Map<number, { referencedMetamodels?: unknown }>,
) {
  const loadedIds: number[] = [];
  const missingIds: number[] = [];
  const queued = new Set<number>();
  const queue = initialIds.filter((id) => Number.isInteger(id) && id > 0);

  while (queue.length > 0) {
    const id = queue.shift();
    if (id === undefined || queued.has(id)) continue;
    queued.add(id);
    loadedIds.push(id);

    const project = projectsById.get(id);
    if (!project) {
      missingIds.push(id);
      continue;
    }

    const nestedIds = Array.isArray(project.referencedMetamodels)
      ? project.referencedMetamodels
      : [];
    nestedIds.forEach((nestedId) => {
      if (
        typeof nestedId === "number" &&
        Number.isInteger(nestedId) &&
        nestedId > 0 &&
        !queued.has(nestedId)
      ) {
        queue.push(nestedId);
      }
    });
  }

  return { loadedIds, missingIds };
}