import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowRight, CheckCircle2, GraduationCap, Loader2, Trash2 } from "lucide-react";
import { api } from "@shared/routes";
import type { Project, View } from "@shared/schema";
import { TUTORIALS, tutorialSteps, type TutorialDefinition } from "@shared/tutorial";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiCall } from "@/lib/api-client";
import {
  clearTutorialProgress,
  countDone,
  currentStep,
  isTutorialFinished,
  loadTutorialProgress,
  pendingRecap,
  skippedSteps,
} from "@/lib/tutorial-progress";
import { latestTutorialRun } from "@/lib/tutorial-projects";

/** The guided tutorials on the project list, in the order they build on each other. */
export function TutorialCards({ projects }: { projects: Project[] | undefined }) {
  return (
    <div className="space-y-3" data-testid="tutorial-cards">
      {TUTORIALS.map((tutorial, index) => (
        <TutorialCard key={tutorial.id} tutorial={tutorial} projects={projects} isFirst={index === 0} />
      ))}
    </div>
  );
}

/**
 * Entry point to one guided tutorial: start it, continue where you left off,
 * or clean it up once finished.
 */
function TutorialCard({
  tutorial,
  projects,
  isFirst,
}: {
  tutorial: TutorialDefinition;
  projects: Project[] | undefined;
  /** The tutorial newcomers start with is introduced as such. */
  isFirst: boolean;
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
  const finished = progress ? isTutorialFinished(tutorial, progress) : false;
  const skipped = progress ? skippedSteps(tutorial, progress).length : 0;
  const recap = progress ? pendingRecap(tutorial, progress) : null;

  const openProject = async (project: Project) => {
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

  if (run && finished) {
    return (
      <section
        aria-label={`Tutorial: ${tutorial.title}`}
        className="flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:flex-row sm:items-center"
        data-testid={`tutorial-card-${tutorial.id}`}
      >
        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
        <p className="flex-1 text-sm">
          <span className="font-semibold">
            {tutorial.title}:{" "}
            {skipped > 0 ? `finished, ${skipped} ${skipped === 1 ? "step" : "steps"} skipped.` : "completed."}
          </span>{" "}
          <span className="text-muted-foreground">
            {skipped > 0
              ? "Open one of its projects to go back to the skipped steps."
              : "Its two projects are still here if you want to look back."}
          </span>
        </p>
        <Button variant="outline" size="sm" onClick={remove} disabled={busy} data-testid={`button-tutorial-remove-${tutorial.id}`}>
          <Trash2 className="mr-2 h-4 w-4" />
          Remove its projects
        </Button>
      </section>
    );
  }

  return (
    <section
      aria-label={`Tutorial: ${tutorial.title}`}
      className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-r from-primary/[0.08] via-card to-card p-5 sm:p-6"
      data-testid={`tutorial-card-${tutorial.id}`}
    >
      <div className="flex flex-col gap-5 md:flex-row md:items-center">
        <div className="flex flex-1 items-start gap-4">
          <div className="rounded-2xl bg-primary/10 p-3 text-primary">
            <GraduationCap className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              {run ? `Tutorial in progress · ${tutorial.title}` : isFirst ? `New to Symlit? · ${tutorial.title}` : `Tutorial · ${tutorial.title}`}
            </p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight">
              {run ? "Pick up where you left off" : tutorial.question}
            </h2>
            {run ? (
              <p className="mt-1 text-sm text-muted-foreground">
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
            ) : (
              <>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{tutorial.summary}</p>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {tutorial.lessons.length} hands-on lessons · about {tutorial.minutes} minutes
                  {tutorial.prerequisite ? ` · ${tutorial.prerequisite}` : null}
                </p>
              </>
            )}
            {run && (
              <div
                className="mt-3 h-1.5 max-w-sm overflow-hidden rounded-full bg-primary/10"
                role="progressbar"
                aria-label="Tutorial progress"
                aria-valuemin={0}
                aria-valuemax={total}
                aria-valuenow={done}
              >
                <div className="h-full rounded-full bg-primary" style={{ width: `${(done / total) * 100}%` }} />
              </div>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {run ? (
            <>
              <Button
                onClick={() =>
                  void openProject(
                    (next?.scope ?? recap?.steps[recap.steps.length - 1].scope) === "instance" && run.instance
                      ? run.instance
                      : run.metamodel,
                  )
                }
                data-testid={`button-tutorial-continue-${tutorial.id}`}
              >
                Continue tutorial
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button variant="ghost" onClick={remove} disabled={busy} data-testid={`button-tutorial-remove-${tutorial.id}`}>
                Remove
              </Button>
            </>
          ) : (
            <Button
              variant={isFirst ? "default" : "outline"}
              onClick={start}
              disabled={busy}
              data-testid={`button-tutorial-start-${tutorial.id}`}
            >
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Start this tutorial
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
