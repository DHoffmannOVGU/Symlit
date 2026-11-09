import type { Project } from "@shared/schema";
import { TUTORIAL_TEMPLATE } from "@shared/tutorial";

const isTutorialMetamodel = (project: Project) =>
  project.templateId === TUTORIAL_TEMPLATE && project.projectType === "metamodel";
const isTutorialInstance = (project: Project) =>
  project.templateId === TUTORIAL_TEMPLATE && project.projectType === "instance";

/** The metamodel and instance project of one tutorial run. */
export interface TutorialProjects {
  metamodel: Project;
  instance: Project | undefined;
}

/**
 * Finds the tutorial run a project belongs to. A run is identified by its
 * metamodel; the instance model is the tutorial project referencing it.
 */
export function findTutorialProjects(
  project: Project | undefined,
  allProjects: Project[] | undefined,
): TutorialProjects | null {
  if (!project || !allProjects) return null;
  const metamodel =
    isTutorialMetamodel(project)
      ? project
      : isTutorialInstance(project)
        ? allProjects.find(
            (candidate) =>
              isTutorialMetamodel(candidate) &&
              (project.referencedMetamodels ?? []).includes(candidate.id),
          )
        : undefined;
  if (!metamodel) return null;
  const instance = allProjects.find(
    (candidate) =>
      isTutorialInstance(candidate) &&
      (candidate.referencedMetamodels ?? []).includes(metamodel.id),
  );
  return { metamodel, instance };
}


/** The most recently created tutorial run among the user's projects, if any. */
export function latestTutorialRun(allProjects: Project[] | undefined): TutorialProjects | null {
  const metamodels = (allProjects ?? [])
    .filter(isTutorialMetamodel)
    .sort((a, b) => b.id - a.id);
  return metamodels.length ? findTutorialProjects(metamodels[0], allProjects) : null;
}
