import type { ProjectTemplateSummary } from "@shared/project-file";

/*
 * Project templates offered when creating a project. The templates themselves
 * are project files on the server (GET /api/project-templates); "Blank
 * project" is the one choice that creates an empty project instead.
 */

export const BLANK_TEMPLATE_ID = "blank";

export type ProjectTemplateOption = Pick<
  ProjectTemplateSummary,
  "id" | "name" | "description" | "projectType" | "projectName" | "projectDescription" | "metamodelSetup"
> & { includedMetamodels: string[] };

export const BLANK_TEMPLATE: ProjectTemplateOption = {
  id: BLANK_TEMPLATE_ID,
  name: "Blank project",
  description: "Start with an empty project and shape it your way.",
  projectType: "metamodel",
  projectName: "",
  projectDescription: "",
  metamodelSetup: null,
  includedMetamodels: [],
};

/** Blank first, then the server's templates. */
export function withBlankTemplate(templates: ProjectTemplateSummary[] | undefined): ProjectTemplateOption[] {
  return [BLANK_TEMPLATE, ...(templates ?? [])];
}

export function findProjectTemplate(templates: ProjectTemplateOption[], id: string) {
  return templates.find((template) => template.id === id) ?? BLANK_TEMPLATE;
}
