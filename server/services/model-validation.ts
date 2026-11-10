import { and, eq, ne } from "drizzle-orm";
import { db } from "../db";
import { storage } from "../storage";
import { edges, nodes, views, type Project, type FlowNodeWithPosition, type FlowEdge } from "@shared/schema";
import {
  buildParentMap,
  buildParentMapFromNodes,
  mergeParentMaps,
} from "@shared/metamodel-inheritance";
import {
  validateInstanceModel,
  type ValidationContext,
  type ValidationIssue,
  type ValidationTypeNode,
  type ValidationRelationEdge,
} from "@shared/model-validation";

// Mirrors client/src/components/flow/hooks/useMetamodelParts.ts's node-type
// filter and default-type fallback for "instance" projects with no
// referenced metamodel.
export const METAMODEL_NODE_TYPES = new Set([
  "partdef",
  "actiondef",
  "concerndef",
  "agentdef",
  "requirementdef",
  "eventdef",
  "capabilitydef",
]);

const DEFAULT_INSTANCE_TYPE_NODES: ValidationTypeNode[] = [
  { id: "__default_part__", label: "Object" },
  { id: "__default_action__", label: "Behavior" },
  { id: "__default_concern__", label: "Concern" },
  { id: "__default_agent__", label: "Performer" },
  { id: "__default_requirement__", label: "Need" },
  { id: "__default_event__", label: "Event" },
  { id: "__default_capability__", label: "Capability" },
];

function nodeTypeNodesAndParents(nodes: FlowNodeWithPosition[]) {
  const partDefNodes = nodes.filter((n) => METAMODEL_NODE_TYPES.has(n.type));
  const typeNodes: ValidationTypeNode[] = [];
  const typeParents: { id: string; data?: { typeId?: string | null } }[] = [];
  partDefNodes.forEach((n) => {
    const data = (n.data ?? {}) as Record<string, unknown>;
    const label = typeof data.label === "string" ? data.label : undefined;
    if (label) typeNodes.push({ id: n.id, label });
    typeParents.push({ id: n.id, data: { typeId: data.typeId as string | undefined } });
  });
  return { partDefNodes, typeNodes, typeParents };
}

function localRelationEdges(
  edges: FlowEdge[],
  partDefNodeIds: Set<string>,
): ValidationRelationEdge[] {
  return edges
    .filter((e) => partDefNodeIds.has(e.source) && partDefNodeIds.has(e.target))
    .map((e) => ({
      sourceTypeId: e.source,
      targetTypeId: e.target,
      edgeType: e.edgeType || "association",
      label: ((e.data ?? {}) as Record<string, unknown>).label as string | undefined,
      multiplicity: ((e.data ?? {}) as Record<string, unknown>).multiplicity as string | undefined,
      sourceMultiplicity: ((e.data ?? {}) as Record<string, unknown>).sourceMultiplicity as string | undefined,
    }));
}

// Resolves the metamodel graph (available types + allowed relations,
// including "generalization" edges used for inheritance) that a given
// instance project's models are validated against. Ports the fan-out in
// useMetamodelParts.ts: fall back to partdef-typed nodes local to the
// project's own views when no metamodel is referenced, otherwise walk the
// referencedMetamodels graph (BFS over nested references) and load each
// referenced project's views via storage.getFlow.
//
// `project.id` may be null to resolve what a consumer of the referenced
// metamodels sees, without any local types (used for metamodel patterns).
export async function resolveMetamodel(
  project: Pick<Project, "projectType" | "referencedMetamodels"> & { id: number | null },
): Promise<{
  typeNodes: ValidationTypeNode[];
  relationEdges: ValidationRelationEdge[];
  typeParents: { id: string; data?: { typeId?: string | null } }[];
}> {
  const referencedMetamodelIds = Array.isArray(project.referencedMetamodels)
    ? project.referencedMetamodels
    : [];

  const ownViews = project.id === null ? [] : await storage.getViews(project.id);
  const ownNodesById = new Map<string, FlowNodeWithPosition>();
  const ownEdges: FlowEdge[] = [];
  for (const view of ownViews) {
    const flow = await storage.getFlow(view.id);
    flow.nodes.forEach((n) => ownNodesById.set(n.id, n));
    ownEdges.push(...flow.edges);
  }
  const { partDefNodes, typeNodes, typeParents } = nodeTypeNodesAndParents(
    Array.from(ownNodesById.values()),
  );
  const partDefNodeIds = new Set(partDefNodes.map((n) => n.id));
  const relationEdges = localRelationEdges(ownEdges, partDefNodeIds);

  if (referencedMetamodelIds.length === 0) {
    const withDefaults =
      project.projectType === "instance"
        ? [...DEFAULT_INSTANCE_TYPE_NODES, ...typeNodes]
        : typeNodes;
    return { typeNodes: withDefaults, relationEdges, typeParents };
  }

  const metamodelIdsToLoad = new Set<number>();
  const queue = [...referencedMetamodelIds];
  while (queue.length > 0) {
    const nextId = queue.shift();
    if (!nextId || metamodelIdsToLoad.has(nextId)) continue;
    metamodelIdsToLoad.add(nextId);
    const mmProject = await storage.getProject(nextId);
    if (!mmProject) continue;
    const nested = Array.isArray(mmProject.referencedMetamodels)
      ? mmProject.referencedMetamodels
      : [];
    nested.forEach((id) => {
      if (!metamodelIdsToLoad.has(id)) queue.push(id);
    });
  }

  const allTypeNodes = [...typeNodes];
  const allTypeParents = [...typeParents];
  const allRelationEdges = [...relationEdges];

  for (const mmId of Array.from(metamodelIdsToLoad)) {
    const mmViews = await storage.getViews(mmId);
    for (const view of mmViews) {
      const flow = await storage.getFlow(view.id);
      const canonicalIdByRawId = new Map<string, string>();
      const nodeProjectIdByRawId = new Map<string, number>();

      const mmPartDefs = flow.nodes
        .filter((n) => METAMODEL_NODE_TYPES.has(n.type))
        .map((n) => {
          const ownerProjectId =
            typeof n.projectId === "number" ? n.projectId : mmId;
          const id = `mm:${ownerProjectId}:${n.id}`;
          canonicalIdByRawId.set(n.id, id);
          nodeProjectIdByRawId.set(n.id, ownerProjectId);
          const rawData = (n.data ?? {}) as Record<string, unknown>;
          const rawTypeId = rawData.typeId as string | undefined;
          const mappedTypeId = rawTypeId ? `mm:${ownerProjectId}:${rawTypeId}` : undefined;
          const label = rawData.label as string | undefined;
          if (!label) return null;
          return { id, label, typeId: mappedTypeId };
        })
        .filter((def) => def !== null);

      allTypeNodes.push(...mmPartDefs.map((d) => ({ id: d.id, label: d.label })));
      allTypeParents.push(
        ...mmPartDefs.map((d) => ({ id: d.id, data: { typeId: d.typeId } })),
      );

      const mmRelationEdges = flow.edges
        .filter((e) => canonicalIdByRawId.has(e.source) && canonicalIdByRawId.has(e.target))
        .map((e) => {
          const sourceProjectId = nodeProjectIdByRawId.get(e.source) ?? mmId;
          const targetProjectId = nodeProjectIdByRawId.get(e.target) ?? mmId;
          return {
            sourceTypeId: `mm:${sourceProjectId}:${e.source}`,
            targetTypeId: `mm:${targetProjectId}:${e.target}`,
            edgeType: e.edgeType || "association",
            label: ((e.data ?? {}) as Record<string, unknown>).label as string | undefined,
            multiplicity: ((e.data ?? {}) as Record<string, unknown>).multiplicity as string | undefined,
            sourceMultiplicity: ((e.data ?? {}) as Record<string, unknown>).sourceMultiplicity as string | undefined,
          };
        });
      allRelationEdges.push(...mmRelationEdges);
    }
  }

  return { typeNodes: allTypeNodes, relationEdges: allRelationEdges, typeParents: allTypeParents };
}

export async function validateView(viewId: number): Promise<ValidationIssue[] | null> {
  const view = await storage.getView(viewId);
  if (!view) return null;
  const project = await storage.getProject(view.projectId);
  if (!project || project.projectType !== "instance") return [];

  const model = await storage.getFlow(viewId);
  const { typeNodes, relationEdges, typeParents } = await resolveMetamodel(project);
  const parentMap = mergeParentMaps(
    buildParentMap(
      relationEdges.map((e) => ({
        edgeType: e.edgeType || "association",
        sourceTypeId: e.sourceTypeId || "",
        targetTypeId: e.targetTypeId || "",
        label: e.label,
      })),
    ),
    buildParentMapFromNodes(typeParents),
  );
  const nonGeneralizationEdges = relationEdges.filter((e) => e.edgeType !== "generalization");

  return validateInstanceModel(
    {
      nodes: model.nodes.map((n) => ({
        id: n.id,
        type: n.type,
        data: (n.data ?? {}) as { label?: string; typeId?: string },
      })),
      edges: model.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        edgeType: e.edgeType,
        data: (e.data ?? {}) as { label?: string },
      })),
    },
    { typeNodes, relationEdges: nonGeneralizationEdges, parentMap },
    await getValidationContext(view.projectId, viewId),
  );
}

/**
 * The elements and relationships of a project's other diagrams, reduced to
 * what validation reads. Two queries, whatever the number of diagrams.
 */
export async function getValidationContext(projectId: number, viewId: number): Promise<ValidationContext> {
  const [elementRows, relationshipRows] = await Promise.all([
    db
      .select({ id: nodes.id, type: nodes.type, data: nodes.data })
      .from(nodes)
      .where(and(eq(nodes.projectId, projectId), eq(nodes.type, "part"))),
    db
      .select({ id: edges.id, source: edges.source, target: edges.target, edgeType: edges.edgeType, data: edges.data })
      .from(edges)
      .innerJoin(views, eq(edges.viewId, views.id))
      .where(and(eq(views.projectId, projectId), eq(views.viewType, "view"), ne(views.id, viewId))),
  ]);
  const text = (data: unknown, field: string) => {
    const value = data && typeof data === "object" ? (data as Record<string, unknown>)[field] : undefined;
    return typeof value === "string" ? value : undefined;
  };
  return {
    nodes: elementRows.map((row) => ({
      id: row.id,
      type: row.type,
      data: { label: text(row.data, "label"), typeId: text(row.data, "typeId") },
    })),
    edges: relationshipRows.map((row) => ({
      id: row.id,
      source: row.source,
      target: row.target,
      edgeType: row.edgeType,
      data: { label: text(row.data, "label") },
    })),
  };
}
