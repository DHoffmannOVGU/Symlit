import type { Project } from "@shared/schema";
import {
  isTutorialTemplate,
  TUTORIAL_EXTRA_SUFFIX,
  tutorialForTemplate,
  type TutorialDefinition,
} from "@shared/tutorial";
import { storage } from "../storage";
import { createProjectFromTemplate } from "./project-templates";

export interface CreatedTutorial {
  metamodel: Project;
  instance: Project;
  metamodelViewId: number;
  instanceViewId: number;
}

/**
 * Creates the projects of a tutorial from its project template: a metamodel
 * and an instance model that references it and whose elements are typed by
 * the metamodel's types. The first metamodel in the template is the
 * tutorial's metamodel; further ones (a second metamodel the learner adds to
 * the model later) are marked as extras, so the run can be told apart.
 */
export async function createTutorial(userId: number, tutorial: TutorialDefinition): Promise<CreatedTutorial> {
  const result = await createProjectFromTemplate(tutorial.templateId, userId);
  const created = Array.from(result.projects.entries());
  const [metamodelFileId, metamodel] = created.find(([, p]) => p.projectType === "metamodel")!;
  const [instanceFileId, instance] = created.find(([, p]) => p.projectType === "instance")!;
  for (const [, project] of created) {
    if (project.id === metamodel.id || project.id === instance.id) continue;
    await storage.updateProject(project.id, { templateId: `${tutorial.templateId}${TUTORIAL_EXTRA_SUFFIX}` });
  }
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
    tutorial ? tutorialForTemplate(project.templateId) === tutorial : isTutorialTemplate(project.templateId),
  );
  // Models the learner made during the tutorial that use its metamodels (copies
  // of its model): without the metamodels they would be left broken.
  const metamodelIds = new Set(
    tutorialProjects.filter((project) => project.projectType === "metamodel").map((project) => project.id),
  );
  const variants = projects.filter(
    (project) =>
      !tutorialProjects.includes(project) &&
      project.projectType === "instance" &&
      ((project.referencedMetamodels as number[] | null) ?? []).some((id) => metamodelIds.has(id)),
  );
  tutorialProjects.push(...variants);
  // Models first, so none ever references a deleted metamodel.
  const order = (project: Project) => (project.projectType === "instance" ? 0 : 1);
  tutorialProjects.sort((a, b) => order(a) - order(b));
  for (const project of tutorialProjects) await storage.deleteProject(project.id);
  return tutorialProjects.length;
}
