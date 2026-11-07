import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { GeminiMetamodelError, proposeMetamodel } from "./services/gemini-metamodel";
import { validateView } from "./services/model-validation";
import { roleCapabilities } from "@shared/authorization";
import { projectRole } from "./auth";
import type { AppConfig } from "./config";
import { appVersion } from "./version";

type ApiRoutePattern = { method: string; path: string; regex: RegExp };

function pathToRegex(path: string): RegExp {
  const pattern = path
    .split("/")
    .map((segment) =>
      segment.startsWith(":") ? "[^/]+" : segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    )
    .join("/");
  return new RegExp(`^${pattern}$`);
}

// Walks the shared `api` contract object and flattens every { method, path }
// leaf into a matchable pattern, so the 404/405 handler below stays in sync
// with routes.ts without a second hand-maintained route list.
function collectApiRoutePatterns(node: unknown, acc: ApiRoutePattern[] = []): ApiRoutePattern[] {
  if (node && typeof node === "object") {
    const maybeRoute = node as { method?: unknown; path?: unknown };
    if (typeof maybeRoute.method === "string" && typeof maybeRoute.path === "string") {
      acc.push({ method: maybeRoute.method, path: maybeRoute.path, regex: pathToRegex(maybeRoute.path) });
    } else {
      for (const value of Object.values(node)) {
        collectApiRoutePatterns(value, acc);
      }
    }
  }
  return acc;
}

const csvCell = (value: unknown) => {
  const text =
    value === null || value === undefined
      ? ""
      : typeof value === "string"
        ? value
        : JSON.stringify(value);
  return `"${text.replace(/"/g, '""')}"`;
};

const toCsv = (headers: string[], rows: unknown[][]) =>
  [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");

export async function registerRoutes(
  httpServer: Server,
  app: Express,
  config: AppConfig,
): Promise<Server> {
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

  // Projects
  app.get(api.projects.list.path, async (req, res) => {
    const projects = await storage.getProjectsByUser(req.workspaceUser!.id);
    res.json(projects);
  });

  app.post(api.projects.create.path, async (req, res) => {
    try {
      const input = api.projects.create.input.parse(req.body);
      const project = await storage.createProject({
        ...input,
        userId: req.workspaceUser!.id,
      });
      res.status(201).json(project);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: err.errors[0].message });
      } else {
        throw err;
      }
    }
  });

  app.post(api.projects.createStarter.path, async (req, res) => {
    try {
      const input = api.projects.createStarter.input.parse(req.body);
      const { views: starterViews, ...projectData } = input;
      const result = await storage.createStarterProject(
        { ...projectData, userId: req.workspaceUser!.id },
        starterViews,
      );
      res.status(201).json(result);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Failed to create starter project:", err);
      const errorCode =
        typeof err === "object" && err !== null && "code" in err
          ? (err as { code?: unknown }).code
          : undefined;
      res.status(500).json({
        message:
          err instanceof Error && err.message.startsWith("Starter template")
            ? `${err.message}. No partial project was saved.`
            : errorCode === "23505"
              ? "A starter element conflicts with existing model data. No partial project was saved."
            : "Starter project could not be created. No partial project was saved.",
      });
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
      const project = await storage.updateProject(id, input);
      res.json(project);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: err.errors[0].message });
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

  app.post(api.projects.export.path, async (req, res) => {
    const projectId = Number(req.params.id);
    try {
      const options = api.projects.export.input.parse(req.body ?? {});
      const exportData = await storage.getProjectExportData(projectId);
      const safeName = exportData.project.name.replace(/[^a-z0-9-_]+/gi, "_");
      const selectedViewIds = options.viewIds
        ? new Set(options.viewIds)
        : null;
      const selectedViews = exportData.views.filter(
        (view) => !selectedViewIds || selectedViewIds.has(view.id),
      );
      const modelKind =
        exportData.project.projectType === "metamodel"
          ? "metamodel"
          : exportData.project.projectType === "instance"
            ? "instance-model"
            : "method-model";

      if (options.format === "elements-csv") {
        const rows = selectedViews.flatMap((view) =>
          view.nodes.map((node) => {
            const data = (node.data ?? {}) as Record<string, unknown>;
            return [
              view.id,
              view.name,
              node.id,
              data.label,
              node.type,
              data.type,
              data.typeId,
              data.description,
              node.position?.x,
              node.position?.y,
              data.attributes,
            ];
          }),
        );
        const payload = toCsv(
          [
            "view_id",
            "view_name",
            "element_id",
            "name",
            "node_kind",
            "type",
            "type_id",
            "description",
            "position_x",
            "position_y",
            "attributes",
          ],
          rows,
        );
        const filename = `${modelKind}-${safeName}-elements-${Date.now()}.csv`;
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        return res.status(200).send(payload);
      }

      if (options.format === "relationships-csv") {
        const rows = selectedViews.flatMap((view) =>
          view.edges.map((edge) => {
            const data = (edge.data ?? {}) as Record<string, unknown>;
            return [
              view.id,
              view.name,
              edge.id,
              edge.source,
              edge.target,
              data.label,
              data.edgeType ?? edge.edgeType,
              data.flowType,
              data.description,
              data.multiplicity,
              data.variability,
            ];
          }),
        );
        const payload = toCsv(
          [
            "view_id",
            "view_name",
            "relationship_id",
            "source_id",
            "target_id",
            "label",
            "relationship_type",
            "flow_type",
            "description",
            "multiplicity",
            "variability",
          ],
          rows,
        );
        const filename = `${modelKind}-${safeName}-relationships-${Date.now()}.csv`;
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        return res.status(200).send(payload);
      }

      const serializeViews = (viewRows: typeof selectedViews) =>
        viewRows.map((view) => {
          const { nodes, edges, ...viewDetails } = view;
          return {
            ...viewDetails,
            ...(options.includeElements ? { nodes } : {}),
            ...(options.includeRelationships ? { edges } : {}),
          };
        });
      const patterns = options.includePatterns
        ? await Promise.all(
            (await storage.getPatterns(projectId)).map(async (pattern) => ({
              ...pattern,
              ...(await storage.getFlow(pattern.id)),
            })),
          )
        : undefined;
      const referencedMetamodels =
        options.includeReferencedMetamodels &&
        exportData.project.projectType === "instance"
          ? await Promise.all(
              ((exportData.project.referencedMetamodels ?? []) as number[]).map(
                async (metamodelId) => {
                  const metamodel = await storage.getProjectExportData(metamodelId);
                  return {
                    project: metamodel.project,
                    views: serializeViews(metamodel.views),
                  };
                },
              ),
            )
          : undefined;
      const payload = JSON.stringify(
        {
          export: {
            version: 1,
            generatedAt: new Date().toISOString(),
            kind: modelKind,
          },
          project: options.includeProjectDetails
            ? exportData.project
            : {
                id: exportData.project.id,
                name: exportData.project.name,
                projectType: exportData.project.projectType,
              },
          views: serializeViews(selectedViews),
          ...(patterns ? { patterns: serializeViews(patterns) } : {}),
          ...(referencedMetamodels ? { referencedMetamodels } : {}),
        },
        null,
        2,
      );
      const filename = `${modelKind}-${safeName}-${Date.now()}.json`;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.status(200).send(payload);
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

  // Internal Views
  app.get(api.internalViews.list.path, async (req, res) => {
    const projectId = Number(req.params.projectId);
    const views = await storage.getInternalViews(projectId);
    res.json(views);
  });

  app.get(api.internalViews.get.path, async (req, res) => {
    const nodeId = String(req.params.nodeId);
    const view = await storage.getInternalViewByNodeId(nodeId);
    if (!view) return res.json(null);
    res.json(view);
  });

  app.post(api.internalViews.create.path, async (req, res) => {
    try {
      const nodeId = String(req.params.nodeId);
      const input = api.internalViews.create.input.parse(req.body ?? {});
      const view = await storage.createInternalViewForNode(nodeId, input);
      res.json(view);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: err.errors[0].message });
      } else if (err instanceof Error && err.message.includes("Node not found")) {
        res.status(404).json({ message: err.message });
      } else {
        throw err;
      }
    }
  });

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

  // Flow
  app.get(api.flow.get.path, async (req, res) => {
    const viewId = Number(req.params.viewId);
    const view = await storage.getView(viewId);
    if (!view) return res.status(404).json({ message: "View not found" });
    try {
      const flow = await storage.getFlow(viewId);
      res.json(flow);
    } catch (err) {
      if (err instanceof z.ZodError) {
        console.error("Saved flow failed validation:", err.errors[0]?.message);
        return res.status(422).json({
          message:
            "This diagram contains invalid saved data. Refresh and try again, or contact support if the problem continues.",
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
      await storage.syncFlow(viewId, input.nodes, input.edges);
      res.json({ success: true });
    } catch (err) {
       if (err instanceof z.ZodError) {
        res.status(400).json({ message: err.errors[0].message });
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

  app.post(api.flow.insertPattern.path, async (req, res) => {
    try {
      const viewId = Number(req.params.viewId);
      const patternId = Number(req.params.patternId);
      const input = api.flow.insertPattern.input.parse(req.body);
      await storage.insertPatternIntoView(viewId, patternId, input.position);
      res.json({ success: true });
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: err.errors[0].message });
      } else if (err instanceof Error && err.message.includes("not found")) {
        res.status(404).json({ message: err.message });
      } else {
        throw err;
      }
    }
  });

  // Terminal handler for /api/*: must be registered after every real route
  // above and before the SPA/vite catch-all (server/index.ts), so unmatched
  // /api paths return JSON instead of falling through to index.html.
  const apiRoutePatterns = collectApiRoutePatterns(api);
  app.use((req, res, next) => {
    if (!req.path.startsWith("/api")) return next();
    const matches = apiRoutePatterns.filter((route) => route.regex.test(req.path));
    if (matches.length === 0) {
      return res.status(404).json({ message: "Not Found", path: req.path, method: req.method });
    }
    const allowed = Array.from(new Set(matches.map((route) => route.method)));
    res.set("Allow", allowed.join(", "));
    return res.status(405).json({
      message: "Method Not Allowed",
      path: req.path,
      method: req.method,
      allowed,
    });
  });

  return httpServer;
}
