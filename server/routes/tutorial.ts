import type { Express, Request, Response } from "express";
import { api } from "@shared/routes";
import { DEFAULT_TUTORIAL, findTutorial, type TutorialDefinition } from "@shared/tutorial";
import { createTutorial, deleteTutorial } from "../services/tutorial";

export function registerTutorialRoutes(app: Express) {
  const create = async (req: Request, res: Response, tutorial: TutorialDefinition | undefined) => {
    if (!tutorial) return res.status(404).json({ message: "Tutorial not found" });
    try {
      res.status(201).json(await createTutorial(req.workspaceUser!.id, tutorial));
    } catch (error) {
      console.error("Failed to create the tutorial:", error);
      res.status(500).json({ message: "The tutorial could not be created." });
    }
  };

  // Without an id, the first tutorial is created.
  app.post(api.tutorial.create.path, (req, res) => create(req, res, DEFAULT_TUTORIAL));
  app.post(api.tutorial.createOne.path, (req, res) => create(req, res, findTutorial(req.params.tutorial)));

  // Without an id, the projects of all tutorials are removed.
  app.delete(api.tutorial.delete.path, async (req, res) => {
    res.json({ deletedProjects: await deleteTutorial(req.workspaceUser!.id) });
  });
  app.delete(api.tutorial.deleteOne.path, async (req, res) => {
    const tutorial = findTutorial(req.params.tutorial);
    if (!tutorial) return res.status(404).json({ message: "Tutorial not found" });
    res.json({ deletedProjects: await deleteTutorial(req.workspaceUser!.id, tutorial) });
  });
}
