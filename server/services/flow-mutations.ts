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
import { and, eq, inArray } from "drizzle-orm";

export type StarterViewFlowInput = {
  nodes: SyncFlowNodeInput[];
  edges: FlowEdgeInput[];
};

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

export function validateStarterTemplate(
  starterViews: StarterViewFlowInput[],
) {
  const nodeIds = starterViews.flatMap((view) =>
    view.nodes.map((node) => node.id),
  );
  if (new Set(nodeIds).size !== nodeIds.length) {
    throw new Error("Starter template contains duplicate node IDs");
  }

  const edgeIds = starterViews.flatMap((view) =>
    view.edges.map((edge) => edge.id),
  );
  if (new Set(edgeIds).size !== edgeIds.length) {
    throw new Error("Starter template contains duplicate edge IDs");
  }
}

export function buildStarterViewRecords(
  projectId: number,
  viewId: number,
  starterView: StarterViewFlowInput,
) {
  return {
    nodes: starterView.nodes.map((node) => ({
      id: node.id,
      projectId,
      type: node.type ?? "default",
      data: node.data,
    })),
    nodeViews: starterView.nodes.map((node) => ({
      nodeId: node.id,
      viewId,
      position: node.position,
      parentId: node.parentId ?? null,
    })),
    edges: starterView.edges.map((edge) => ({
      ...edge,
      viewId,
    })),
  };
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

export async function syncFlow(
  viewId: number,
  newNodes: SyncFlowNodeInput[],
  newEdges: FlowEdgeInput[],
): Promise<void> {
  validateFlowRecords(newNodes, newEdges);

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

  await db.transaction(async (tx) => {
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
      const edgesWithView = newEdges.map((edge) => ({ ...edge, viewId }));
      await tx.insert(edges).values(edgesWithView);
    }
  });
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

export async function insertPatternIntoView(
  viewId: number,
  patternId: number,
  position: { x: number; y: number },
): Promise<void> {
  const [view] = await db.select().from(views).where(eq(views.id, viewId));
  if (!view) throw new Error("View not found");

  const [patternView] = await db
    .select()
    .from(views)
    .where(and(eq(views.id, patternId), eq(views.viewType, "pattern")));
  if (!patternView) throw new Error("Pattern not found");
  if (patternView.projectId !== view.projectId) {
    throw new Error("Pattern does not belong to this project");
  }

  const nodesRows = await db
    .select({
      id: nodes.id,
      projectId: nodes.projectId,
      type: nodes.type,
      data: nodes.data,
      createdAt: nodes.createdAt,
      position: nodeViews.position,
    })
    .from(nodeViews)
    .innerJoin(nodes, eq(nodeViews.nodeId, nodes.id))
    .where(eq(nodeViews.viewId, patternView.id));

  const edgesRows = await db
    .select()
    .from(edges)
    .where(eq(edges.viewId, patternView.id));

  const idMap = new Map<string, string>();
  const now = Date.now();
  const positions = nodesRows.map(
    (node) => node.position as { x: number; y: number },
  );
  const minX = positions.length ? Math.min(...positions.map((p) => p.x)) : 0;
  const maxX = positions.length ? Math.max(...positions.map((p) => p.x)) : 0;
  const minY = positions.length ? Math.min(...positions.map((p) => p.y)) : 0;
  const maxY = positions.length ? Math.max(...positions.map((p) => p.y)) : 0;
  const center = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };

  await db.transaction(async (tx) => {
    for (let i = 0; i < nodesRows.length; i += 1) {
      const oldId = nodesRows[i].id;
      const newId = `node_${patternId}_${now}_${i}`;
      idMap.set(oldId, newId);
    }

    for (let i = 0; i < nodesRows.length; i += 1) {
      const node = nodesRows[i];
      const newId = idMap.get(node.id);
      if (!newId) continue;

      const rel = node.position as { x: number; y: number };
      const newPosition = {
        x: position.x + (rel.x - center.x),
        y: position.y + (rel.y - center.y),
      };

      await tx.insert(nodes).values({
        id: newId,
        projectId: view.projectId,
        type: node.type,
        data: node.data,
      });

      await tx.insert(nodeViews).values({
        nodeId: newId,
        viewId,
        position: newPosition,
      });
    }

    if (edgesRows.length > 0) {
      await tx.insert(edges).values(
        edgesRows.map((edge, index) => {
          const source = idMap.get(edge.source) ?? edge.source;
          const target = idMap.get(edge.target) ?? edge.target;
          return {
            id: `edge_${patternId}_${now}_${index}`,
            viewId,
            source,
            target,
            edgeType: edge.edgeType,
            sourceHandle: edge.sourceHandle ?? null,
            targetHandle: edge.targetHandle ?? null,
            data: edge.data ?? null,
          };
        }),
      );
    }
  });
}
