import type { Express } from "express";
import { api } from "@shared/routes";
import { createTutorial, deleteTutorial } from "../services/tutorial";

export function registerTutorialRoutes(app: Express) {
  app.post(api.tutorial.create.path, async (req, res) => {
    try {
      res.status(201).json(await createTutorial(req.workspaceUser!.id));
    } catch (error) {
      console.error("Failed to create the tutorial:", error);
      res.status(500).json({ message: "The tutorial could not be created." });
    }
  });

  app.delete(api.tutorial.delete.path, async (req, res) => {
    res.json({ deletedProjects: await deleteTutorial(req.workspaceUser!.id) });
  });
}
