import type { Project } from "@shared/schema";
import { isTutorialTemplate, type TutorialDefinition } from "@shared/tutorial";
import { storage } from "../storage";
import { createProjectFromTemplate } from "./project-templates";

export interface CreatedTutorial {
  metamodel: Project;
  instance: Project;
  metamodelViewId: number;
  instanceViewId: number;
}

/**
 * Creates the two projects of a tutorial from its project template: a
 * metamodel and an instance model that references it and whose elements are
 * typed by the metamodel's types.
 */
export async function createTutorial(userId: number, tutorial: TutorialDefinition): Promise<CreatedTutorial> {
  const result = await createProjectFromTemplate(tutorial.templateId, userId);
  const created = Array.from(result.projects.entries());
  const [metamodelFileId, metamodel] = created.find(([, p]) => p.projectType === "metamodel")!;
  const [instanceFileId, instance] = created.find(([, p]) => p.projectType === "instance")!;
  return {
    metamodel,
    instance,
    metamodelViewId: result.firstViewIds.get(metamodelFileId)!,
    instanceViewId: result.firstViewIds.get(instanceFileId)!,
  };
}

/**
 * Deletes the user's projects of one tutorial, or of all tutorials when none
 * is given. Returns how many were removed.
 */
export async function deleteTutorial(userId: number, tutorial?: TutorialDefinition): Promise<number> {
  const projects = await storage.getProjectsByUser(userId);
  const tutorialProjects = projects.filter((project) =>
    tutorial ? project.templateId === tutorial.templateId : isTutorialTemplate(project.templateId),
  );
  // Instance first, so it never references a deleted metamodel.
  tutorialProjects.sort((a) => (a.projectType === "instance" ? -1 : 1));
  for (const project of tutorialProjects) await storage.deleteProject(project.id);
  return tutorialProjects.length;
}
