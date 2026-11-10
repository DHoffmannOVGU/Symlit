/**
 * The guided tutorials. Each creates a metamodel and a model that uses it
 * from a project template, and guides through lessons in the two projects.
 */
import { BASICS_TUTORIAL } from "./tutorial-basics";
import { PPR_TUTORIAL } from "./tutorial-ppr";
import type { TutorialDefinition } from "./tutorial-types";

export * from "./tutorial-types";

/** In the order they are offered. */
export const TUTORIALS: TutorialDefinition[] = [BASICS_TUTORIAL, PPR_TUTORIAL];

export const DEFAULT_TUTORIAL = BASICS_TUTORIAL;

export const findTutorial = (id: string | null | undefined) =>
  TUTORIALS.find((tutorial) => tutorial.id === id);

/** The tutorial a project belongs to, by the template it was created from. */
export const tutorialForTemplate = (templateId: string | null | undefined) =>
  TUTORIALS.find((tutorial) => tutorial.templateId === templateId);

export const isTutorialTemplate = (templateId: string | null | undefined) =>
  tutorialForTemplate(templateId) !== undefined;

export const tutorialSteps = (tutorial: TutorialDefinition) =>
  tutorial.lessons.flatMap((lesson) => lesson.steps);
