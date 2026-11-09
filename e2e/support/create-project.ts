import { randomUUID } from "node:crypto";
import type { APIRequestContext } from "@playwright/test";

type SeedNode = { id: string; parentId?: string | null; [key: string]: unknown };
type SeedEdge = { id?: string; source: string; target: string; [key: string]: unknown };

/**
 * Creates a project with diagrams through the normal API (create project,
 * create views, save each diagram). Element ids in `views` are local to the
 * call and get a unique suffix, so specs can reuse simple ids. Mirrors what
 * the removed starter endpoint offered: `.json()` gives `{ project, firstViewId }`.
 */
export async function createProjectWithViews(
  request: APIRequestContext,
  data: {
    name: string;
    projectType: "metamodel" | "instance";
    description?: string;
    referencedMetamodels?: number[];
    views: Array<{ name: string; description?: string; nodes: SeedNode[]; edges: SeedEdge[] }>;
  },
) {
  const { views, referencedMetamodels, ...projectData } = data;
  const project = await (await request.post("/api/projects", { data: projectData })).json();
  if (referencedMetamodels?.length) {
    await request.patch(`/api/projects/${project.id}`, { data: { referencedMetamodels } });
  }
  const suffix = randomUUID().slice(0, 8);
  const local = (id: string) => `${id}-${suffix}`;
  let firstViewId: number | null = null;
  for (const view of views) {
    const created = await (
      await request.post(`/api/projects/${project.id}/views`, {
        data: { name: view.name, description: view.description },
      })
    ).json();
    firstViewId ??= created.id;
    const saved = await request.post(`/api/views/${created.id}/sync`, {
      data: {
        nodes: view.nodes.map((node) => ({
          ...node,
          id: local(node.id),
          ...(node.parentId ? { parentId: local(node.parentId) } : {}),
        })),
        edges: view.edges.map((edge, index) => ({
          ...edge,
          id: local(edge.id ?? `edge-${index}`),
          source: local(edge.source),
          target: local(edge.target),
        })),
      },
    });
    if (!saved.ok()) throw new Error(`Saving ${view.name} failed: ${await saved.text()}`);
  }
  const result = { project: { ...project, referencedMetamodels: referencedMetamodels ?? [] }, firstViewId };
  return { json: async () => result, ok: () => true, status: () => 201 };
}
