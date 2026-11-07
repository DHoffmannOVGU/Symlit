import type { Project } from "@shared/schema";
import type { ProjectExportOptions } from "@shared/routes";
import { storage } from "../storage";

/**
 * Quotes a CSV cell. Cells that a spreadsheet would evaluate as a formula
 * (starting with =, +, -, @, tab or carriage return) are prefixed with an
 * apostrophe so opening an export cannot run injected formulas.
 */
export function csvCell(value: unknown): string {
  let text =
    value === null || value === undefined
      ? ""
      : typeof value === "string"
        ? value
        : JSON.stringify(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}

export interface ProjectExportFile {
  filename: string;
  contentType: string;
  body: string;
}

/**
 * Builds a project export as JSON or CSV. `canRead` decides whether a
 * referenced metamodel may be included; inaccessible ones are left out.
 */
export async function buildProjectExport(
  projectId: number,
  options: ProjectExportOptions,
  canRead: (project: Project) => Promise<boolean>,
): Promise<ProjectExportFile> {
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
    return { filename, contentType: "text/csv; charset=utf-8", body: payload };
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
    return { filename, contentType: "text/csv; charset=utf-8", body: payload };
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
  // Referenced metamodels are collected recursively (a metamodel can build on
  // another one), each once, skipping deleted or unreadable projects.
  const collectReferencedMetamodels = async () => {
    const visited = new Set<number>([projectId]);
    const collected: Array<{ project: Project; views: ReturnType<typeof serializeViews> }> = [];
    const queue = [...((exportData.project.referencedMetamodels ?? []) as number[])];
    while (queue.length > 0) {
      const metamodelId = queue.shift()!;
      if (visited.has(metamodelId)) continue;
      visited.add(metamodelId);
      const target = await storage.getProject(metamodelId);
      if (!target || target.projectType !== "metamodel" || !(await canRead(target))) continue;
      const metamodel = await storage.getProjectExportData(metamodelId);
      collected.push({ project: metamodel.project, views: serializeViews(metamodel.views) });
      queue.push(...((target.referencedMetamodels ?? []) as number[]));
    }
    return collected;
  };
  const referencedMetamodels =
    options.includeReferencedMetamodels && exportData.project.projectType === "instance"
      ? await collectReferencedMetamodels()
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
      ...(referencedMetamodels
        ? { referencedMetamodels }
        : {}),
    },
    null,
    2,
  );
  const filename = `${modelKind}-${safeName}-${Date.now()}.json`;
  return { filename, contentType: "application/json; charset=utf-8", body: payload };
}
