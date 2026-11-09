import type { Express } from "express";
import { z } from "zod";
import { api } from "@shared/routes";
import { storage } from "../storage";
import { FlowConflictError, flowRevision } from "../services/flow-mutations";
import { validateView } from "../services/model-validation";

export function registerFlowRoutes(app: Express) {
  // Flow
  app.get(api.flow.get.path, async (req, res) => {
    const viewId = Number(req.params.viewId);
    const view = await storage.getView(viewId);
    if (!view) return res.status(404).json({ message: "View not found" });
    try {
      const flow = await storage.getFlow(viewId);
      res.json({ ...flow, revision: flowRevision(flow) });
    } catch (err) {
      if (err instanceof z.ZodError) {
        console.error("Saved flow failed validation:", err.errors[0]?.message);
        return res.status(422).json({
          message:
            "This diagram contains invalid saved data and cannot be shown as it is.",
        });
      }
      throw err;
    }
  });

  app.get(api.flow.recovery.path, async (req, res) => {
    const viewId = Number(req.params.viewId);
    const recovery = await storage.getFlowRecovery(viewId);
    if (!recovery) return res.status(404).json({ message: "View not found" });
    res.json(recovery);
  });

  app.post(api.flow.validate.path, async (req, res) => {
    const viewId = Number(req.params.viewId);
    const issues = await validateView(viewId);
    if (issues === null) return res.status(404).json({ message: "View not found" });
    res.json({ issues });
  });

  app.post(api.flow.sync.path, async (req, res) => {
    try {
      const viewId = Number(req.params.viewId);
      const view = await storage.getView(viewId);
      if (!view) return res.status(404).json({ message: "View not found" });
      const input = api.flow.sync.input.parse(req.body);
      const { revision } = await storage.syncFlow(viewId, input.nodes, input.edges, {
        baseRevision: input.baseRevision,
      });
      res.json({ success: true, revision });
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: err.errors[0].message });
      } else if (err instanceof FlowConflictError) {
        res.status(409).json({ message: err.message });
      } else {
        console.error("Flow sync error:", err);
        res.status(500).json({
          message: err instanceof Error ? err.message : "Failed to sync flow",
        });
      }
    }
  });

  app.post(api.flow.insertNode.path, async (req, res) => {
    try {
      const viewId = Number(req.params.viewId);
      const nodeId = String(req.params.nodeId);
      const input = api.flow.insertNode.input.parse(req.body);
      await storage.insertNodeIntoView(viewId, nodeId, input.position);
      res.json({ success: true });
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: err.errors[0].message });
      } else if (err instanceof Error && err.message.includes("not found")) {
        res.status(404).json({ message: err.message });
      } else if (err instanceof Error && err.message.includes("referenced metamodel")) {
        res.status(400).json({ message: err.message });
      } else {
        throw err;
      }
    }
  });


}
