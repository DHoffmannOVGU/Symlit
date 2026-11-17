import type { Project } from "@shared/schema";
import {
  isTutorialExtra,
  tutorialForTemplate,
  worksInCopies,
  type TutorialDefinition,
  type TutorialWorkspaceState,
} from "@shared/tutorial";

const isMetamodelOf = (tutorial: TutorialDefinition) => (project: Project) =>
  project.templateId === tutorial.templateId && project.projectType === "metamodel";
const isInstanceOf = (tutorial: TutorialDefinition) => (project: Project) =>
  project.templateId === tutorial.templateId && project.projectType === "instance";
const isExtraOf = (tutorial: TutorialDefinition) => (project: Project) =>
  isTutorialExtra(project.templateId) && tutorialForTemplate(project.templateId) === tutorial;

/** The projects of one tutorial run. */
export interface TutorialProjects {
  tutorial: TutorialDefinition;
  /** The tutorial's metamodel. The run is identified by it. */
  metamodel: Project;
  /** The tutorial's model. */
  instance: Project | undefined;
  /** Further projects the tutorial created, such as a second metamodel. */
  extras: Project[];
  /** Models the learner made that use the tutorial's metamodels, newest first. */
  variants: Project[];
}

/** Models that use one of the given metamodels and are not the run's own. */
const variantsOf = (metamodelIds: number[], own: number[], allProjects: Project[]) =>
  allProjects
    .filter(
      (candidate) =>
        candidate.projectType === "instance" &&
        !own.includes(candidate.id) &&
        ((candidate.referencedMetamodels as number[] | null) ?? []).some((id) => metamodelIds.includes(id)),
    )
    .sort((a, b) => b.id - a.id);

/**
 * Finds the tutorial run a project belongs to. A run's projects are created
 * together and in order: the metamodel, then any extra projects, then the
 * model. So they are the tutorial's projects between one metamodel and the next.
 */
export function findTutorialProjects(
  project: Project | undefined,
  allProjects: Project[] | undefined,
): TutorialProjects | null {
  if (!project || !allProjects) return null;
  const tutorial = tutorialForTemplate(project.templateId);
  if (!tutorial) {
    // A model the learner made from a tutorial's model, which still uses its
    // metamodel, belongs to that tutorial's run when the tutorial has steps there.
    const used = (project.referencedMetamodels as number[] | null) ?? [];
    const metamodelOfTutorial = allProjects.find(
      (candidate) =>
        used.includes(candidate.id) &&
        candidate.projectType === "metamodel" &&
        !!tutorialForTemplate(candidate.templateId) &&
        worksInCopies(tutorialForTemplate(candidate.templateId)!),
    );
    return metamodelOfTutorial && project.projectType === "instance"
      ? findTutorialProjects(metamodelOfTutorial, allProjects)
      : null;
  }
  const metamodels = allProjects.filter(isMetamodelOf(tutorial)).sort((a, b) => a.id - b.id);
  // The run's metamodel is the last one created at or before this project.
  const metamodel = [...metamodels].reverse().find((candidate) => candidate.id <= project.id);
  if (!metamodel) return null;
  const nextRun = metamodels.find((candidate) => candidate.id > metamodel.id);
  const inRun = (candidate: Project) =>
    candidate.id > metamodel.id && (nextRun === undefined || candidate.id < nextRun.id);
  const instance = allProjects.filter(isInstanceOf(tutorial)).find(inRun);
  const extras = allProjects.filter(isExtraOf(tutorial)).filter(inRun);
  const metamodelIds = [metamodel.id, ...extras.filter((extra) => extra.projectType === "metamodel").map((extra) => extra.id)];
  const own = [metamodel.id, ...(instance ? [instance.id] : []), ...extras.map((extra) => extra.id)];
  return {
    tutorial,
    metamodel,
    instance,
    extras,
    variants: worksInCopies(tutorial) ? variantsOf(metamodelIds, own, allProjects) : [],
  };
}

/** The most recently created run of a tutorial among the user's projects, if any. */
export function latestTutorialRun(
  tutorial: TutorialDefinition,
  allProjects: Project[] | undefined,
): TutorialProjects | null {
  const metamodels = (allProjects ?? []).filter(isMetamodelOf(tutorial)).sort((a, b) => b.id - a.id);
  return metamodels.length ? findTutorialProjects(metamodels[0], allProjects) : null;
}

/** The project list as a tutorial step sees it. */
export function tutorialWorkspaceState(
  run: TutorialProjects,
  allProjects: Project[] | undefined,
): TutorialWorkspaceState {
  const own = new Set([run.metamodel.id, run.instance?.id, ...run.extras.map((extra) => extra.id)]);
  return {
    tutorialMetamodels: [
      run.metamodel.id,
      ...run.extras.filter((extra) => extra.projectType === "metamodel").map((extra) => extra.id),
    ],
    projects: (allProjects ?? []).map((project) => ({
      id: project.id,
      name: project.name,
      kind: project.projectType === "metamodel" ? "metamodel" : "instance",
      templateId: project.templateId ?? null,
      metamodels: (project.referencedMetamodels as number[] | null) ?? [],
      ofTutorial: own.has(project.id),
    })),
  };
}
