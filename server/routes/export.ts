import type { Express } from "express";
import { z } from "zod";
import { api } from "@shared/routes";
import { storage } from "../storage";

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

export function registerExportRoutes(app: Express) {
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

}
