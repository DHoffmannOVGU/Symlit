import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  GraduationCap,
  Lightbulb,
  Minimize2,
  RotateCcw,
  SkipForward,
  Sparkles,
  Target,
  Trash2,
} from "lucide-react";
import { TUTORIAL_LESSONS, TUTORIAL_STEPS, type TutorialStep } from "@shared/tutorial";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { announceCanvasOverlayChange } from "@/components/flow/utils/fit-options";
import {
  countDone,
  currentLessonIndex,
  currentStep,
  isTutorialFinished,
  type TutorialProgress,
} from "@/lib/tutorial-progress";

interface TutorialCoachProps {
  progress: TutorialProgress;
  /** Which tutorial project is open, used to say where a step happens. */
  scope: "metamodel" | "instance";
  onShowMe: (step: TutorialStep) => void;
  onSkip: (stepId: string) => void;
  onRestart: () => void;
  onCollapsedChange: (collapsed: boolean) => void;
  onStartOwnProject: () => void;
  onRemoveTutorial: () => void;
}

const SMALL_WINDOW = "(max-width: 899px), (max-height: 599px)";

const projectLabel = (scope: "metamodel" | "instance") =>
  scope === "metamodel" ? "Drone types" : "Delivery drone";

/**
 * Docked coach for the guided tutorial. It shows the current lesson, explains
 * why it matters, and ticks steps off as the app reports matching actions.
 */
export function TutorialCoach({
  progress,
  scope,
  onShowMe,
  onSkip,
  onRestart,
  onCollapsedChange,
  onStartOwnProject,
  onRemoveTutorial,
}: TutorialCoachProps) {
  const done = countDone(progress);
  const total = TUTORIAL_STEPS.length;
  const finished = isTutorialFinished(progress);
  const activeStep = currentStep(progress);
  const activeLesson = currentLessonIndex(progress);
  const [viewedLesson, setViewedLesson] = useState(activeLesson);
  const [showHint, setShowHint] = useState(false);
  const [whyOpen, setWhyOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const previousDone = useRef(done);
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
  // appears or changes between open and minimised.
  useEffect(() => {
    announceCanvasOverlayChange();
  }, [minimised, finished]);
  useEffect(() => setShowHint(false), [activeStep?.id]);
  useEffect(() => setWhyOpen(false), [viewedLesson]);
  useEffect(() => {
    if (done > previousDone.current) {
      const justDone = TUTORIAL_STEPS.find(
        (step) => progress.completed[progress.completed.length - 1] === step.id,
      );
      setAnnouncement(justDone ? `Done: ${justDone.title}` : "Step done");
      const timer = window.setTimeout(() => setAnnouncement(""), 2500);
      previousDone.current = done;
      return () => window.clearTimeout(timer);
    }
    previousDone.current = done;
  }, [done, progress.completed]);

  const percent = Math.round((done / total) * 100);

  if (minimised) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpenedInSmallWindow(true);
          onCollapsedChange(false);
        }}
        className="fixed bottom-4 right-4 z-40 flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-full border bg-card px-4 py-2.5 text-left text-sm shadow-xl transition hover:shadow-2xl"
        data-testid="button-tutorial-expand"
      >
        <GraduationCap className="h-4 w-4 shrink-0 text-primary" />
        <span className="font-semibold">Tutorial</span>
        <span className="font-mono text-xs text-muted-foreground" data-testid="tutorial-progress-count">
          {done}/{total}
        </span>
        {activeStep && (
          <span className="hidden truncate text-muted-foreground sm:inline">· {activeStep.title}</span>
        )}
      </button>
    );
  }

  const lesson = TUTORIAL_LESSONS[viewedLesson];
  const stepState = (step: TutorialStep) =>
    progress.completed.includes(step.id)
      ? "done"
      : progress.skipped.includes(step.id)
        ? "skipped"
        : step.id === activeStep?.id
          ? "current"
          : "open";

  return (
    <section
      aria-label="Guided tutorial"
      className="fixed bottom-4 right-4 z-40 flex max-h-[min(500px,calc(100vh-7rem))] w-[340px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl"
      data-testid="tutorial-coach"
    >
      <header className="border-b bg-primary/[0.04] px-4 pb-3 pt-3.5">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-primary/10 p-1.5 text-primary">
            <GraduationCap className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-tight">Guided tutorial</p>
            <p className="text-xs text-muted-foreground">
              <span data-testid="tutorial-progress-count">{done} of {total}</span> steps · you are in{" "}
              <span className="font-medium text-foreground">{projectLabel(scope)}</span>
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => {
              setOpenedInSmallWindow(false);
              onCollapsedChange(true);
            }}
            title="Minimise the tutorial"
            data-testid="button-tutorial-collapse"
          >
            <Minimize2 className="h-4 w-4" />
          </Button>
        </div>
        <div
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-primary/10"
          role="progressbar"
          aria-label="Tutorial progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        >
          <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${percent}%` }} />
        </div>
      </header>

      <p className="sr-only" aria-live="polite">{announcement}</p>

      {finished ? (
        <div className="space-y-4 overflow-y-auto p-4" data-testid="tutorial-finished">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-emerald-100 p-2 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold">You know your way around Symlit</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                You defined types, built a typed model, checked it, looked at it as a table, reused a
                structure and exported it. Time for your own system.
              </p>
            </div>
          </div>
          <div className="grid gap-2">
            <Button onClick={onStartOwnProject} data-testid="button-tutorial-start-own">
              Start your own project
            </Button>
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
      ) : (
        <>
          <div className="overflow-y-auto px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                Lesson {viewedLesson + 1} of {TUTORIAL_LESSONS.length}
              </p>
              <div className="flex gap-1" aria-hidden>
                {TUTORIAL_LESSONS.map((candidate, index) => {
                  const lessonDone = candidate.steps.every((step) => stepState(step) === "done" || stepState(step) === "skipped");
                  return (
                    <span
                      key={candidate.id}
                      className={cn(
                        "h-1.5 w-4 rounded-full",
                        index === viewedLesson ? "bg-primary" : lessonDone ? "bg-primary/40" : "bg-muted",
                      )}
                    />
                  );
                })}
              </div>
            </div>
            <h2 className="mt-1 text-base font-semibold" data-testid="tutorial-lesson-title">
              {lesson.title}
            </h2>
            <button
              type="button"
              className="mt-1 block text-left text-xs leading-5 text-muted-foreground"
              onClick={() => setWhyOpen((open) => !open)}
              aria-expanded={whyOpen}
              data-testid="tutorial-lesson-why"
            >
              <span className={cn(!whyOpen && "line-clamp-2")}>{lesson.why}</span>
              <span className="text-primary">{whyOpen ? " Less" : " More"}</span>
            </button>

            <ol className="mt-2.5 space-y-1">
              {lesson.steps.map((step) => {
                const state = stepState(step);
                const isCurrent = state === "current";
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
                        <p className={cn("text-sm font-medium", state === "done" && "text-muted-foreground line-through decoration-muted-foreground/40")}>
                          {step.title}
                        </p>
                        {isCurrent && (
                          <>
                            <p className="mt-1 text-[13px] leading-5 text-foreground/90">{step.instruction}</p>
                            {step.scope !== scope && (
                              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-primary" />
                                In {projectLabel(step.scope)}: Show me opens it.
                              </p>
                            )}
                            {step.hint && showHint && (
                              <p className="mt-2 flex gap-2 rounded-lg bg-amber-50 px-2.5 py-2 text-xs leading-5 text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
                                <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                {step.hint}
                              </p>
                            )}
                            <div className="mt-2.5 flex flex-wrap items-center gap-2">
                              <Button size="sm" className="h-8" onClick={() => onShowMe(step)} data-testid="button-tutorial-show-me">
                                Show me
                              </Button>
                              {step.hint && !showHint && (
                                <Button size="sm" variant="ghost" className="h-8" onClick={() => setShowHint(true)}>
                                  Hint
                                </Button>
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
            {viewedLesson !== activeLesson ? (
              <Button variant="ghost" size="sm" className="text-primary" onClick={() => setViewedLesson(activeLesson)}>
                Back to the current lesson
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground" aria-live="polite">
                {announcement || "Steps tick off as you work"}
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              disabled={viewedLesson === TUTORIAL_LESSONS.length - 1}
              onClick={() => setViewedLesson((index) => Math.min(TUTORIAL_LESSONS.length - 1, index + 1))}
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
