import type { Express } from "express";
import { z } from "zod";
import { api } from "@shared/routes";
import { createProjectFromTemplate, listProjectTemplates } from "../services/project-templates";

export function registerProjectTemplateRoutes(app: Express) {
  app.get(api.projectTemplates.list.path, (_req, res) => {
    res.json(listProjectTemplates());
  });

  app.post(api.projectTemplates.create.path, async (req, res) => {
    try {
      const input = api.projectTemplates.create.input.parse(req.body ?? {});
      const result = await createProjectFromTemplate(
        String(req.params.templateId),
        req.workspaceUser!.id,
        input,
      );
      res.status(201).json({ project: result.project, firstViewId: result.firstViewId });
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: err.errors[0].message });
        return;
      }
      const status = (err as { status?: number }).status;
      if (status && status < 500) {
        res.status(status).json({ message: (err as Error).message });
        return;
      }
      console.error("Failed to create a project from a template:", err);
      res.status(500).json({ message: "The project could not be created. Nothing was saved." });
    }
  });
}
