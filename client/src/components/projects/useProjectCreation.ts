import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import type { MetamodelSetup } from "@shared/metamodel-setup";
import type { Project, ProjectType } from "@shared/schema";
import { apiCall } from "@/lib/api-client";

/** What the create dialog asks for. */
export type CreateProjectRequest =
  | {
      kind: "blank";
      projectType: ProjectType;
      name: string;
      description: string;
      metamodelSetup: MetamodelSetup | null;
      /** Instance models: the metamodel whose types the model uses. */
      basedOn: number | null;
    }
  | {
      kind: "template";
      templateId: string;
      name: string;
      description: string;
    };

export interface CreatedProject {
  project: Project;
  firstViewId: number | null;
  /** Further projects created along (metamodels a template brings). */
  alongside: Project[];
}

/** The first diagram of a blank project, so it opens ready to model. */
export const FIRST_DIAGRAM_NAME = "Main";

/**
 * Creating projects: blank (with a first diagram), from a template, or as a
 * copy of an existing project.
 */
export function useProjectCreation() {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: [api.projects.list.path] });

  const create = useMutation({
    mutationFn: async (request: CreateProjectRequest): Promise<CreatedProject> => {
      if (request.kind === "template") {
        const result = await apiCall(api.projectTemplates.create, {
          params: { templateId: request.templateId },
          body: { name: request.name, description: request.description },
        });
        return {
          project: result.project,
          firstViewId: result.firstViewId,
          alongside: result.projects.filter((project) => project.id !== result.project.id),
        };
      }
      const project = await apiCall(api.projects.create, {
        body: {
          name: request.name,
          description: request.description,
          projectType: request.projectType,
          metamodelSetup: request.projectType === "metamodel" ? request.metamodelSetup : null,
          ...(request.projectType === "instance" && request.basedOn
            ? { referencedMetamodels: [request.basedOn] }
            : {}),
        },
      });
      const view = await apiCall(api.views.create, {
        params: { projectId: project.id },
        body: { name: FIRST_DIAGRAM_NAME },
      });
      return { project, firstViewId: view.id, alongside: [] };
    },
    onSuccess: refresh,
  });

  const duplicate = useMutation({
    mutationFn: async (project: Project): Promise<CreatedProject> => {
      const result = await apiCall(api.projects.duplicate, { params: { id: project.id }, body: {} });
      return { ...result, alongside: [] };
    },
    onSuccess: refresh,
  });

  return { create, duplicate };
}
