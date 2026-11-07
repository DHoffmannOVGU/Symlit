import { db } from "../db";
import { nodes, views, type View } from "@shared/schema";
import { and, eq } from "drizzle-orm";

export async function getInternalViewByNodeId(
  nodeId: string,
): Promise<View | undefined> {
  const [view] = await db
    .select()
    .from(views)
    .where(
      and(eq(views.viewType, "internal"), eq(views.parentNodeId, nodeId)),
    );
  return view;
}

export async function createInternalViewForNode(
  nodeId: string,
  overrides?: { name?: string; description?: string; parentViewId?: number },
): Promise<View> {
  const [node] = await db.select().from(nodes).where(eq(nodes.id, nodeId));
  if (!node) throw new Error("Node not found");

  const existing = await getInternalViewByNodeId(nodeId);
  if (existing) {
    if (!existing.parentViewId && overrides?.parentViewId) {
      const [updated] = await db
        .update(views)
        .set({ parentViewId: overrides.parentViewId })
        .where(eq(views.id, existing.id))
        .returning();
      return updated ?? existing;
    }
    return existing;
  }

  const rawLabel = (node.data as { label?: unknown } | null)?.label;
  const label =
    typeof rawLabel === "string" && rawLabel.trim().length > 0
      ? rawLabel.trim()
      : "Node";
  const name =
    overrides?.name && overrides.name.trim().length > 0
      ? overrides.name.trim()
      : `${label} (Internal)`;
  const description =
    overrides?.description && overrides.description.trim().length > 0
      ? overrides.description.trim()
      : null;

  const [view] = await db
    .insert(views)
    .values({
      projectId: node.projectId,
      name,
      description,
      viewType: "internal",
      parentNodeId: nodeId,
      parentViewId: overrides?.parentViewId ?? null,
    })
    .returning();

  if (!view) throw new Error("Failed to create internal view");
  return view;
}
