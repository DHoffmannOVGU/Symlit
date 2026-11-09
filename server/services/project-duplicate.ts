import { storage } from "../storage";
import { buildProjectExport } from "./project-export";
import { importProjectFile, ProjectFileError } from "./project-import";

/**
 * Duplicates a project: its diagrams, elements, relationships, rules and
 * patterns, via the project file format. The copy keeps referencing the same
 * metamodels (they are not copied) and is not linked to the original.
 */
export async function duplicateProject(projectId: number, userId: number, name?: string) {
  const source = await storage.getProject(projectId);
  if (!source || source.userId !== userId) {
    throw Object.assign(new ProjectFileError("Project not found"), { status: 404 });
  }
  const file = await buildProjectExport(
    projectId,
    {
      format: "json",
      includeProjectDetails: true,
      includeElements: true,
      includeRelationships: true,
      includePatterns: true,
      includeReferencedMetamodels: false,
    },
    async () => true,
  );
  return importProjectFile(JSON.parse(file.body), {
    userId,
    // A copy is the user's own project, even when the original came from a template.
    templateId: null,
    main: { name: name?.trim() || `Copy of ${source.name}` },
    existingMetamodels: source.referencedMetamodels ?? [],
  });
}
