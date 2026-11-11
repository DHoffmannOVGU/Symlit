import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  GraduationCap,
  Lightbulb,
  Loader2,
  Minimize2,
  RotateCcw,
  SkipForward,
  Sparkles,
  Target,
  Trash2,
} from "lucide-react";
import {
  TUTORIALS,
  tutorialSteps,
  type TutorialDefinition,
  type TutorialLesson,
  type TutorialStep,
} from "@shared/tutorial";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { announceCanvasOverlayChange } from "@/components/flow/utils/fit-options";
import {
  countDone,
  currentLessonIndex,
  currentStep,
  isTutorialFinished,
  lastCompletedStep,
  pendingRecap,
  skippedSteps,
  stepState,
  totalHelpUsed,
  tutorialMinutes,
  type TutorialProgress,
} from "@/lib/tutorial-progress";

interface TutorialCoachProps {
  tutorial: TutorialDefinition;
  progress: TutorialProgress;
  /** Which tutorial project is open, used to say where a step happens. */
  scope: "metamodel" | "instance";
  onShowMe: (step: TutorialStep) => void;
  onOpenStepDiagram: (step: TutorialStep) => void;
  onHintShown: (stepId: string) => void;
  onSkip: (stepId: string) => void;
  onReturnToSkipped: () => void;
  onAnswer: (lessonId: string, option: number) => void;
  onCloseRecap: (lessonId: string) => void;
  /** Recreates the tutorial projects and starts again. */
  onRestart: () => Promise<void>;
  onCollapsedChange: (collapsed: boolean) => void;
  onStartOwnProject: () => void;
  /** Goes to the project list, where the tutorials are offered. */
  onShowTutorials: () => void;
  onRemoveTutorial: () => void;
}

/** In a window this small the open coach covers most of the canvas. */
const SMALL_WINDOW = "(max-width: 899px), (max-height: 599px)";

const COACH_WIDTH = 340;
/** Docked left, the coach stays within the sidebar so it does not cover the panel beside it. */
const COACH_WIDTH_LEFT = 300;

/** Below this height the coach cannot show a step; it then moves instead of shrinking. */
const COACH_MIN_HEIGHT = 240;

interface CoachPlacement {
  side: "left" | "right";
  /** A dialog is open, which would otherwise hide and block the coach. */
  modal: boolean;
  /** Room left for the coach below something it shares its corner with. */
  maxHeight: number | null;
}

/**
 * Where the coach sits. Its place is the bottom right corner. When something
 * the learner has to work in opens there (an editor, the rules panel, the
 * table), it moves to the bottom left, over the sidebar. The validation
 * results stay open while issues are being fixed, and fixing needs the
 * sidebar: the coach then stays on the right and makes itself shorter, and
 * only moves when there is not enough room.
 */
function useCoachPlacement() {
  const [placement, setPlacement] = useState<CoachPlacement>({ side: "right", modal: false, maxHeight: null });
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const dialogs = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"][data-state="open"]'));
      const coversRight = (element: Element) =>
        element.getBoundingClientRect().right > window.innerWidth - COACH_WIDTH - 32;
      const panel = document.querySelector('[data-testid="model-rules-panel"], [data-testid="canvas-table-mode"]');
      const results = document.querySelector('[data-testid="validation-results"]');
      const roomBelowResults = results
        ? Math.floor(window.innerHeight - results.getBoundingClientRect().bottom - 28)
        : null;
      const resultsLeaveRoom = roomBelowResults === null || roomBelowResults >= COACH_MIN_HEIGHT;
      const side = dialogs.some(coversRight) || panel || !resultsLeaveRoom ? ("left" as const) : ("right" as const);
      const next: CoachPlacement = {
        side,
        modal: dialogs.length > 0,
        maxHeight: side === "right" ? roomBelowResults : null,
      };
      setPlacement((current) =>
        current.side === next.side && current.modal === next.modal && current.maxHeight === next.maxHeight
          ? current
          : next,
      );
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(measure);
    };
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", schedule);
    measure();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", schedule);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);
  return placement;
}

/**
 * Docked coach for the guided tutorial. It shows the current lesson and why
 * it matters, ticks steps off when the model shows their result, explains
 * what just happened, and closes each lesson with one question.
 */
export function TutorialCoach({
  tutorial,
  progress,
  scope,
  onShowMe,
  onOpenStepDiagram,
  onHintShown,
  onSkip,
  onReturnToSkipped,
  onAnswer,
  onCloseRecap,
  onRestart,
  onCollapsedChange,
  onStartOwnProject,
  onShowTutorials,
  onRemoveTutorial,
}: TutorialCoachProps) {
  const projectLabel = (target: "metamodel" | "instance") => tutorial.projects[target];
  const done = countDone(tutorial, progress);
  const skipped = skippedSteps(tutorial, progress);
  const total = tutorialSteps(tutorial).length;
  const finished = isTutorialFinished(tutorial, progress);
  const activeStep = currentStep(tutorial, progress);
  const activeLesson = currentLessonIndex(tutorial, progress);
  const recap = pendingRecap(tutorial, progress);
  const lastDone = lastCompletedStep(tutorial, progress);
  const [viewedLesson, setViewedLesson] = useState(activeLesson);
  const [showHint, setShowHint] = useState(false);
  const [whyOpen, setWhyOpen] = useState(false);
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const previousDone = useRef(done);
  const placement = useCoachPlacement();
  const rootRef = useRef<HTMLElement | null>(null);
  // In a small window the open coach covers most of the canvas, so it starts
  // minimised there until the learner opens it.
  const [smallWindow, setSmallWindow] = useState(() => window.matchMedia(SMALL_WINDOW).matches);
  const [openedInSmallWindow, setOpenedInSmallWindow] = useState(false);
  useEffect(() => {
    const query = window.matchMedia(SMALL_WINDOW);
    const onChange = () => setSmallWindow(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  const minimised = progress.collapsed || (smallWindow && !openedInSmallWindow && !finished);

  // Follow the learner: jump to the lesson they are in when it changes.
  useEffect(() => setViewedLesson(activeLesson), [activeLesson]);
  // The canvas keeps its diagram clear of the coach; tell it when the coach
  // appears, moves or changes between open and minimised.
  useEffect(() => {
    announceCanvasOverlayChange();
  }, [minimised, finished, placement.side]);
  useEffect(() => setShowHint(false), [activeStep?.id]);
  useEffect(() => setWhyOpen(false), [viewedLesson]);
  // Keep the step to work on in sight inside the coach.
  useEffect(() => {
    if (minimised) return;
    const frame = window.requestAnimationFrame(() =>
      rootRef.current?.querySelector('[data-state="current"]')?.scrollIntoView({ block: "nearest" }),
    );
    return () => window.cancelAnimationFrame(frame);
  }, [activeStep?.id, viewedLesson, minimised, placement.side, placement.maxHeight]);
  useEffect(() => {
    if (done > previousDone.current && lastDone) {
      setAnnouncement(`Done: ${lastDone.title}. ${lastDone.done}`);
      const timer = window.setTimeout(() => setAnnouncement(""), 4000);
      previousDone.current = done;
      return () => window.clearTimeout(timer);
    }
    previousDone.current = done;
  }, [done, lastDone]);
  // While a dialog is open, a press outside it closes it. Presses on the
  // coach are kept away from the dialog, so reading a hint does not discard
  // what is being edited.
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !placement.modal) return;
    const keep = (event: Event) => event.stopPropagation();
    root.addEventListener("pointerdown", keep);
    return () => root.removeEventListener("pointerdown", keep);
  }, [placement.modal, minimised]);

  // On the left the coach sits over the sidebar. Unless a dialog has taken
  // over the screen, it stays above the sidebar's bottom buttons (Model rules,
  // Export Project), which steps ask for while a panel is open.
  const aboveSidebarButtons = placement.side === "left" && !placement.modal;
  const dock = cn(
    "fixed pointer-events-auto",
    aboveSidebarButtons ? "bottom-36" : "bottom-4",
    placement.side === "left" ? "left-2.5" : "right-4",
    placement.modal ? "z-[60]" : "z-40",
  );

  if (minimised) {
    return (
      <button
        ref={(element) => {
          rootRef.current = element;
        }}
        type="button"
        onClick={() => {
          setOpenedInSmallWindow(true);
          onCollapsedChange(false);
        }}
        className={cn(
          dock,
          "flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-full border bg-card px-4 py-2.5 text-left text-sm shadow-xl transition hover:shadow-2xl",
        )}
        data-testid="button-tutorial-expand"
      >
        <GraduationCap className="h-4 w-4 shrink-0 text-primary" />
        <span className="font-semibold">Tutorial</span>
        <span className="font-mono text-xs text-muted-foreground" data-testid="tutorial-progress-count">
          {done}/{total}
        </span>
        {(activeStep || recap) && (
          <span className="hidden truncate text-muted-foreground sm:inline">
            · {activeStep ? activeStep.title : "Lesson done: one question"}
          </span>
        )}
      </button>
    );
  }

  const lesson = tutorial.lessons[viewedLesson];
  const viewingActive = viewedLesson === activeLesson;
  const lessonStarted = lesson.steps.some((step) => stepState(tutorial, progress, step) === "done");
  const whyInFull = whyOpen || !lessonStarted || !viewingActive;
  const showRecap = !finished && recap !== null && viewingActive;

  const restart = async () => {
    setRestarting(true);
    try {
      await onRestart();
    } finally {
      setRestarting(false);
      setConfirmRestart(false);
    }
  };

  return (
    <section
      ref={rootRef}
      aria-label="Guided tutorial"
      className={cn(
        dock,
        aboveSidebarButtons ? "max-h-[min(540px,calc(100vh-15rem))]" : "max-h-[min(540px,calc(100vh-7rem))]",
        "flex max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl",
      )}
      style={{
        width: placement.side === "left" ? COACH_WIDTH_LEFT : COACH_WIDTH,
        ...(placement.maxHeight !== null ? { maxHeight: Math.min(540, placement.maxHeight) } : {}),
      }}
      data-testid="tutorial-coach"
      data-side={placement.side}
    >
      <header className="border-b bg-primary/[0.04] px-4 pb-3 pt-3.5">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-primary/10 p-1.5 text-primary">
            <GraduationCap className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-tight" data-testid="tutorial-title">{tutorial.title}</p>
            <p className="text-xs text-muted-foreground">
              <span data-testid="tutorial-progress-count">{done} of {total}</span> done
              {skipped.length > 0 && <span data-testid="tutorial-skipped-count"> · {skipped.length} skipped</span>}
              {!finished && (
                <>
                  {" "}· in <span className="font-medium text-foreground">{projectLabel(scope)}</span>
                </>
              )}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setConfirmRestart(true)}
            title="Start the tutorial over"
            aria-label="Start the tutorial over"
            data-testid="button-tutorial-restart"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => {
              setOpenedInSmallWindow(false);
              onCollapsedChange(true);
            }}
            title="Minimise the tutorial"
            aria-label="Minimise the tutorial"
            data-testid="button-tutorial-collapse"
          >
            <Minimize2 className="h-4 w-4" />
          </Button>
        </div>
        <div
          className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-primary/10"
          role="progressbar"
          aria-label="Tutorial progress"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={done}
          aria-valuetext={`${done} of ${total} steps done${skipped.length ? `, ${skipped.length} skipped` : ""}`}
        >
          <div className="h-full bg-primary transition-all duration-500" style={{ width: `${(done / total) * 100}%` }} />
          <div className="h-full bg-muted-foreground/30 transition-all duration-500" style={{ width: `${(skipped.length / total) * 100}%` }} />
        </div>
      </header>

      <p className="sr-only" aria-live="polite">{announcement}</p>

      {confirmRestart ? (
        <div className="space-y-3 p-4" data-testid="tutorial-restart-confirm">
          <p className="font-semibold">Start the tutorial over?</p>
          <p className="text-sm leading-6 text-muted-foreground">
            The two tutorial projects are replaced by fresh ones and your progress starts at zero. Use this
            when something in the tutorial model went wrong and you would rather begin again.
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => void restart()} disabled={restarting} data-testid="button-tutorial-restart-confirm">
              {restarting ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="mr-2 h-3.5 w-3.5" />}
              Start over
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmRestart(false)} disabled={restarting}>
              Keep going
            </Button>
          </div>
        </div>
      ) : finished ? (
        <FinishedCard
          tutorial={tutorial}
          progress={progress}
          onShowTutorials={onShowTutorials}
          onReturnToSkipped={onReturnToSkipped}
          onStartOwnProject={onStartOwnProject}
          onRemoveTutorial={onRemoveTutorial}
          onRestart={() => setConfirmRestart(true)}
        />
      ) : (
        <>
          <div className="overflow-y-auto px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                Lesson {viewedLesson + 1} of {tutorial.lessons.length}
              </p>
              <div className="flex gap-1" aria-hidden>
                {tutorial.lessons.map((candidate, index) => {
                  const states = candidate.steps.map((step) => stepState(tutorial, progress, step));
                  const passed = states.every((state) => state === "done" || state === "skipped");
                  return (
                    <span
                      key={candidate.id}
                      className={cn(
                        "h-1.5 w-4 rounded-full",
                        index === viewedLesson
                          ? "bg-primary"
                          : !passed
                            ? "bg-muted"
                            : states.includes("skipped")
                              ? "bg-muted-foreground/30"
                              : "bg-primary/40",
                      )}
                    />
                  );
                })}
              </div>
            </div>
            <h2 className="mt-1 text-base font-semibold" data-testid="tutorial-lesson-title">
              {lesson.title}
            </h2>

            {showRecap && recap ? (
              <RecapCard
                lesson={recap}
                lastStep={lastDone && recap.steps.some((step) => step.id === lastDone.id) ? lastDone : null}
                chosen={progress.answers[recap.id]}
                isLast={viewedLesson === tutorial.lessons.length - 1}
                onAnswer={(option) => onAnswer(recap.id, option)}
                onContinue={() => onCloseRecap(recap.id)}
              />
            ) : (
              <>
                {/* In full until the lesson is under way; then it makes room for the steps. */}
                {whyInFull ? (
                  <p className="mt-1 text-xs leading-5 text-muted-foreground" data-testid="tutorial-lesson-why">
                    {lesson.why}
                  </p>
                ) : (
                  <button
                    type="button"
                    className="mt-1 block text-left text-xs leading-5 text-muted-foreground"
                    onClick={() => setWhyOpen(true)}
                    aria-expanded={false}
                    data-testid="tutorial-lesson-why"
                  >
                    <span className="line-clamp-1">{lesson.why}</span>
                    <span className="text-primary">Read again</span>
                  </button>
                )}
                <p className="mt-1.5 text-xs leading-5" data-testid="tutorial-lesson-goal">
                  <span className="font-semibold">Afterwards you can</span> {lesson.goal}.
                </p>

                <ol className="mt-2.5 space-y-1">
                  {lesson.steps.map((step) => {
                    const state = stepState(tutorial, progress, step);
                    const isCurrent = state === "current";
                    // The explanation of the step just done; all of them when looking back at a lesson.
                    const showDone = state === "done" && (step.id === lastDone?.id || !viewingActive);
                    const elsewhere = step.scope !== scope;
                    return (
                      <li
                        key={step.id}
                        className={cn(
                          "rounded-xl border px-3 py-2 transition-colors",
                          isCurrent ? "border-primary/40 bg-primary/[0.04]" : "border-transparent",
                        )}
                        data-testid={`tutorial-step-${step.id}`}
                        data-state={state}
                      >
                        <div className="flex items-start gap-2.5">
                          {state === "done" ? (
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-label="Done" />
                          ) : state === "skipped" ? (
                            <SkipForward className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-label="Skipped" />
                          ) : isCurrent ? (
                            <Target className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-label="Current step" />
                          ) : (
                            <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/50" aria-label="Open" />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className={cn("text-sm font-medium", (state === "done" || state === "skipped") && "text-muted-foreground")}>
                              {step.title}
                              {state === "skipped" && <span className="font-normal"> · skipped</span>}
                            </p>
                            {showDone && (
                              <p
                                className="mt-1 rounded-lg bg-emerald-50 px-2.5 py-2 text-xs leading-5 text-emerald-950 dark:bg-emerald-900/20 dark:text-emerald-100"
                                data-testid="tutorial-step-done-text"
                              >
                                {step.done}
                              </p>
                            )}
                            {isCurrent && (
                              <>
                                <p className="mt-1 text-[13px] leading-5 text-foreground/90">{step.instruction}</p>
                                {step.hint && showHint && (
                                  <p className="mt-2 flex gap-2 rounded-lg bg-amber-50 px-2.5 py-2 text-xs leading-5 text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
                                    <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                    {step.hint}
                                  </p>
                                )}
                                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                                  {elsewhere ? (
                                    <Button size="sm" className="h-8" onClick={() => onOpenStepDiagram(step)} data-testid="button-tutorial-open-project">
                                      Open {projectLabel(step.scope)}
                                      <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                                    </Button>
                                  ) : (
                                    <>
                                      {step.hint && !showHint && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-8"
                                          onClick={() => {
                                            setShowHint(true);
                                            onHintShown(step.id);
                                          }}
                                          data-testid="button-tutorial-hint"
                                        >
                                          <Lightbulb className="mr-1.5 h-3.5 w-3.5" />
                                          Hint
                                        </Button>
                                      )}
                                      {step.highlight?.length ? (
                                        <Button size="sm" variant="outline" className="h-8" onClick={() => onShowMe(step)} data-testid="button-tutorial-show-me">
                                          Show me
                                        </Button>
                                      ) : null}
                                    </>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="ml-auto h-8 text-muted-foreground"
                                    onClick={() => onSkip(step.id)}
                                    data-testid="button-tutorial-skip"
                                  >
                                    Skip
                                  </Button>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </>
            )}
          </div>
          <footer className="flex items-center justify-between border-t px-2 py-1.5">
            <Button
              variant="ghost"
              size="sm"
              disabled={viewedLesson === 0}
              onClick={() => setViewedLesson((index) => Math.max(0, index - 1))}
              aria-label="Previous lesson"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {!viewingActive ? (
              <Button variant="ghost" size="sm" className="text-primary" onClick={() => setViewedLesson(activeLesson)}>
                Back to the current lesson
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground">
                {showRecap ? "One question, then on to the next lesson" : "Steps tick off when the result is there"}
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              disabled={viewedLesson === tutorial.lessons.length - 1}
              onClick={() => setViewedLesson((index) => Math.min(tutorial.lessons.length - 1, index + 1))}
              aria-label="Next lesson"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </footer>
        </>
      )}
    </section>
  );
}

/** Closes a lesson: what the learner can do now, and one question to look back. */
function RecapCard({
  lesson,
  lastStep,
  chosen,
  isLast,
  onAnswer,
  onContinue,
}: {
  lesson: TutorialLesson;
  /** The lesson's step that was just completed, whose explanation is still to be read. */
  lastStep: TutorialStep | null;
  chosen: number | undefined;
  isLast: boolean;
  onAnswer: (option: number) => void;
  onContinue: () => void;
}) {
  const question = lesson.question!;
  const answered = chosen !== undefined ? question.options[chosen] : undefined;
  return (
    <div className="mt-2 space-y-3" data-testid="tutorial-recap">
      {lastStep && (
        <p className="text-xs leading-5 text-muted-foreground" data-testid="tutorial-step-done-text">
          <span className="font-medium text-foreground">{lastStep.title}:</span> {lastStep.done}
        </p>
      )}
      <p className="flex gap-2 rounded-lg bg-emerald-50 px-2.5 py-2 text-xs leading-5 text-emerald-950 dark:bg-emerald-900/20 dark:text-emerald-100">
        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
        <span>
          <span className="font-semibold">Lesson done.</span> You can now {lesson.goal}.
        </span>
      </p>
      <fieldset>
        <legend className="text-sm font-medium">{question.prompt}</legend>
        <div className="mt-2 space-y-1.5">
          {question.options.map((option, index) => {
            const isChosen = chosen === index;
            return (
              <button
                key={option.text}
                type="button"
                onClick={() => onAnswer(index)}
                aria-pressed={isChosen}
                className={cn(
                  "block w-full rounded-lg border px-3 py-2 text-left text-[13px] leading-5 transition-colors",
                  !isChosen && "hover:border-primary/40 hover:bg-primary/[0.04]",
                  isChosen && option.correct && "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20",
                  isChosen && !option.correct && "border-amber-500 bg-amber-50 dark:bg-amber-900/20",
                )}
                data-testid={`tutorial-answer-${index}`}
              >
                {option.text}
              </button>
            );
          })}
        </div>
      </fieldset>
      {answered && (
        <p className="text-xs leading-5" aria-live="polite" data-testid="tutorial-answer-feedback">
          {!answered.correct && <span className="font-semibold">Not quite. </span>}
          {answered.feedback}
          {!answered.correct && " Try another answer."}
        </p>
      )}
      <Button size="sm" className="h-8" onClick={onContinue} data-testid="button-tutorial-next-lesson">
        {isLast ? "Finish" : "Next lesson"}
        <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

/** The end of the tutorial: what was done, the answer, and where to go next. */
function FinishedCard({
  tutorial,
  progress,
  onReturnToSkipped,
  onStartOwnProject,
  onShowTutorials,
  onRemoveTutorial,
  onRestart,
}: {
  tutorial: TutorialDefinition;
  progress: TutorialProgress;
  onReturnToSkipped: () => void;
  onStartOwnProject: () => void;
  onShowTutorials: () => void;
  onRemoveTutorial: () => void;
  onRestart: () => void;
}) {
  const done = countDone(tutorial, progress);
  const skipped = skippedSteps(tutorial, progress);
  const total = tutorialSteps(tutorial).length;
  const minutes = tutorialMinutes(progress);
  const hints = totalHelpUsed(progress, "hints");
  const lessonComplete = (lesson: TutorialLesson) =>
    lesson.steps.every((step) => stepState(tutorial, progress, step) === "done");
  const answerStep = tutorialSteps(tutorial).find((step) => step.id === tutorial.answerStep);
  const answeredQuestion = !!answerStep && stepState(tutorial, progress, answerStep) === "done";
  // The tutorial offered after this one, if there is one.
  const nextTutorial = TUTORIALS[TUTORIALS.indexOf(tutorial) + 1];
  const allDone = skipped.length === 0;

  return (
    <div className="space-y-4 overflow-y-auto p-4" data-testid="tutorial-finished">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "rounded-xl p-2",
            allDone
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
              : "bg-muted text-muted-foreground",
          )}
        >
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <p className="font-semibold" data-testid="tutorial-finished-title">
            {allDone ? tutorial.finishedTitle : `You reached the end with ${done} of ${total} steps done`}
          </p>
          <p className="mt-1 text-xs text-muted-foreground" data-testid="tutorial-finished-summary">
            {done} of {total} steps done
            {skipped.length > 0 && ` · ${skipped.length} skipped`}
            {minutes !== null && ` · ${minutes} min`}
            {hints > 0 && ` · ${hints} ${hints === 1 ? "hint" : "hints"} used`}
          </p>
        </div>
      </div>

      {answeredQuestion && (
        <p className="rounded-lg bg-primary/[0.06] px-3 py-2 text-xs leading-5">
          <span className="font-semibold">{tutorial.question}</span> {tutorial.answer}
        </p>
      )}

      {skipped.length > 0 && (
        <div className="rounded-lg border px-3 py-2.5" data-testid="tutorial-skipped-list">
          <p className="text-xs font-semibold">Skipped, so not practised yet</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs leading-5 text-muted-foreground">
            {skipped.map((step) => (
              <li key={step.id}>{step.title}</li>
            ))}
          </ul>
          <Button size="sm" variant="outline" className="mt-2 h-8" onClick={onReturnToSkipped} data-testid="button-tutorial-return-to-skipped">
            Go back to the skipped steps
          </Button>
        </div>
      )}

      <div>
        <p className="text-xs font-semibold">You can now</p>
        <ul className="mt-1 space-y-1 text-xs leading-5">
          {tutorial.lessons.map((lesson) => {
            const complete = lessonComplete(lesson);
            return (
              <li key={lesson.id} className={cn("flex gap-2", !complete && "text-muted-foreground")}>
                {complete ? (
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-label="Practised" />
                ) : (
                  <Circle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/50" aria-label="Not fully practised" />
                )}
                {lesson.goal}
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        <p className="text-xs font-semibold">Not covered here, worth exploring next</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs leading-5 text-muted-foreground">
          {tutorial.notCovered.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
          The question mark in the toolbar opens the help for the diagram you are in.
        </p>
      </div>

      <div className="grid gap-2">
        {nextTutorial && (
          <>
            <Button onClick={onShowTutorials} data-testid="button-tutorial-next-tutorial">
              Next tutorial: {nextTutorial.title}
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
            <p className="text-center text-xs text-muted-foreground">It starts from the project list.</p>
          </>
        )}
        <Button variant={nextTutorial ? "outline" : "default"} onClick={onStartOwnProject} data-testid="button-tutorial-start-own">
          Start your own project
        </Button>
        <p className="text-center text-xs text-muted-foreground">Blank, or from one of the templates.</p>
        <Button variant="outline" onClick={onRemoveTutorial} data-testid="button-tutorial-remove">
          <Trash2 className="mr-2 h-4 w-4" />
          Remove the tutorial projects
        </Button>
        <Button variant="ghost" size="sm" onClick={onRestart}>
          <RotateCcw className="mr-2 h-3.5 w-3.5" />
          Go through it again
        </Button>
      </div>
    </div>
  );
}
