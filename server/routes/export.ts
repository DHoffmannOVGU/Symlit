import type { Express } from "express";
import { z } from "zod";
import { api } from "@shared/routes";
import { projectRole } from "../auth";
import { buildProjectExport } from "../services/project-export";
import { importProjectFile, ProjectFileError } from "../services/project-import";

export function registerExportRoutes(app: Express) {
  app.post(api.projects.import.path, async (req, res) => {
    try {
      const result = await importProjectFile(req.body, { userId: req.workspaceUser!.id });
      res.status(201).json({
        project: result.project,
        firstViewId: result.firstViewId,
        createdProjects: result.projects.size,
      });
    } catch (err) {
      if (err instanceof ProjectFileError) {
        return res.status(400).json({ message: err.message });
      }
      console.error("Failed to import a project file:", err);
      res.status(500).json({ message: "The file could not be imported. Nothing was saved." });
    }
  });

  app.post(api.projects.export.path, async (req, res) => {
    const projectId = Number(req.params.id);
    try {
      const options = api.projects.export.input.parse(req.body ?? {});
      const file = await buildProjectExport(projectId, options, async (project) =>
        Boolean(await projectRole(project, req.workspaceUser!)),
      );
      res.setHeader("Content-Type", file.contentType);
      res.setHeader("Content-Disposition", `attachment; filename="${file.filename}"`);
      res.status(200).send(file.body);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      if (err instanceof Error && err.message === "Project not found") {
        res.status(404).json({ message: "Project not found" });
      } else {
        console.error("Failed to export project:", err);
        res.status(500).json({ message: "Failed to export project" });
      }
    }
  });
}
