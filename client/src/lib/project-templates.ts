import type { ProjectTemplateSummary } from "@shared/project-file";
import type { ProjectType } from "@shared/schema";

/*
 * Ways to start a project: an empty metamodel or model, or a project template
 * (project files on the server, GET /api/project-templates).
 */

export const BLANK_METAMODEL = "blank-metamodel";
export const BLANK_MODEL = "blank-instance";

export interface ProjectStartOption {
  /** `blank-metamodel`, `blank-instance` or a template id. */
  id: string;
  name: string;
  description: string;
  projectType: ProjectType;
  /** Set for templates: the name and description they suggest. */
  template?: Pick<ProjectTemplateSummary, "projectName" | "projectDescription" | "includedMetamodels">;
}

export const BLANK_OPTIONS: ProjectStartOption[] = [
  {
    id: BLANK_METAMODEL,
    name: "Empty metamodel",
    description: "Define the types and relationships of a domain.",
    projectType: "metamodel",
  },
  {
    id: BLANK_MODEL,
    name: "Empty model",
    description: "Model a system, using the types of a metamodel or the built-in ones.",
    projectType: "instance",
  },
];

/** The blank options first, then the server's templates. */
export function projectStartOptions(templates: ProjectTemplateSummary[] | undefined): ProjectStartOption[] {
  return [
    ...BLANK_OPTIONS,
    ...(templates ?? []).map((template) => ({
      id: template.id,
      name: template.name,
      description: template.description,
      projectType: template.projectType,
      template: {
        projectName: template.projectName,
        projectDescription: template.projectDescription,
        includedMetamodels: template.includedMetamodels,
      },
    })),
  ];
}

export const isBlankStart = (id: string) => id === BLANK_METAMODEL || id === BLANK_MODEL;
