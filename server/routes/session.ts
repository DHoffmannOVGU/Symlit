import type { Express } from "express";
import { api } from "@shared/routes";
import { roleCapabilities } from "@shared/authorization";
import type { AppConfig } from "../config";
import { appVersion } from "../version";

export function registerSessionRoutes(app: Express, config: AppConfig) {
  app.get(api.config.get.path, (_req, res) => {
    res.json({
      edition: "local",
      version: appVersion,
      features: config.features,
    });
  });

  app.get(api.auth.me.path, (req, res) => {
    if (!req.workspaceUser || !req.workspaceRole) {
      return res.status(401).json({ message: "Authentication required" });
    }
    res.json({
      user: req.workspaceUser,
      role: req.workspaceRole,
      authKind: "local",
      capabilities: roleCapabilities(req.workspaceRole),
    });
  });

}
