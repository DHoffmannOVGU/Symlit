/**
 * The guided tutorials. Each creates a metamodel and a model that uses it
 * from a project template, and guides through lessons in the two projects.
 */
import { BASICS_TUTORIAL } from "./tutorial-basics";
import { CALC_TUTORIAL } from "./tutorial-calc";
import { CLASSIFY_TUTORIAL } from "./tutorial-classify";
import { PPR_TUTORIAL } from "./tutorial-ppr";
import { REUSE_TUTORIAL } from "./tutorial-reuse";
import { STRUCTURE_TUTORIAL } from "./tutorial-structure";
import type { TutorialDefinition } from "./tutorial-types";

export * from "./tutorial-types";

/** In the order they are offered. */
export const TUTORIALS: TutorialDefinition[] = [BASICS_TUTORIAL, PPR_TUTORIAL, CALC_TUTORIAL, CLASSIFY_TUTORIAL, STRUCTURE_TUTORIAL, REUSE_TUTORIAL];

export const DEFAULT_TUTORIAL = BASICS_TUTORIAL;

export const findTutorial = (id: string | null | undefined) =>
  TUTORIALS.find((tutorial) => tutorial.id === id);

/**
 * Projects a tutorial creates beyond its metamodel and its model (a second
 * metamodel, for example) carry the tutorial's template id with this suffix.
 */
export const TUTORIAL_EXTRA_SUFFIX = "+extra";

const baseTemplateId = (templateId: string | null | undefined) =>
  templateId?.endsWith(TUTORIAL_EXTRA_SUFFIX) ? templateId.slice(0, -TUTORIAL_EXTRA_SUFFIX.length) : templateId;

/** The tutorial a project belongs to, by the template it was created from. */
export const tutorialForTemplate = (templateId: string | null | undefined) =>
  TUTORIALS.find((tutorial) => tutorial.templateId === baseTemplateId(templateId));

export const isTutorialTemplate = (templateId: string | null | undefined) =>
  tutorialForTemplate(templateId) !== undefined;

/** The project is one a tutorial created in addition to its metamodel and its model. */
export const isTutorialExtra = (templateId: string | null | undefined) =>
  !!templateId?.endsWith(TUTORIAL_EXTRA_SUFFIX) && isTutorialTemplate(templateId);

export const tutorialSteps = (tutorial: TutorialDefinition) =>
  tutorial.lessons.flatMap((lesson) => lesson.steps);

/** The tutorial has steps in a copy of its model that the learner makes. */
export const worksInCopies = (tutorial: TutorialDefinition) =>
  tutorial.lessons.some((lesson) => lesson.steps.some((step) => step.scope === "variant"));

interface ProjectLike {
  id: number;
  projectType: string;
  templateId: string | null;
  referencedMetamodels?: number[] | null;
}

/**
 * The projects removing a tutorial deletes (all tutorials when none is
 * given): every project it created and, for a tutorial that works in copies
 * of its model, the models that use its metamodels, which would be left
 * without their types. Models come first: deleted in this order, no model
 * ever uses a deleted metamodel.
 */
export function projectsRemovedWithTutorial<P extends ProjectLike>(projects: P[], tutorial?: TutorialDefinition): P[] {
  const created = projects.filter((project) => {
    const of = tutorialForTemplate(project.templateId);
    return of !== undefined && (!tutorial || of === tutorial);
  });
  const copiedFrom = new Set(
    created
      .filter((project) => project.projectType === "metamodel" && worksInCopies(tutorialForTemplate(project.templateId)!))
      .map((project) => project.id),
  );
  const copies = projects.filter(
    (project) =>
      !created.includes(project) &&
      project.projectType === "instance" &&
      (project.referencedMetamodels ?? []).some((id) => copiedFrom.has(id)),
  );
  const order = (project: P) => (project.projectType === "instance" ? 0 : 1);
  return [...created, ...copies].sort((a, b) => order(a) - order(b));
}
