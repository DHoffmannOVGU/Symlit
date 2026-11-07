import type { Express } from "express";
import { z } from "zod";
import { api } from "@shared/routes";
import { storage } from "../storage";
import type { AppConfig } from "../config";
import { GeminiMetamodelError, proposeMetamodel } from "../services/gemini-metamodel";

export function registerAiRoutes(app: Express, config: AppConfig) {
  app.post(api.ai.proposeMetamodel.path, async (req, res) => {
    try {
      const projectId = Number(req.params.projectId);
      const viewId = Number(req.params.viewId);
      const [project, view] = await Promise.all([storage.getProject(projectId), storage.getView(viewId)]);
      if (!project || !view || view.projectId !== projectId) return res.status(404).json({ message: "Metamodel view not found" });
      if (!config.features.ai) return res.status(503).json({ message: "AI modeling is not configured. Set GEMINI_API_KEY on the server." });
      if (project.projectType !== "metamodel") return res.status(400).json({ message: "AI metamodeling is currently available only in metamodel projects" });
      const input = api.ai.proposeMetamodel.input.parse(req.body);
      res.json(await proposeMetamodel(input));
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: error.errors[0]?.message ?? "Invalid AI request" });
      if (error instanceof GeminiMetamodelError) return res.status(error.status).json({ message: error.message });
      res.status(500).json({ message: "Failed to create an AI metamodel proposal" });
    }
  });

}
