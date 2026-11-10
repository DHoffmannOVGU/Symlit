import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { normalizeMetamodelSetup, type MetamodelSetup } from "@shared/metamodel-setup";
import { projectFileSchema, type ProjectFile } from "@shared/project-file";
import { normalizeRelationship } from "@shared/relationships";
import { edges, nodes, nodeViews, projects, views, type Project } from "@shared/schema";
import type { ModelRule } from "@shared/contracts";
import { db } from "../db";

/*
 * Imports a Symlit project file (docs/decisions/project-templates.md):
 * every project in the bundle is created in one transaction, with fresh ids.
 * Everything that points at something else in the file is rewired to the
 * new ids: metamodel references, element types (`mm:<project>:<element>`),
 * metamodel elements placed in instance diagrams, nesting, relationships,
 * model rules and pattern origins. An element that appears in several
 * diagrams stays one element.
 */

export class ProjectFileError extends Error {
  readonly status = 400;
}

export interface ImportOptions {
  userId: number;
  /** Recorded on every created project (where it came from). */
  templateId?: string | null;
  /** Overrides for the main project (the one the file is about). */
  main?: { name?: string; description?: string; metamodelSetup?: MetamodelSetup | null };
  /**
   * Metamodels outside the file that the imported projects may keep
   * referencing as they are (duplicating a model keeps using its metamodels).
   * The caller checks that the user may use them. Their elements placed in
   * the file's diagrams stay the existing elements.
   */
  existingMetamodels?: number[];
}

export interface ImportResult {
  /** The main project. */
  project: Project;
  /** Its first diagram, if any. */
  firstViewId: number | null;
  /** All created projects, keyed by their id in the file. */
  projects: Map<number, Project>;
  /** The first diagram of each created project, keyed by its id in the file. */
  firstViewIds: Map<number, number | null>;
}

type Bundled = Pick<ProjectFile, "project" | "views" | "patterns">;
type FileView = ProjectFile["views"][number];

export async function importProjectFile(raw: unknown, options: ImportOptions): Promise<ImportResult> {
  const parsed = projectFileSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.errors[0];
    throw new ProjectFileError(`Not a valid project file: ${issue.path.join(".")} ${issue.message}`);
  }
  const file = parsed.data;
  // Referenced metamodels first, so they exist when the main project refers to them.
  const bundle: Bundled[] = [...(file.referencedMetamodels ?? []), file];
  const fileProjectIds = new Set(bundle.map((entry) => entry.project.id));
  if (fileProjectIds.size !== bundle.length) {
    throw new ProjectFileError("A project appears twice in the file");
  }
  const kindOf = new Map(bundle.map((entry) => [entry.project.id, entry.project.projectType]));
  const existing = new Set(options.existingMetamodels ?? []);
  for (const id of Array.from(existing)) {
    if (fileProjectIds.has(id)) existing.delete(id);
  }
  for (const { project } of bundle) {
    for (const ref of project.referencedMetamodels ?? []) {
      if (kindOf.get(ref) !== "metamodel" && !existing.has(ref)) {
        throw new ProjectFileError(
          `"${project.name}" references a metamodel that is not in the file`,
        );
      }
    }
  }

  // Elements: one fresh id per element id in the file. Ids are global, so an
  // element shown in several diagrams (or a metamodel element placed in an
  // instance diagram) is the same element everywhere.
  const elementIds = new Map<string, string>();
  const elementOwner = new Map<string, number>();
  const elementRecord = new Map<string, { type: string; data: Record<string, unknown> }>();
  const diagramsOf = (entry: Bundled) => [...entry.views, ...(entry.patterns ?? [])];
  for (const entry of bundle) {
    for (const view of diagramsOf(entry)) {
      for (const node of view.nodes) {
        const owner = node.projectId ?? entry.project.id;
        if (existing.has(owner)) {
          // An element of an existing metamodel: placed, not copied.
          elementIds.set(node.id, node.id);
          elementOwner.set(node.id, owner);
          continue;
        }
        if (!fileProjectIds.has(owner)) {
          throw new ProjectFileError(`Element ${node.id} belongs to a project that is not in the file`);
        }
        const known = elementOwner.get(node.id);
        if (known !== undefined && known !== owner) {
          throw new ProjectFileError(`Element ${node.id} is claimed by two projects`);
        }
        elementOwner.set(node.id, owner);
        if (!elementIds.has(node.id)) elementIds.set(node.id, `node_${randomUUID()}`);
        // The owner's own diagrams hold the element's data.
        if (!elementRecord.has(node.id) || owner === entry.project.id) {
          elementRecord.set(node.id, { type: node.type ?? "default", data: node.data ?? {} });
        }
      }
    }
  }

  return db.transaction(async (tx) => {
    const created = new Map<number, Project>();
    for (const entry of bundle) {
      const isMain = entry === file;
      const source = entry.project;
      const [project] = await tx
        .insert(projects)
        .values({
          userId: options.userId,
          name: (isMain && options.main?.name) || source.name,
          description: isMain && options.main?.description !== undefined
            ? options.main.description
            : (source.description ?? ""),
          projectType: source.projectType,
          templateId: options.templateId ?? null,
          metamodelSetup:
            source.projectType !== "metamodel"
              ? null
              : isMain && options.main?.metamodelSetup !== undefined
                ? options.main.metamodelSetup
                : source.metamodelSetup
                  ? normalizeMetamodelSetup(source.metamodelSetup)
                  : null,
        })
        .returning();
      created.set(source.id, project);
    }
    const newProjectId = (fileId: number) => created.get(fileId)?.id ?? fileId;

    for (const { project } of bundle) {
      const refs = project.referencedMetamodels ?? [];
      if (refs.length === 0) continue;
      await tx
        .update(projects)
        .set({ referencedMetamodels: refs.map(newProjectId) })
        .where(eq(projects.id, newProjectId(project.id)));
    }

    /** Rewires a type reference: `mm:<project>:<element>` or a plain element id. */
    const remapType = (value: unknown) => {
      if (typeof value !== "string") return value;
      const match = /^mm:(\d+):(.+)$/.exec(value);
      if (match && created.has(Number(match[1]))) {
        return `mm:${newProjectId(Number(match[1]))}:${elementIds.get(match[2]) ?? match[2]}`;
      }
      return elementIds.get(value) ?? value;
    };
    /** Rule targets (`targetType`, also inside conditions) are type references too. */
    const remapRule = (rule: ModelRule): ModelRule => {
      const walk = (value: unknown): unknown => {
        if (Array.isArray(value)) return value.map(walk);
        if (!value || typeof value !== "object") return value;
        return Object.fromEntries(
          Object.entries(value).map(([key, inner]) => [key, key === "targetType" ? remapType(inner) : walk(inner)]),
        );
      };
      return walk(rule) as ModelRule;
    };

    // Elements, once each, in the project that owns them.
    for (const [fileId, newId] of Array.from(elementIds)) {
      if (existing.has(elementOwner.get(fileId)!)) continue;
      const record = elementRecord.get(fileId)!;
      const { typeId, pattern: _origin, ...data } = record.data;
      await tx.insert(nodes).values({
        id: newId,
        projectId: newProjectId(elementOwner.get(fileId)!),
        type: record.type,
        data: { ...data, ...(typeId !== undefined ? { typeId: remapType(typeId) } : {}) },
      });
    }

    // Diagrams and patterns. Pattern origins are rewired once all exist.
    const viewIds = new Map<number, number>();
    const firstViewIds = new Map<number, number | null>();
    const origins: Array<{ elementId: string; origin: Record<string, unknown> }> = [];
    const createDiagram = async (entry: Bundled, view: FileView, viewType: "view" | "pattern") => {
      const projectId = newProjectId(entry.project.id);
      const [createdView] = await tx
        .insert(views)
        .values({
          projectId,
          name: view.name,
          description: view.description ?? null,
          viewType,
          modelRules: (view.modelRules ?? []).map(remapRule),
        })
        .returning();
      if (view.id !== undefined) viewIds.set(view.id, createdView.id);
      const inDiagram = new Set(view.nodes.map((node) => node.id));
      const placed = new Set<string>();
      for (const node of view.nodes) {
        if (placed.has(node.id)) continue;
        placed.add(node.id);
        if (node.parentId && !inDiagram.has(node.parentId)) {
          throw new ProjectFileError(`Element ${node.id} is nested in an element outside its diagram`);
        }
        await tx.insert(nodeViews).values({
          nodeId: elementIds.get(node.id)!,
          viewId: createdView.id,
          position: node.position,
          parentId: node.parentId ? elementIds.get(node.parentId)! : null,
        });
        const origin = node.data?.pattern;
        if (origin && typeof origin === "object") {
          origins.push({ elementId: elementIds.get(node.id)!, origin: origin as Record<string, unknown> });
        }
      }
      if (view.edges.length > 0) {
        await tx.insert(edges).values(
          view.edges.map((edge) => {
            if (!inDiagram.has(edge.source) || !inDiagram.has(edge.target)) {
              throw new ProjectFileError(
                `Relationship ${edge.id ?? ""} in "${view.name}" connects elements outside the diagram`.replace("  ", " "),
              );
            }
            const { pattern: _origin, ...data } = (edge.data ?? {}) as Record<string, unknown>;
            return {
              ...normalizeRelationship({ ...edge, edgeType: edge.edgeType ?? undefined, data }),
              id: `edge_${randomUUID()}`,
              viewId: createdView.id,
              source: elementIds.get(edge.source)!,
              target: elementIds.get(edge.target)!,
            };
          }),
        );
      }
      return createdView.id;
    };
    for (const entry of bundle) {
      let first: number | null = null;
      for (const view of entry.views) {
        const id = await createDiagram(entry, view, "view");
        first ??= id;
      }
      for (const pattern of entry.patterns ?? []) await createDiagram(entry, pattern, "pattern");
      firstViewIds.set(entry.project.id, first);
    }

    // Copies made from a pattern in the file keep pointing at it; origins
    // pointing outside the file are dropped (the copies stay).
    for (const { elementId, origin } of origins) {
      const patternId = viewIds.get(Number(origin.patternId));
      const projectId = created.get(Number(origin.projectId))?.id;
      if (patternId === undefined || projectId === undefined) continue;
      const [row] = await tx.select({ data: nodes.data }).from(nodes).where(eq(nodes.id, elementId));
      await tx
        .update(nodes)
        .set({
          data: {
            ...(row.data as Record<string, unknown>),
            pattern: {
              ...origin,
              patternId,
              projectId,
              elementId: elementIds.get(String(origin.elementId)) ?? origin.elementId,
            },
          },
        })
        .where(eq(nodes.id, elementId));
    }

    const [main] = await tx.select().from(projects).where(eq(projects.id, newProjectId(file.project.id)));
    for (const [fileId, project] of Array.from(created)) {
      const [current] = await tx.select().from(projects).where(eq(projects.id, project.id));
      created.set(fileId, current);
    }
    return {
      project: main,
      firstViewId: firstViewIds.get(file.project.id) ?? null,
      projects: created,
      firstViewIds,
    };
  });
}
