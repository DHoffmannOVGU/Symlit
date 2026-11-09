import { randomUUID } from "node:crypto";
import { normalizeRelationship } from "@shared/relationships";
import type { PatternEdgeInput, PatternNodeInput } from "@shared/flow-inputs";
import type { FlowEdge, FlowNodeWithPosition, Project } from "@shared/schema";
import type { PatternListing } from "@shared/routes";
import { db } from "../db";
import { edges, nodes, nodeViews, views } from "@shared/schema";
import { storage } from "../storage";
import { METAMODEL_NODE_TYPES, resolveMetamodel } from "./model-validation";

/*
 * Patterns: reusable snippets of instance-level elements and the
 * relationships between them. Rules are in docs/decisions/patterns.md.
 *
 * - A pattern is a hidden diagram (`viewType: "pattern"`) of an instance
 *   project or a metamodel. Its elements are never part of the model.
 * - Clone and own: saving copies the selection, instantiating copies the
 *   pattern again. Copies record where they came from (`data.pattern`) so a
 *   pattern can later be re-applied, but stay independent.
 * - A project can use its own patterns and those of every metamodel it
 *   references, directly or through other metamodels.
 * - Every type a pattern uses must be known where it is saved and where it
 *   is inserted.
 */

export interface CreatePatternInput {
  name: string;
  description?: string;
  nodes: PatternNodeInput[];
  edges: PatternEdgeInput[];
}

/** Where an element or relationship copied from a pattern came from. */
export interface PatternOrigin {
  patternId: number;
  projectId: number;
  /** The element (or relationship) in the pattern this one is a copy of. */
  elementId: string;
  /** Shared by everything one insert created. */
  insertionId: string;
}

function withoutOrigin(data: unknown) {
  if (typeof data !== "object" || data === null) return data;
  const { pattern: _origin, ...rest } = data as Record<string, unknown>;
  return rest;
}

class PatternError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** Ids of the metamodels a project references, directly or through other metamodels. */
export async function referencedMetamodelChain(referenced: number[] | null | undefined) {
  const chain: number[] = [];
  const queue = [...(referenced ?? [])];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (chain.includes(id)) continue;
    const project = await storage.getProject(id);
    if (!project) continue;
    chain.push(id);
    queue.push(...(project.referencedMetamodels ?? []));
  }
  return chain;
}

/**
 * The type ids elements may use in a project's patterns and diagrams. A
 * metamodel's patterns are used by the projects referencing it, so they see
 * its types the way those projects do.
 */
async function knownTypeIds(project: Project) {
  const resolved =
    project.projectType === "metamodel"
      ? await resolveMetamodel({
          id: null,
          projectType: "instance",
          referencedMetamodels: [project.id],
        })
      : await resolveMetamodel(project);
  return new Set(resolved.typeNodes.map((type) => type.id));
}

function assertTypesKnown(
  elements: { type?: string | null; data?: unknown }[],
  known: Set<string>,
  where: string,
) {
  for (const element of elements) {
    if (element.type && METAMODEL_NODE_TYPES.has(element.type)) {
      throw new PatternError("Patterns contain model elements, not type definitions", 400);
    }
    const data = (element.data ?? {}) as { typeId?: unknown; label?: unknown };
    if (typeof data.typeId === "string" && !known.has(data.typeId)) {
      const label = typeof data.label === "string" ? `"${data.label}" ` : "";
      throw new PatternError(`Element ${label}uses a type that is not known ${where}`, 400);
    }
  }
}

export async function createPattern(projectId: number, pattern: CreatePatternInput): Promise<void> {
  const project = await storage.getProject(projectId);
  if (!project) throw new PatternError("Project not found", 404);
  if (pattern.nodes.length === 0) {
    throw new PatternError("A pattern needs at least one element", 400);
  }
  const ids = new Set(pattern.nodes.map((node) => node.nodeId));
  if (ids.size !== pattern.nodes.length) {
    throw new PatternError("Pattern elements must have distinct ids", 400);
  }
  for (const edge of pattern.edges) {
    if (!ids.has(edge.source) || !ids.has(edge.target)) {
      throw new PatternError("A pattern relationship must connect two elements of the pattern", 400);
    }
  }
  for (const node of pattern.nodes) {
    if (node.parentId && !ids.has(node.parentId)) {
      throw new PatternError("A pattern element can only be nested in an element of the pattern", 400);
    }
  }
  assertTypesKnown(pattern.nodes, await knownTypeIds(project), "in this project");

  await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(views)
      .values({
        projectId,
        name: pattern.name,
        description: pattern.description ?? null,
        viewType: "pattern",
      })
      .returning();
    if (!created) throw new Error("Failed to create pattern");

    const idMap = new Map(pattern.nodes.map((node) => [node.nodeId, `node_${randomUUID()}`]));
    for (const node of pattern.nodes) {
      const id = idMap.get(node.nodeId)!;
      // A pattern made from inserted copies is a new pattern, not a copy.
      const data = (withoutOrigin(node.data) ?? {}) as Record<string, unknown>;
      await tx.insert(nodes).values({ id, projectId, type: node.type, data });
      await tx.insert(nodeViews).values({
        nodeId: id,
        viewId: created.id,
        position: node.position,
        parentId: node.parentId ? idMap.get(node.parentId)! : null,
      });
    }
    if (pattern.edges.length > 0) {
      await tx.insert(edges).values(
        pattern.edges.map((edge) => ({
          ...normalizeRelationship({ ...edge, data: withoutOrigin(edge.data) }),
          id: `edge_${randomUUID()}`,
          viewId: created.id,
          source: idMap.get(edge.source)!,
          target: idMap.get(edge.target)!,
        })),
      );
    }
  });
}


/** The project's own patterns, then those of its referenced metamodels. */
export async function listPatterns(projectId: number): Promise<PatternListing[]> {
  const project = await storage.getProject(projectId);
  if (!project) return [];
  const result: PatternListing[] = [];
  for (const id of [projectId, ...(await referencedMetamodelChain(project.referencedMetamodels))]) {
    const owner = id === projectId ? project : await storage.getProject(id);
    if (!owner) continue;
    for (const pattern of await storage.getPatterns(id)) {
      result.push({ ...pattern, projectName: owner.name, ownedByProject: id === projectId });
    }
  }
  return result;
}

/**
 * Builds a fresh copy of a pattern for a diagram, centred on `position`. The
 * copy is not saved: the editor adds it to the open diagram (keeping unsaved
 * edits and undo history) and it is stored with the next save.
 */
export async function instantiatePattern(
  viewId: number,
  patternId: number,
  position: { x: number; y: number },
): Promise<{ nodes: FlowNodeWithPosition[]; edges: FlowEdge[] }> {
  const view = await storage.getView(viewId);
  if (!view || view.viewType !== "view") throw new PatternError("View not found", 404);
  const pattern = await storage.getView(patternId);
  if (!pattern || pattern.viewType !== "pattern") throw new PatternError("Pattern not found", 404);
  const project = await storage.getProject(view.projectId);
  if (!project) throw new PatternError("Project not found", 404);
  if (project.projectType !== "instance") {
    throw new PatternError("Patterns can only be inserted into instance models", 400);
  }
  const usable = [project.id, ...(await referencedMetamodelChain(project.referencedMetamodels))];
  if (!usable.includes(pattern.projectId)) {
    throw new PatternError("Pattern is not available in this project", 400);
  }

  const flow = await storage.getFlow(pattern.id);
  assertTypesKnown(flow.nodes, await knownTypeIds(project), "in this project");

  const insertionId = randomUUID();
  const origin = (elementId: string): PatternOrigin => ({
    patternId: pattern.id,
    projectId: pattern.projectId,
    elementId,
    insertionId,
  });
  const idMap = new Map(flow.nodes.map((node) => [node.id, `node_${randomUUID()}`]));
  const topLevel = flow.nodes.filter((node) => !node.parentId || !idMap.has(node.parentId));
  const xs = topLevel.map((node) => node.position.x);
  const ys = topLevel.map((node) => node.position.y);
  const center = {
    x: (Math.min(...xs) + Math.max(...xs)) / 2,
    y: (Math.min(...ys) + Math.max(...ys)) / 2,
  };

  const copiedNodes = flow.nodes.map((node) => {
    const parentId = node.parentId ? idMap.get(node.parentId) : undefined;
    return {
      ...node,
      id: idMap.get(node.id)!,
      projectId: view.projectId,
      // Nested elements are positioned relative to their parent.
      position: parentId
        ? node.position
        : {
            x: Math.round(position.x + node.position.x - center.x),
            y: Math.round(position.y + node.position.y - center.y),
          },
      parentId: parentId ?? null,
      data: { ...((node.data ?? {}) as Record<string, unknown>), pattern: origin(node.id) },
    };
  });
  const copiedEdges = flow.edges.map((edge) => ({
    ...edge,
    id: `edge_${randomUUID()}`,
    viewId,
    source: idMap.get(edge.source)!,
    target: idMap.get(edge.target)!,
    data: { ...((edge.data ?? {}) as Record<string, unknown>), pattern: origin(edge.id) },
  }));
  return { nodes: copiedNodes, edges: copiedEdges };
}
