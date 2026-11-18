import { eq } from "drizzle-orm";
import { buildParentMap, buildParentMapFromNodes, mergeParentMaps } from "@shared/metamodel-inheritance";
import { deriveRelationId, graphRelationshipOf, type MetaRelation, type RelationKnowledge } from "@shared/related-formula";
import { edges, nodes, projects, views } from "@shared/schema";
import { db } from "../db";
import { storage } from "../storage";

/*
 * Which metamodel relationship a model relationship stands for. New
 * relationships record it when they are made from Symlit's suggestion
 * (`data.relationId`); for older ones it is worked out as validation does,
 * from their types, name and kind. Related Formulas match relationships by it,
 * so that a renamed metamodel relationship keeps counting.
 */

const recordOf = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

/**
 * The relationships and Generalizations of metamodels (and of the metamodels
 * they build on), with type ids as models refer to them (`mm:<project>:<type>`).
 */
export async function metamodelKnowledge(metamodelIds: number[]): Promise<Required<Pick<RelationKnowledge, "relations" | "parentMap">>> {
  const relations: MetaRelation[] = [];
  const specializations: Array<{ id: string; data: { typeId: string } }> = [];
  const queue = [...metamodelIds];
  const seen = new Set<number>();
  while (queue.length > 0) {
    const metamodelId = queue.shift()!;
    if (seen.has(metamodelId)) continue;
    seen.add(metamodelId);
    const project = await storage.getProject(metamodelId);
    if (!project || project.projectType !== "metamodel") continue;
    queue.push(...((project.referencedMetamodels as number[] | null) ?? []));
    const data = await storage.getProjectExportData(metamodelId);
    for (const view of data.views) {
      const ownerOf = new Map(view.nodes.map((node) => [node.id, (node as { projectId?: number }).projectId ?? metamodelId]));
      const typeIdOf = (nodeId: string) => `mm:${ownerOf.get(nodeId) ?? metamodelId}:${nodeId}`;
      for (const node of view.nodes) {
        const parent = recordOf(node.data).typeId;
        if (typeof parent === "string" && parent) {
          const owner = ownerOf.get(node.id) ?? metamodelId;
          specializations.push({ id: typeIdOf(node.id), data: { typeId: parent.startsWith("mm:") ? parent : `mm:${owner}:${parent}` } });
        }
      }
      for (const edge of view.edges) {
        if (!ownerOf.has(edge.source) || !ownerOf.has(edge.target)) continue;
        const relationship = graphRelationshipOf(edge);
        relations.push({
          id: edge.id,
          label: relationship.name,
          edgeType: relationship.kind ?? "association",
          sourceTypeId: typeIdOf(edge.source),
          targetTypeId: typeIdOf(edge.target),
        });
      }
    }
  }
  return {
    relations: relations.filter((relation) => relation.edgeType !== "generalization"),
    parentMap: mergeParentMaps(buildParentMap(relations), buildParentMapFromNodes(specializations)),
  };
}

/**
 * Records, on every model relationship that does not say yet, which
 * metamodel relationship it stands for, where that can be worked out. Runs at
 * start; does nothing for relationships that say already, so it is cheap
 * after the first time. Returns how many it recorded.
 */
export async function recordRelationshipLinks(): Promise<number> {
  const models = await db.select().from(projects).where(eq(projects.projectType, "instance"));
  const knowledgeOf = new Map<string, Awaited<ReturnType<typeof metamodelKnowledge>>>();
  let recorded = 0;
  for (const model of models) {
    const referenced = (model.referencedMetamodels as number[] | null) ?? [];
    if (referenced.length === 0) continue;
    const key = [...referenced].sort((a, b) => a - b).join(",");
    let knowledge = knowledgeOf.get(key);
    if (!knowledge) {
      knowledge = await metamodelKnowledge(referenced);
      knowledgeOf.set(key, knowledge);
    }
    if (knowledge.relations.length === 0) continue;
    const elements = await db.select({ id: nodes.id, data: nodes.data }).from(nodes).where(eq(nodes.projectId, model.id));
    const typeOf = new Map(
      elements.map((element) => {
        const typeId = recordOf(element.data).typeId;
        return [element.id, typeof typeId === "string" ? typeId : undefined] as const;
      }),
    );
    const rows = await db.select({ edge: edges }).from(edges).innerJoin(views, eq(edges.viewId, views.id)).where(eq(views.projectId, model.id));
    for (const { edge } of rows) {
      const data = recordOf(edge.data);
      if (typeof data.relationId === "string" && data.relationId) continue;
      const relationId = deriveRelationId(
        graphRelationshipOf(edge),
        typeOf.get(edge.source),
        typeOf.get(edge.target),
        knowledge.relations,
        knowledge.parentMap,
      );
      if (!relationId) continue;
      await db.update(edges).set({ data: { ...data, relationId } }).where(eq(edges.id, edge.id));
      recorded += 1;
    }
  }
  return recorded;
}
