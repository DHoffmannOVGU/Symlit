import type { Express } from "express";
import { z } from "zod";
import { api } from "@shared/routes";
import { roleCapabilities } from "@shared/authorization";
import { storage } from "../storage";
import { projectRole } from "../auth";
import type { User } from "@shared/schema";

class InvalidReferenceError extends Error {}

/**
 * Newly added metamodel references must point at metamodel projects the
 * current user can access. References that are already stored are left
 * alone so a project whose metamodel was deleted can still be edited.
 */
async function assertValidMetamodelReferences(
  user: User,
  projectId: number | null,
  requested: number[] | undefined,
  existing: number[] = [],
) {
  if (!requested) return;
  const known = new Set(existing);
  for (const id of new Set(requested)) {
    if (known.has(id)) continue;
    if (id === projectId) throw new InvalidReferenceError("A project cannot reference itself");
    const target = await storage.getProject(id);
    if (!target || !(await projectRole(target, user))) {
      throw new InvalidReferenceError(`Metamodel ${id} was not found`);
    }
    if (target.projectType !== "metamodel") {
      throw new InvalidReferenceError(`Project ${id} is not a metamodel`);
    }
  }
}

export function registerProjectRoutes(app: Express) {
  // Projects
  app.get(api.projects.list.path, async (req, res) => {
    const projects = await storage.getProjectsByUser(req.workspaceUser!.id);
    res.json(projects);
  });

  app.post(api.projects.create.path, async (req, res) => {
    try {
      const input = api.projects.create.input.parse(req.body);
      await assertValidMetamodelReferences(req.workspaceUser!, null, input.referencedMetamodels);
      const project = await storage.createProject({
        ...input,
        userId: req.workspaceUser!.id,
      });
      res.status(201).json(project);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: err.errors[0].message });
      } else if (err instanceof InvalidReferenceError) {
        res.status(400).json({ message: err.message });
      } else {
        throw err;
      }
    }
  });

  app.get(api.projects.get.path, async (req, res) => {
    const project = await storage.getProject(Number(req.params.id));
    if (!project) return res.status(404).json({ message: "Project not found" });
    res.json(project);
  });

  app.get(api.projects.access.path, async (req, res) => {
    const project = await storage.getProject(Number(req.params.id));
    if (!project) return res.status(404).json({ message: "Project not found" });
    const role = await projectRole(project, req.workspaceUser!);
    if (!role) return res.status(403).json({ message: "You do not have access to this project" });
    res.json({ role, capabilities: roleCapabilities(role) });
  });

  app.patch(api.projects.update.path, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const input = api.projects.update.input.parse(req.body);
      const current = await storage.getProject(id);
      await assertValidMetamodelReferences(
        req.workspaceUser!,
        id,
        input.referencedMetamodels,
        current?.referencedMetamodels ?? [],
      );
      const project = await storage.updateProject(id, input);
      res.json(project);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: err.errors[0].message });
      } else if (err instanceof InvalidReferenceError) {
        res.status(400).json({ message: err.message });
      } else {
        res.status(500).json({ message: "Failed to update project" });
      }
    }
  });

  app.delete(api.projects.delete.path, async (req, res) => {
    const project = await storage.getProject(Number(req.params.id));
    if (!project) return res.status(404).json({ message: "Project not found" });
    await storage.deleteProject(Number(req.params.id));
    res.status(204).send();
  });

}
