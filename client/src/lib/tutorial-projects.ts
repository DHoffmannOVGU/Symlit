import type { Project } from "@shared/schema";
import { TUTORIAL_INSTANCE_TEMPLATE, TUTORIAL_METAMODEL_TEMPLATE } from "@shared/tutorial";

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
    project.templateId === TUTORIAL_METAMODEL_TEMPLATE
      ? project
      : project.templateId === TUTORIAL_INSTANCE_TEMPLATE
        ? allProjects.find(
            (candidate) =>
              candidate.templateId === TUTORIAL_METAMODEL_TEMPLATE &&
              (project.referencedMetamodels ?? []).includes(candidate.id),
          )
        : undefined;
  if (!metamodel) return null;
  const instance = allProjects.find(
    (candidate) =>
      candidate.templateId === TUTORIAL_INSTANCE_TEMPLATE &&
      (candidate.referencedMetamodels ?? []).includes(metamodel.id),
  );
  return { metamodel, instance };
}


/** The most recently created tutorial run among the user's projects, if any. */
export function latestTutorialRun(allProjects: Project[] | undefined): TutorialProjects | null {
  const metamodels = (allProjects ?? [])
    .filter((project) => project.templateId === TUTORIAL_METAMODEL_TEMPLATE)
    .sort((a, b) => b.id - a.id);
  return metamodels.length ? findTutorialProjects(metamodels[0], allProjects) : null;
}
