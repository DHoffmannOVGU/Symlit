import { projectFileSchema, type ProjectFile, type ProjectTemplateSummary } from "@shared/project-file";
import type { MetamodelSetup } from "@shared/metamodel-setup";
import requirementsBaseline from "../templates/requirements-baseline.json";
import systemContext from "../templates/system-context.json";
import tutorial from "../templates/tutorial.json";
import tutorialPpr from "../templates/tutorial-ppr.json";
import { importProjectFile, ProjectFileError } from "./project-import";

/*
 * Built-in project templates: project files (the export format) shipped in
 * server/templates/. Creating a project from one imports the file and
 * records the template's id on every created project. See
 * docs/decisions/project-templates.md.
 */

const BUILT_IN: unknown[] = [systemContext, requirementsBaseline, tutorial, tutorialPpr];

const templates: Array<ProjectFile & { template: NonNullable<ProjectFile["template"]> }> =
  BUILT_IN.map((raw) => {
    const file = projectFileSchema.parse(raw);
    if (!file.template) throw new Error(`Built-in template ${file.project.name} has no template info`);
    return { ...file, template: file.template };
  });

export function getProjectTemplateFile(id: string) {
  return templates.find((file) => file.template.id === id);
}

/** The templates offered when creating a project. */
export function listProjectTemplates(): ProjectTemplateSummary[] {
  return templates
    .filter((file) => file.template.listed)
    .map((file) => ({
      ...file.template,
      projectType: file.project.projectType,
      projectName: file.project.name,
      projectDescription: file.project.description ?? "",
      metamodelSetup: file.project.metamodelSetup ?? null,
      includedMetamodels: (file.referencedMetamodels ?? []).map((entry) => entry.project.name),
    }));
}

export async function createProjectFromTemplate(
  id: string,
  userId: number,
  main?: { name?: string; description?: string; metamodelSetup?: MetamodelSetup | null },
) {
  const file = getProjectTemplateFile(id);
  if (!file) throw Object.assign(new ProjectFileError("Project template not found"), { status: 404 });
  return importProjectFile(file, { userId, templateId: id, main });
}
