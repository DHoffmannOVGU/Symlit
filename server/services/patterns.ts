import { randomUUID } from "node:crypto";
import { normalizeRelationship } from "@shared/relationships";
import { db } from "../db";
import { edges, nodes, nodeViews, views } from "@shared/schema";
import type {
  PatternEdgeInput,
  PatternNodeInput,
} from "@shared/flow-inputs";

export interface CreatePatternInput {
  name: string;
  description?: string;
  nodes: PatternNodeInput[];
  edges: PatternEdgeInput[];
}

export async function createPattern(
  projectId: number,
  pattern: CreatePatternInput,
): Promise<void> {
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

    const idMap = new Map<string, string>();
    const now = Date.now();

    if (pattern.nodes.length > 0) {
      for (let i = 0; i < pattern.nodes.length; i += 1) {
        const node = pattern.nodes[i];
        const newId = `pattern_${created.id}_${now}_${i}`;
        idMap.set(node.nodeId, newId);
        await tx.insert(nodes).values({
          id: newId,
          projectId,
          type: node.type,
          data: node.data,
        });
        await tx.insert(nodeViews).values({
          nodeId: newId,
          viewId: created.id,
          position: node.position,
        });
      }
    }

    if (pattern.edges.length > 0) {
      await tx.insert(edges).values(
        pattern.edges.map((edge) => ({
          // Keeps the relationship type: patterns used to save every
          // relationship as an association.
          ...normalizeRelationship(edge),
          id: `edge_${randomUUID()}`,
          viewId: created.id,
          source: idMap.get(edge.source) ?? edge.source,
          target: idMap.get(edge.target) ?? edge.target,
        })),
      );
    }
  });
}
