import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowRight, CheckCircle2, ChevronDown, ChevronUp, GraduationCap, Loader2, Trash2 } from "lucide-react";
import { api } from "@shared/routes";
import type { Project, View } from "@shared/schema";
import { TUTORIALS, tutorialSteps, type TutorialDefinition } from "@shared/tutorial";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiCall } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import {
  clearTutorialProgress,
  countDone,
  currentStep,
  isTutorialFinished,
  loadTutorialProgress,
  pendingRecap,
  skippedSteps,
  wasTutorialFinished,
} from "@/lib/tutorial-progress";
import { latestTutorialRun } from "@/lib/tutorial-projects";

const HIDDEN_KEY = "symlit_tutorials_hidden";

const readHidden = () => {
  try {
    return window.localStorage.getItem(HIDDEN_KEY) === "true";
  } catch {
    return false;
  }
};

/**
 * The guided tutorials on the project list, in the order they build on each
 * other. One compact card each, so that six of them leave room for the
 * projects; the whole section can be folded away.
 */
export function TutorialCards({ projects }: { projects: Project[] | undefined }) {
  const [hidden, setHidden] = useState(readHidden);
  const finished = TUTORIALS.filter((tutorial) => wasTutorialFinished(tutorial.id)).length;
  // A newcomer is pointed at the first tutorial; later nothing is singled out.
  const newcomer = finished === 0 && !TUTORIALS.some((tutorial) => latestTutorialRun(tutorial, projects));

  const toggle = () => {
    const next = !hidden;
    setHidden(next);
    try {
      window.localStorage.setItem(HIDDEN_KEY, String(next));
    } catch {
      // Without storage the choice lasts until the page is reloaded.
    }
  };

  return (
    <section
      aria-labelledby="tutorials-heading"
      className="rounded-3xl border border-primary/15 bg-gradient-to-r from-primary/[0.05] via-card to-card p-4 sm:p-5"
      data-testid="tutorial-cards"
    >
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-primary/10 p-2 text-primary">
          <GraduationCap className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 id="tutorials-heading" className="text-sm font-semibold tracking-tight">
            Guided tutorials
          </h2>
          <p className="text-xs text-muted-foreground" data-testid="tutorials-summary">
            {newcomer
              ? "New to Symlit? Each tutorial builds a small model with you and answers one question with it."
              : `${finished} of ${TUTORIALS.length} completed. Each builds a small model with you and answers one question with it.`}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={toggle}
          aria-expanded={!hidden}
          aria-controls="tutorials-list"
          data-testid="button-tutorials-toggle"
        >
          {hidden ? "Show" : "Hide"}
          {hidden ? <ChevronDown className="ml-1 h-4 w-4" /> : <ChevronUp className="ml-1 h-4 w-4" />}
        </Button>
      </div>
      {!hidden && (
        <div id="tutorials-list" className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {TUTORIALS.map((tutorial, index) => (
            <TutorialCard
              key={tutorial.id}
              tutorial={tutorial}
              number={index + 1}
              projects={projects}
              startHere={newcomer && index === 0}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * Entry point to one guided tutorial: start it, continue where you left off,
 * or clean it up once finished.
 */
function TutorialCard({
  tutorial,
  number,
  projects,
  startHere,
}: {
  tutorial: TutorialDefinition;
  number: number;
  projects: Project[] | undefined;
  /** The tutorial a newcomer should begin with. */
  startHere: boolean;
}) {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const run = useMemo(() => latestTutorialRun(tutorial, projects), [tutorial, projects]);
  const progress = run ? loadTutorialProgress(tutorial, run.metamodel.id) : null;
  const total = tutorialSteps(tutorial).length;
  const done = progress ? countDone(tutorial, progress) : 0;
  const next = progress ? currentStep(tutorial, progress) : null;
  const runFinished = progress ? isTutorialFinished(tutorial, progress) : false;
  const skipped = progress ? skippedSteps(tutorial, progress).length : 0;
  const recap = progress ? pendingRecap(tutorial, progress) : null;
  // Remembered also after the tutorial's projects were removed.
  const completedBefore = wasTutorialFinished(tutorial.id);
  const state = run ? (runFinished ? "finished" : "running") : completedBefore ? "completed" : "new";

  const open = async (project: Project) => {
    const views = await queryClient.fetchQuery<View[]>({
      queryKey: [api.views.list.path, project.id],
      queryFn: () => apiCall(api.views.list, { params: { projectId: project.id } }),
    });
    setLocation(views[0] ? `/project/${project.id}/view/${views[0].id}` : `/project/${project.id}`);
  };

  const start = async () => {
    setBusy(true);
    try {
      const created = await apiCall(api.tutorial.createOne, { params: { tutorial: tutorial.id } });
      // Project numbers can repeat (after the database was reset): start clean.
      clearTutorialProgress(created.metamodel.id);
      await queryClient.invalidateQueries({ queryKey: [api.projects.list.path] });
      setLocation(`/project/${created.metamodel.id}/view/${created.metamodelViewId}`);
    } catch (error) {
      toast({
        title: "Could not start the tutorial",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await apiCall(api.tutorial.deleteOne, { params: { tutorial: tutorial.id } });
      if (run) clearTutorialProgress(run.metamodel.id);
      await queryClient.invalidateQueries({ queryKey: [api.projects.list.path] });
    } finally {
      setBusy(false);
    }
  };

  const resume = () => {
    if (!run) return;
    const scope = next?.scope ?? recap?.steps[recap.steps.length - 1].scope;
    // A step on the project list is continued right here; the coach shows it.
    if (scope === "projects") return;
    if (scope === "variant") {
      if (run.variants[0]) void open(run.variants[0]);
      return;
    }
    void open(scope === "instance" && run.instance ? run.instance : run.metamodel);
  };

  return (
    <article
      aria-label={`Tutorial: ${tutorial.title}`}
      className={cn(
        "flex flex-col rounded-2xl border bg-card p-4",
        startHere && "border-primary/50 ring-1 ring-primary/20",
      )}
      data-testid={`tutorial-card-${tutorial.id}`}
      data-state={state}
    >
      <div className="flex items-start gap-2.5">
        <span
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
            state === "finished" || state === "completed"
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
              : "bg-primary/10 text-primary",
          )}
          aria-hidden
        >
          {state === "finished" || state === "completed" ? <CheckCircle2 className="h-4 w-4" /> : number}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold leading-tight">{tutorial.title}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {state === "running"
              ? "In progress"
              : state === "finished"
                ? skipped > 0
                  ? `Finished, ${skipped} ${skipped === 1 ? "step" : "steps"} skipped`
                  : "Completed"
                : state === "completed"
                  ? "Completed"
                  : startHere
                    ? "Start here"
                    : `${tutorial.lessons.length} lessons · about ${tutorial.minutes} min`}
          </p>
        </div>
      </div>

      <p className="mt-2.5 text-sm font-medium leading-snug">{tutorial.question}</p>
      {state === "running" ? (
        <>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {done} of {total} steps done
            {skipped > 0 ? ` · ${skipped} skipped` : null}
            {next ? (
              <>
                {" "}· next: <span className="font-medium text-foreground">{next.title}</span>
              </>
            ) : recap ? (
              <> · next: one question about {recap.title.toLowerCase()}</>
            ) : null}
          </p>
          <div
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-primary/10"
            role="progressbar"
            aria-label="Tutorial progress"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={done}
          >
            <div className="h-full rounded-full bg-primary" style={{ width: `${(done / total) * 100}%` }} />
          </div>
        </>
      ) : (
        <p className="mt-1 line-clamp-3 text-xs leading-5 text-muted-foreground" title={tutorial.summary}>
          {state === "finished" && skipped > 0
            ? "Open one of its projects to go back to the skipped steps."
            : tutorial.summary}
        </p>
      )}
      {state === "new" && (
        <p className="mt-1.5 text-[11px] leading-4 text-muted-foreground">
          {startHere ? `${tutorial.lessons.length} lessons · about ${tutorial.minutes} min` : tutorial.prerequisite}
        </p>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
        {state === "running" ? (
          next?.scope === "projects" ? (
            <p className="text-xs font-medium text-primary" data-testid={`tutorial-continues-here-${tutorial.id}`}>
              Continues on this page
            </p>
          ) : (
            <Button size="sm" onClick={resume} data-testid={`button-tutorial-continue-${tutorial.id}`}>
              Continue
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          )
        ) : (
          <Button
            size="sm"
            variant={startHere ? "default" : "outline"}
            onClick={start}
            disabled={busy || state === "finished"}
            className={cn(state === "finished" && "hidden")}
            data-testid={`button-tutorial-start-${tutorial.id}`}
          >
            {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
            {state === "completed" ? "Do it again" : "Start"}
            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        )}
        {run && (
          <Button
            size="sm"
            variant="ghost"
            className="text-muted-foreground"
            onClick={remove}
            disabled={busy}
            data-testid={`button-tutorial-remove-${tutorial.id}`}
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            {state === "finished" ? "Remove its projects" : "Remove"}
          </Button>
        )}
      </div>
    </article>
  );
}
