import type { Express } from "express";
import { z } from "zod";
import { api } from "@shared/routes";
import { storage } from "../storage";

export function registerViewRoutes(app: Express) {
  // Views
  app.get(api.views.list.path, async (req, res) => {
    const views = await storage.getViews(Number(req.params.projectId));
    res.json(views);
  });

  app.post(api.views.create.path, async (req, res) => {
    try {
      const input = api.views.create.input.parse(req.body);
      // Manually add projectId from param since it was omitted in schema for body
      const viewData = { ...input, projectId: Number(req.params.projectId) };
      const view = await storage.createView(viewData);
      res.status(201).json(view);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: err.errors[0].message });
      } else {
        throw err;
      }
    }
  });

  app.get(api.views.get.path, async (req, res) => {
    const view = await storage.getView(Number(req.params.id));
    if (!view) return res.status(404).json({ message: "View not found" });
    res.json(view);
  });

  app.patch(api.views.update.path, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const input = api.views.update.input.parse(req.body);
      const view = await storage.updateView(id, input);
      res.json(view);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: err.errors[0].message });
      } else {
        res.status(500).json({ message: "Failed to update view" });
      }
    }
  });

  app.delete(api.views.delete.path, async (req, res) => {
    const viewId = Number(req.params.id);
    const view = await storage.getView(viewId);
    if (!view) return res.status(404).json({ message: "View not found" });
    await storage.deleteView(viewId);
    res.status(204).send();
  });

  // Nodes
  app.get(api.nodes.get.path, async (req, res) => {
    const nodeId = String(req.params.nodeId);
    const node = await storage.getNodeById(nodeId);
    if (!node) return res.status(404).json({ message: "Node not found" });
    res.json(node);
  });

}
