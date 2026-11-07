import { storage } from "./storage";

/**
 * Creates a small demo project the first time a workspace is empty.
 * Returns true when the demo was created.
 */
export async function seedDemoProject(ownerUserId: number): Promise<boolean> {
  const existing = await storage.getProjectsByUser(ownerUserId);
  if (existing.length > 0) return false;

  const project = await storage.createProject({
    userId: ownerUserId,
    name: "Demo Project",
    description: "A sample MBSE project to get you started.",
    projectType: "instance",
  });
  const view = await storage.createView({
    projectId: project.id,
    name: "System Context",
    description: "High level system context diagram",
  });
  await storage.syncFlow(
    view.id,
    [
      {
        id: `demo-${project.id}-system`,
        type: "part",
        position: { x: 100, y: 100 },
        data: { label: "System", type: "Object", description: "Core system boundary" },
      },
      {
        id: `demo-${project.id}-external`,
        type: "part",
        position: { x: 400, y: 100 },
        data: { label: "External Entity", type: "Object", description: "External performer" },
      },
    ],
    [
      {
        id: `demo-${project.id}-link`,
        source: `demo-${project.id}-system`,
        target: `demo-${project.id}-external`,
        edgeType: "association",
        sourceHandle: null,
        targetHandle: null,
      },
    ],
  );
  return true;
}
