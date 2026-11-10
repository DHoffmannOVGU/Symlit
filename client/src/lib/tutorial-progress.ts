import {
  TUTORIAL_LESSONS,
  TUTORIAL_STEPS,
  type TutorialLesson,
  type TutorialModelState,
  type TutorialScope,
  type TutorialSignal,
  type TutorialStep,
} from "@shared/tutorial";

/** How a learner got through one step; kept to see where the tutorial is hard. */
export interface TutorialStepUsage {
  hints?: number;
  showMe?: number;
  /** When the step was completed (ms since epoch). */
  doneAt?: number;
}

export interface TutorialProgress {
  /** Steps the learner did. */
  completed: string[];
  /** Steps the learner chose to pass over. They do not count as done. */
  skipped: string[];
  /** Lessons whose closing question was left behind. */
  recapped: string[];
  /** The option chosen for each lesson's question. */
  answers: Record<string, number>;
  /** Coach shown as a small pill instead of the full panel. */
  collapsed: boolean;
  startedAt: number | null;
  finishedAt: number | null;
  usage: Record<string, TutorialStepUsage>;
}

export const EMPTY_TUTORIAL_PROGRESS: TutorialProgress = {
  completed: [],
  skipped: [],
  recapped: [],
  answers: {},
  collapsed: false,
  startedAt: null,
  finishedAt: null,
  usage: {},
};

const isCompleted = (progress: TutorialProgress, stepId: string) => progress.completed.includes(stepId);
const isSkipped = (progress: TutorialProgress, stepId: string) => progress.skipped.includes(stepId);
const isPassed = (progress: TutorialProgress, stepId: string) =>
  isCompleted(progress, stepId) || isSkipped(progress, stepId);

export type TutorialStepState = "done" | "skipped" | "current" | "open";

const stepsPassed = (progress: TutorialProgress, lesson: TutorialLesson) =>
  lesson.steps.every((step) => isPassed(progress, step.id));

/** All steps of the lesson are passed and its question has not been left behind yet. */
const recapPending = (progress: TutorialProgress, lesson: TutorialLesson) =>
  !!lesson.question && stepsPassed(progress, lesson) && !progress.recapped.includes(lesson.id);

const activeLessonIndex = (progress: TutorialProgress) =>
  TUTORIAL_LESSONS.findIndex((lesson) => !stepsPassed(progress, lesson) || recapPending(progress, lesson));

export function isTutorialFinished(progress: TutorialProgress) {
  return activeLessonIndex(progress) === -1;
}

/** The lesson the learner is in; the last one once the tutorial is finished. */
export function currentLessonIndex(progress: TutorialProgress): number {
  const index = activeLessonIndex(progress);
  return index === -1 ? TUTORIAL_LESSONS.length - 1 : index;
}

/** The lesson whose closing question is waiting, if any. */
export function pendingRecap(progress: TutorialProgress): TutorialLesson | null {
  const lesson = TUTORIAL_LESSONS[activeLessonIndex(progress)];
  return lesson && recapPending(progress, lesson) ? lesson : null;
}

/** The step to work on, or null while a question is waiting or once finished. */
export function currentStep(progress: TutorialProgress): TutorialStep | null {
  const lesson = TUTORIAL_LESSONS[activeLessonIndex(progress)];
  return lesson?.steps.find((step) => !isPassed(progress, step.id)) ?? null;
}

export function stepState(progress: TutorialProgress, step: TutorialStep): TutorialStepState {
  if (isCompleted(progress, step.id)) return "done";
  if (isSkipped(progress, step.id)) return "skipped";
  return currentStep(progress)?.id === step.id ? "current" : "open";
}

export function countDone(progress: TutorialProgress) {
  return TUTORIAL_STEPS.filter((step) => isCompleted(progress, step.id)).length;
}

export function skippedSteps(progress: TutorialProgress): TutorialStep[] {
  return TUTORIAL_STEPS.filter((step) => isSkipped(progress, step.id));
}

/** The step completed last, whose explanation the coach shows. */
export function lastCompletedStep(progress: TutorialProgress): TutorialStep | null {
  const id = progress.completed[progress.completed.length - 1];
  return TUTORIAL_STEPS.find((step) => step.id === id) ?? null;
}

/** Minutes from the first action to the end, once finished. */
export function tutorialMinutes(progress: TutorialProgress): number | null {
  if (!progress.startedAt || !progress.finishedAt) return null;
  return Math.max(1, Math.round((progress.finishedAt - progress.startedAt) / 60_000));
}

// --- transitions -------------------------------------------------------------

/** Records start and end times around a change. */
function stamp(progress: TutorialProgress, now: number): TutorialProgress {
  const startedAt = progress.startedAt ?? now;
  const finishedAt = progress.finishedAt ?? (isTutorialFinished(progress) ? now : null);
  return startedAt === progress.startedAt && finishedAt === progress.finishedAt
    ? progress
    : { ...progress, startedAt, finishedAt };
}

/**
 * Steps that can complete now: those not yet done in the current lesson and
 * in earlier ones (where they were skipped). Steps of later lessons wait
 * until their lesson is reached, so nobody passes a lesson before seeing it.
 */
function completable(progress: TutorialProgress): TutorialStep[] {
  const active = activeLessonIndex(progress);
  const lessons = active === -1 ? TUTORIAL_LESSONS : TUTORIAL_LESSONS.slice(0, active + 1);
  return lessons.flatMap((lesson) => lesson.steps).filter((step) => !isCompleted(progress, step.id));
}

function complete(progress: TutorialProgress, steps: TutorialStep[], now: number): TutorialProgress {
  if (steps.length === 0) return progress;
  const ids = steps.map((step) => step.id);
  const usage = { ...progress.usage };
  for (const id of ids) usage[id] = { ...usage[id], doneAt: now };
  return stamp(
    {
      ...progress,
      completed: [...progress.completed, ...ids],
      skipped: progress.skipped.filter((id) => !ids.includes(id)),
      usage,
    },
    now,
  );
}

const checkPasses = (step: TutorialStep, state: TutorialModelState | null) =>
  !step.check || (!!state && state.scope === step.scope && step.check(state));

/**
 * Applies a feature the learner used. The first waiting step for this signal
 * in this project completes, if the model also shows what the step asks for.
 */
export function applySignal(
  progress: TutorialProgress,
  signal: TutorialSignal,
  scope: TutorialScope,
  state: TutorialModelState | null,
  now = Date.now(),
): TutorialProgress {
  const step = completable(progress).find(
    (candidate) => candidate.signal === signal && candidate.scope === scope && checkPasses(candidate, state),
  );
  return step ? complete(progress, [step], now) : progress;
}

/**
 * Applies the state of the open diagram: steps that only ask for a result in
 * the model complete as soon as the model shows it.
 */
export function applyModelState(
  progress: TutorialProgress,
  state: TutorialModelState,
  now = Date.now(),
): TutorialProgress {
  const steps = completable(progress).filter(
    (candidate) => !candidate.signal && !!candidate.check && checkPasses(candidate, state),
  );
  return complete(progress, steps, now);
}

export function skipStep(progress: TutorialProgress, stepId: string, now = Date.now()): TutorialProgress {
  if (isPassed(progress, stepId)) return progress;
  return stamp({ ...progress, skipped: [...progress.skipped, stepId] }, now);
}

/** Reopens every skipped step; the learner continues at the first of them. */
export function returnToSkipped(progress: TutorialProgress): TutorialProgress {
  return progress.skipped.length === 0 ? progress : { ...progress, skipped: [] };
}

export function answerQuestion(progress: TutorialProgress, lessonId: string, option: number): TutorialProgress {
  return { ...progress, answers: { ...progress.answers, [lessonId]: option } };
}

/** Leaves a lesson's question behind (answered or not) and moves on. */
export function closeRecap(progress: TutorialProgress, lessonId: string, now = Date.now()): TutorialProgress {
  if (progress.recapped.includes(lessonId)) return progress;
  return stamp({ ...progress, recapped: [...progress.recapped, lessonId] }, now);
}

export function noteHelpUsed(
  progress: TutorialProgress,
  stepId: string,
  kind: "hints" | "showMe",
): TutorialProgress {
  const entry = progress.usage[stepId] ?? {};
  return { ...progress, usage: { ...progress.usage, [stepId]: { ...entry, [kind]: (entry[kind] ?? 0) + 1 } } };
}

export function totalHelpUsed(progress: TutorialProgress, kind: "hints" | "showMe") {
  return Object.values(progress.usage).reduce((sum, entry) => sum + (entry[kind] ?? 0), 0);
}

// --- persistence -----------------------------------------------------------

const knownStepIds = new Set(TUTORIAL_STEPS.map((step) => step.id));
const knownLessonIds = new Set(TUTORIAL_LESSONS.map((lesson) => lesson.id));

/** Progress belongs to one tutorial run, identified by its metamodel project. */
export const tutorialStorageKey = (metamodelProjectId: number) =>
  `symlit_tutorial:${metamodelProjectId}`;

export function normalizeTutorialProgress(value: unknown): TutorialProgress {
  if (!value || typeof value !== "object") return { ...EMPTY_TUTORIAL_PROGRESS };
  const record = value as Partial<TutorialProgress>;
  const ids = (list: unknown, known: Set<string>) =>
    Array.isArray(list)
      ? Array.from(new Set(list.filter((id): id is string => typeof id === "string" && known.has(id))))
      : [];
  const time = (candidate: unknown) => (typeof candidate === "number" && Number.isFinite(candidate) ? candidate : null);
  const count = (candidate: unknown) =>
    typeof candidate === "number" && Number.isFinite(candidate) && candidate > 0 ? candidate : undefined;
  const completed = ids(record.completed, knownStepIds);
  const answers: Record<string, number> = {};
  const usage: Record<string, TutorialStepUsage> = {};
  if (record.answers && typeof record.answers === "object") {
    for (const [lessonId, option] of Object.entries(record.answers)) {
      if (knownLessonIds.has(lessonId) && Number.isInteger(option) && option >= 0) answers[lessonId] = option;
    }
  }
  if (record.usage && typeof record.usage === "object") {
    for (const [stepId, entry] of Object.entries(record.usage)) {
      if (!knownStepIds.has(stepId) || !entry || typeof entry !== "object") continue;
      usage[stepId] = {
        hints: count(entry.hints),
        showMe: count(entry.showMe),
        doneAt: time(entry.doneAt) ?? undefined,
      };
    }
  }
  return {
    completed,
    skipped: ids(record.skipped, knownStepIds).filter((id) => !completed.includes(id)),
    recapped: ids(record.recapped, knownLessonIds),
    answers,
    collapsed: record.collapsed === true,
    startedAt: time(record.startedAt),
    finishedAt: time(record.finishedAt),
    usage,
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

export function clearTutorialProgress(metamodelProjectId: number) {
  try {
    window.localStorage.removeItem(tutorialStorageKey(metamodelProjectId));
  } catch {
    // Nothing stored, nothing to clear.
  }
}
