import type { Express } from "express";
import { z } from "zod";
import { api } from "@shared/routes";
import { storage } from "../storage";

export function registerPatternRoutes(app: Express) {
  // Patterns
  app.get(api.patterns.list.path, async (req, res) => {
    const projectId = Number(req.params.projectId);
    const patterns = await storage.getPatterns(projectId);
    res.json(patterns);
  });

  app.post(api.patterns.create.path, async (req, res) => {
    try {
      const projectId = Number(req.params.projectId);
      const input = api.patterns.create.input.parse(req.body);
      await storage.createPattern(projectId, input);
      res.status(201).json({ success: true });
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: err.errors[0].message });
      } else {
        throw err;
      }
    }
  });

}
