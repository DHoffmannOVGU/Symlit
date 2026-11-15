import type { Project } from "@shared/schema";
import { tutorialForTemplate, type TutorialDefinition } from "@shared/tutorial";

const isMetamodelOf = (tutorial: TutorialDefinition) => (project: Project) =>
  project.templateId === tutorial.templateId && project.projectType === "metamodel";
const isInstanceOf = (tutorial: TutorialDefinition) => (project: Project) =>
  project.templateId === tutorial.templateId && project.projectType === "instance";

/** The metamodel and instance project of one tutorial run. */
export interface TutorialProjects {
  tutorial: TutorialDefinition;
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
  const tutorial = tutorialForTemplate(project.templateId);
  if (!tutorial) return null;
  const isMetamodel = isMetamodelOf(tutorial);
  const isInstance = isInstanceOf(tutorial);
  const metamodel = isMetamodel(project)
    ? project
    : isInstance(project)
      ? allProjects.find(
          (candidate) => isMetamodel(candidate) && (project.referencedMetamodels ?? []).includes(candidate.id),
        )
      : undefined;
  if (!metamodel) return null;
  const instance = allProjects.find(
    (candidate) => isInstance(candidate) && (candidate.referencedMetamodels ?? []).includes(metamodel.id),
  );
  return { tutorial, metamodel, instance };
}

/** The most recently created run of a tutorial among the user's projects, if any. */
export function latestTutorialRun(
  tutorial: TutorialDefinition,
  allProjects: Project[] | undefined,
): TutorialProjects | null {
  const metamodels = (allProjects ?? []).filter(isMetamodelOf(tutorial)).sort((a, b) => b.id - a.id);
  return metamodels.length ? findTutorialProjects(metamodels[0], allProjects) : null;
}
