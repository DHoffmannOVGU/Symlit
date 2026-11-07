import {
  TUTORIAL_LESSONS,
  TUTORIAL_STEPS,
  type TutorialScope,
  type TutorialSignal,
  type TutorialStep,
} from "@shared/tutorial";

export interface TutorialProgress {
  completed: string[];
  skipped: string[];
  /** Coach shown as a small pill instead of the full panel. */
  collapsed: boolean;
}

export const EMPTY_TUTORIAL_PROGRESS: TutorialProgress = {
  completed: [],
  skipped: [],
  collapsed: false,
};

const isDone = (progress: TutorialProgress, stepId: string) =>
  progress.completed.includes(stepId) || progress.skipped.includes(stepId);

/** First step that is neither completed nor skipped, or null when finished. */
export function currentStep(progress: TutorialProgress): TutorialStep | null {
  return TUTORIAL_STEPS.find((step) => !isDone(progress, step.id)) ?? null;
}

export function currentLessonIndex(progress: TutorialProgress): number {
  const step = currentStep(progress);
  if (!step) return TUTORIAL_LESSONS.length - 1;
  return TUTORIAL_LESSONS.findIndex((lesson) => lesson.steps.some((s) => s.id === step.id));
}

export function countDone(progress: TutorialProgress) {
  return TUTORIAL_STEPS.filter((step) => isDone(progress, step.id)).length;
}

export function isTutorialFinished(progress: TutorialProgress) {
  return currentStep(progress) === null;
}

/**
 * Applies something the user did. The first open step waiting for this signal
 * in this project completes, so doing things in a different order still counts.
 */
export function applySignal(
  progress: TutorialProgress,
  signal: TutorialSignal,
  scope: TutorialScope,
): TutorialProgress {
  const step = TUTORIAL_STEPS.find(
    (candidate) =>
      candidate.signal === signal && candidate.scope === scope && !isDone(progress, candidate.id),
  );
  if (!step) return progress;
  return { ...progress, completed: [...progress.completed, step.id] };
}

export function skipStep(progress: TutorialProgress, stepId: string): TutorialProgress {
  if (isDone(progress, stepId)) return progress;
  return { ...progress, skipped: [...progress.skipped, stepId] };
}

export function restartTutorial(progress: TutorialProgress): TutorialProgress {
  return { ...EMPTY_TUTORIAL_PROGRESS, collapsed: progress.collapsed };
}

// --- persistence -----------------------------------------------------------

const knownStepIds = new Set(TUTORIAL_STEPS.map((step) => step.id));

/** Progress belongs to one tutorial run, identified by its metamodel project. */
export const tutorialStorageKey = (metamodelProjectId: number) =>
  `symlit_tutorial:${metamodelProjectId}`;

export function normalizeTutorialProgress(value: unknown): TutorialProgress {
  if (!value || typeof value !== "object") return { ...EMPTY_TUTORIAL_PROGRESS };
  const record = value as Partial<TutorialProgress>;
  const ids = (list: unknown) =>
    Array.isArray(list)
      ? list.filter((id): id is string => typeof id === "string" && knownStepIds.has(id))
      : [];
  return {
    completed: ids(record.completed),
    skipped: ids(record.skipped),
    collapsed: record.collapsed === true,
  };
}

export function loadTutorialProgress(metamodelProjectId: number): TutorialProgress {
  try {
    const stored = window.localStorage.getItem(tutorialStorageKey(metamodelProjectId));
    return stored ? normalizeTutorialProgress(JSON.parse(stored)) : { ...EMPTY_TUTORIAL_PROGRESS };
  } catch {
    return { ...EMPTY_TUTORIAL_PROGRESS };
  }
}

export function saveTutorialProgress(metamodelProjectId: number, progress: TutorialProgress) {
  try {
    window.localStorage.setItem(tutorialStorageKey(metamodelProjectId), JSON.stringify(progress));
  } catch {
    // Storage may be unavailable (private mode); progress then lasts for the session.
  }
}
