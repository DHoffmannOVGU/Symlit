import { createHash } from "node:crypto";
import { withoutCalculatedValues } from "@shared/related-formula";
import { normalizeRelationship } from "@shared/relationships";
import { db } from "../db";
import {
  edges,
  nodes,
  nodeViews,
  projects,
  views,
  type FlowEdge,
  type FlowNodeWithPosition,
} from "@shared/schema";
import type {
  FlowEdgeInput,
  SyncFlowNodeInput,
} from "@shared/flow-inputs";
import {
  flowEdgeSchema,
  flowNodeInputSchema,
  flowResponseSchema,
  flowSyncInputSchema,
} from "@shared/routes";
import { and, eq, inArray, ne, notExists, sql } from "drizzle-orm";

/**
 * Validate flow identity and geometry before any records are written or
 * exposed to the canvas. Route parsing provides the same protection for HTTP
 * callers, but this guard also covers seed data and direct service callers.
 */
export function validateFlowRecords(
  flowNodes: SyncFlowNodeInput[],
  flowEdges: FlowEdgeInput[],
) {
  const result = flowSyncInputSchema.safeParse({
    nodes: flowNodes,
    edges: flowEdges,
  });
  if (!result.success) throw result.error;
}

export async function getFlow(
  viewId: number,
): Promise<{ nodes: FlowNodeWithPosition[]; edges: FlowEdge[] }> {
  const flowNodes = await db
    .select({
      id: nodes.id,
      projectId: nodes.projectId,
      type: nodes.type,
      data: nodes.data,
      createdAt: nodes.createdAt,
      position: nodeViews.position,
      parentId: nodeViews.parentId,
    })
    .from(nodeViews)
    .innerJoin(nodes, eq(nodeViews.nodeId, nodes.id))
    .where(eq(nodeViews.viewId, viewId));

  const flowEdges = await db
    .select()
    .from(edges)
    .where(eq(edges.viewId, viewId));

  const result = flowResponseSchema.safeParse({
    nodes: flowNodes,
    edges: flowEdges,
  });
  if (!result.success) throw result.error;

  return {
    nodes: flowNodes as FlowNodeWithPosition[],
    edges: flowEdges,
  };
}

/**
 * A fingerprint of everything a diagram shows: its elements' data (shared
 * with other diagrams), their placement here and its relationships. A save
 * names the revision it was based on, so a diagram that changed in between
 * (in another tab, or through an element edited in another diagram) is not
 * overwritten unnoticed.
 */
export function flowRevision(flow: { nodes: FlowNodeWithPosition[]; edges: FlowEdge[] }): string {
  const byId = <T extends { id: string }>(items: T[]) =>
    [...items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const content = {
    nodes: byId(flow.nodes).map((node) => [
      node.id,
      node.type,
      // Calculated values follow from the rest and from other elements: not a change of this diagram.
      canonical(withoutCalculatedValues(node.data)),
      canonical(node.position),
      node.parentId ?? null,
    ]),
    edges: byId(flow.edges).map((edge) => [
      edge.id,
      edge.source,
      edge.target,
      edge.edgeType,
      edge.sourceHandle ?? null,
      edge.targetHandle ?? null,
      canonical(edge.data ?? null),
    ]),
  };
  return createHash("sha1").update(JSON.stringify(content)).digest("hex").slice(0, 16);
}

/** Object keys in a fixed order, so equal values always serialise the same. */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonical((value as Record<string, unknown>)[key])]),
  );
}

/** A relationship id of the save already belongs to a relationship in another diagram. */
export class RelationshipIdTakenError extends Error {
  readonly status = 409;
  constructor(readonly ids: string[]) {
    super(
      ids.length === 1
        ? "A relationship in this diagram has the same id as one in another diagram. Remove it and draw it again."
        : `${ids.length} relationships in this diagram have the same ids as relationships in another diagram. Remove them and draw them again.`,
    );
  }
}

/** The diagram changed since the revision a save was based on. */
export class FlowConflictError extends Error {
  readonly status = 409;
  constructor() {
    super("This diagram was changed somewhere else since you opened it.");
  }
}

/** The revision of a diagram as it is stored now; null for a damaged one. */
export async function currentRevision(viewId: number): Promise<string | null> {
  try {
    return flowRevision(await getFlow(viewId));
  } catch {
    // A damaged diagram has no revision; saving a repaired copy must work.
    return null;
  }
}

export type FlowRecoveryIssue = {
  type: "node" | "edge";
  id: string;
  index: number;
  field: string;
  message: string;
};

const appendSchemaIssues = (
  issues: FlowRecoveryIssue[],
  type: FlowRecoveryIssue["type"],
  id: string,
  index: number,
  result: { success: false; error: { issues: Array<{ path: (string | number)[]; message: string }> } },
) => {
  for (const issue of result.error.issues) {
    issues.push({
      type,
      id,
      index,
      field: issue.path.length > 0 ? issue.path.join(".") : "record",
      message: issue.message,
    });
  }
};

/**
 * Read the saved records without hydrating them into React Flow. This is the
 * recovery-only counterpart to getFlow: malformed geometry and endpoints are
 * returned as inspectable records instead of being rejected by the response
 * schema.
 */
export async function getFlowRecovery(viewId: number) {
  const [view] = await db.select().from(views).where(eq(views.id, viewId));
  if (!view) return null;

  const flowNodes = await db
    .select({
      id: nodes.id,
      type: nodes.type,
      data: nodes.data,
      position: nodeViews.position,
      parentId: nodeViews.parentId,
    })
    .from(nodeViews)
    .innerJoin(nodes, eq(nodeViews.nodeId, nodes.id))
    .where(eq(nodeViews.viewId, viewId));

  const flowEdges = await db
    .select({
      id: edges.id,
      source: edges.source,
      target: edges.target,
      edgeType: edges.edgeType,
      sourceHandle: edges.sourceHandle,
      targetHandle: edges.targetHandle,
      data: edges.data,
    })
    .from(edges)
    .where(eq(edges.viewId, viewId));

  const issues: FlowRecoveryIssue[] = [];
  flowNodes.forEach((node, index) => {
    const result = flowNodeInputSchema.safeParse(node);
    if (!result.success) {
      appendSchemaIssues(issues, "node", node.id, index, result);
    }
  });

  const nodeIds = new Set(flowNodes.map((node) => node.id));
  const edgeIds = new Set<string>();
  flowEdges.forEach((edge, index) => {
    const result = flowEdgeSchema.safeParse(edge);
    if (!result.success) {
      appendSchemaIssues(issues, "edge", edge.id, index, result);
    }

    if (edgeIds.has(edge.id)) {
      issues.push({
        type: "edge",
        id: edge.id,
        index,
        field: "id",
        message: `Duplicate edge ID: ${edge.id}`,
      });
    }
    edgeIds.add(edge.id);

    if (!nodeIds.has(edge.source)) {
      issues.push({
        type: "edge",
        id: edge.id,
        index,
        field: "source",
        message: `Edge source does not reference a node: ${edge.source}`,
      });
    }
    if (!nodeIds.has(edge.target)) {
      issues.push({
        type: "edge",
        id: edge.id,
        index,
        field: "target",
        message: `Edge target does not reference a node: ${edge.target}`,
      });
    }
  });

  return {
    nodes: flowNodes,
    edges: flowEdges,
    issues,
  };
}

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Elements live at project scope and are placed in diagrams through
 * `node_views`. An element is deleted once it is no longer placed in any
 * diagram (including pattern and internal views). Only the given candidate
 * ids are considered, so unrelated rows are never touched.
 */
export async function deleteUnplacedNodes(
  tx: Transaction,
  candidateIds: Iterable<string>,
): Promise<number> {
  const ids = Array.from(new Set(candidateIds));
  if (ids.length === 0) return 0;
  const deleted = await tx
    .delete(nodes)
    .where(
      and(
        inArray(nodes.id, ids),
        notExists(
          tx
            .select({ one: sql`1` })
            .from(nodeViews)
            .where(eq(nodeViews.nodeId, nodes.id)),
        ),
      ),
    )
    .returning({ id: nodes.id });
  return deleted.length;
}

const labelOf = (data: unknown) => {
  const label = data && typeof data === "object" && !Array.isArray(data) ? (data as { label?: unknown }).label : undefined;
  return typeof label === "string" ? label.trim() : "";
};

/**
 * The relationships of a metamodel diagram whose name a save changes: their
 * id and new name. A relationship that is new or removed is not renamed.
 */
export function renamedRelationships(
  stored: Array<{ id: string; data?: unknown }>,
  saved: Array<{ id: string; data?: unknown }>,
): Map<string, string> {
  const before = new Map(stored.map((edge) => [edge.id, labelOf(edge.data)]));
  const renamed = new Map<string, string>();
  for (const edge of saved) {
    const previous = before.get(edge.id);
    if (previous !== undefined && previous !== labelOf(edge.data)) renamed.set(edge.id, labelOf(edge.data));
  }
  return renamed;
}

/**
 * Gives the model relationships that record a renamed metamodel relationship
 * (`data.relationId`) its new name. Returns how many changed.
 */
async function relabelModelRelationships(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  renamed: Map<string, string>,
): Promise<number> {
  let relabeled = 0;
  for (const [relationId, label] of Array.from(renamed)) {
    const rows = await tx
      .select({ id: edges.id, data: edges.data })
      .from(edges)
      .where(sql`${edges.data}->>'relationId' = ${relationId}`);
    for (const row of rows) {
      if (labelOf(row.data) === label) continue;
      const { label: _previous, ...rest } = (row.data ?? {}) as Record<string, unknown>;
      await tx
        .update(edges)
        .set({ data: label ? { ...rest, label } : rest })
        .where(eq(edges.id, row.id));
      relabeled += 1;
    }
  }
  return relabeled;
}

export async function syncFlow(
  viewId: number,
  newNodes: SyncFlowNodeInput[],
  newEdges: FlowEdgeInput[],
  options: { baseRevision?: string } = {},
): Promise<{ revision: string | null; relabeled: number }> {
  validateFlowRecords(newNodes, newEdges);

  const [view] = await db.select().from(views).where(eq(views.id, viewId));
  if (!view) throw new Error("View not found");

  if (options.baseRevision !== undefined) {
    const stored = await currentRevision(viewId);
    if (stored !== null && stored !== options.baseRevision) throw new FlowConflictError();
  }

  const [project] = await db
    .select({
      id: projects.id,
      projectType: projects.projectType,
      referencedMetamodels: projects.referencedMetamodels,
    })
    .from(projects)
    .where(eq(projects.id, view.projectId));
  if (!project) throw new Error("Project not found");

  // Relationship ids are unique across all diagrams (they are the primary
  // key). Say so instead of failing on the constraint.
  if (newEdges.length > 0) {
    const taken = await db
      .select({ id: edges.id })
      .from(edges)
      .where(and(inArray(edges.id, newEdges.map((edge) => edge.id)), ne(edges.viewId, viewId)));
    if (taken.length > 0) throw new RelationshipIdTakenError(taken.map((row) => row.id));
  }

  const allowedExternalProjectIds = new Set(
    project.referencedMetamodels ?? [],
  );
  const nodeIds = newNodes.map((node) => node.id);
  const existingNodes = nodeIds.length
    ? await db
        .select({ id: nodes.id, projectId: nodes.projectId })
        .from(nodes)
        .where(inArray(nodes.id, nodeIds))
    : [];
  const existingNodeById = new Map(
    existingNodes.map((node) => [node.id, node]),
  );

  let relabeled = 0;
  await db.transaction(async (tx) => {
    // In a metamodel, a renamed relationship renames the model relationships made from it.
    const renamed =
      project.projectType === "metamodel"
        ? renamedRelationships(
            await tx.select({ id: edges.id, data: edges.data }).from(edges).where(eq(edges.viewId, viewId)),
            newEdges,
          )
        : new Map<string, string>();
    const previouslyPlaced = await tx
      .select({ nodeId: nodeViews.nodeId })
      .from(nodeViews)
      .where(eq(nodeViews.viewId, viewId));
    await tx.delete(nodeViews).where(eq(nodeViews.viewId, viewId));
    await tx.delete(edges).where(eq(edges.viewId, viewId));

    if (newNodes.length > 0) {
      const canonicalNodes = newNodes.map((node) => ({
        id: node.id,
        projectId: view.projectId,
        type: node.type ?? "default",
        data: node.data,
      }));

      for (const canonicalNode of canonicalNodes) {
        const existingNode = existingNodeById.get(canonicalNode.id);
        if (existingNode) {
          if (existingNode.projectId === view.projectId) {
            await tx
              .insert(nodes)
              .values(canonicalNode)
              .onConflictDoUpdate({
                target: nodes.id,
                set: {
                  projectId: canonicalNode.projectId,
                  type: canonicalNode.type,
                  data: canonicalNode.data,
                },
              });
            continue;
          }
          if (!allowedExternalProjectIds.has(existingNode.projectId)) {
            throw new Error(
              "Referenced node does not belong to an allowed metamodel",
            );
          }
          continue;
        }
        await tx.insert(nodes).values(canonicalNode);
      }

      const viewNodes = newNodes.map((node) => ({
        nodeId: node.id,
        viewId,
        position: node.position,
        parentId: node.parentId ?? null,
      }));
      await tx.insert(nodeViews).values(viewNodes);
    }

    if (newEdges.length > 0) {
      const edgesWithView = newEdges.map((edge) => ({ ...normalizeRelationship(edge), viewId }));
      await tx.insert(edges).values(edgesWithView);
    }

    const keptIds = new Set(nodeIds);
    await deleteUnplacedNodes(
      tx,
      previouslyPlaced
        .map((row) => row.nodeId)
        .filter((id) => !keptIds.has(id)),
    );
    await tx.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, view.projectId));
    if (renamed.size > 0) relabeled = await relabelModelRelationships(tx, renamed);
  });
  return { revision: await currentRevision(viewId), relabeled };
}

export async function insertNodeIntoView(
  viewId: number,
  nodeId: string,
  position: { x: number; y: number },
): Promise<void> {
  const [view] = await db.select().from(views).where(eq(views.id, viewId));
  if (!view) throw new Error("View not found");

  const [project] = await db
    .select({
      id: projects.id,
      referencedMetamodels: projects.referencedMetamodels,
    })
    .from(projects)
    .where(eq(projects.id, view.projectId));
  if (!project) throw new Error("Project not found");

  const [node] = await db.select().from(nodes).where(eq(nodes.id, nodeId));
  if (!node) throw new Error("Node not found");
  const canReference =
    node.projectId === view.projectId ||
    (project.referencedMetamodels ?? []).includes(node.projectId);
  if (!canReference) {
    throw new Error(
      "Node does not belong to this project or a referenced metamodel",
    );
  }

  await db
    .insert(nodeViews)
    .values({ nodeId, viewId, position })
    .onConflictDoNothing();
}
