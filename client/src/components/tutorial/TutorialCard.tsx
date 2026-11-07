import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowRight, CheckCircle2, GraduationCap, Loader2, Trash2 } from "lucide-react";
import { api } from "@shared/routes";
import type { Project, View } from "@shared/schema";
import { TUTORIAL_LESSONS, TUTORIAL_STEPS } from "@shared/tutorial";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiCall } from "@/lib/api-client";
import {
  countDone,
  currentStep,
  isTutorialFinished,
  loadTutorialProgress,
} from "@/lib/tutorial-progress";
import { latestTutorialRun } from "@/lib/tutorial-projects";

/**
 * Entry point to the guided tutorial on the project list: start it, continue
 * where you left off, or clean it up once finished.
 */
export function TutorialCard({ projects }: { projects: Project[] | undefined }) {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const run = useMemo(() => latestTutorialRun(projects), [projects]);
  const progress = run ? loadTutorialProgress(run.metamodel.id) : null;
  const done = progress ? countDone(progress) : 0;
  const next = progress ? currentStep(progress) : null;
  const finished = progress ? isTutorialFinished(progress) : false;

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
      const created = await apiCall(api.tutorial.create);
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
      await apiCall(api.tutorial.delete);
      await queryClient.invalidateQueries({ queryKey: [api.projects.list.path] });
    } finally {
      setBusy(false);
    }
  };

  if (run && finished) {
    return (
      <section
        aria-label="Guided tutorial"
        className="flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:flex-row sm:items-center"
        data-testid="tutorial-card"
      >
        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
        <p className="flex-1 text-sm">
          <span className="font-semibold">Tutorial completed.</span>{" "}
          <span className="text-muted-foreground">The two tutorial projects are still here if you want to look back.</span>
        </p>
        <Button variant="outline" size="sm" onClick={remove} disabled={busy} data-testid="button-tutorial-remove">
          <Trash2 className="mr-2 h-4 w-4" />
          Remove tutorial projects
        </Button>
      </section>
    );
  }

  return (
    <section
      aria-label="Guided tutorial"
      className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-r from-primary/[0.08] via-card to-card p-5 sm:p-6"
      data-testid="tutorial-card"
    >
      <div className="flex flex-col gap-5 md:flex-row md:items-center">
        <div className="flex flex-1 items-start gap-4">
          <div className="rounded-2xl bg-primary/10 p-3 text-primary">
            <GraduationCap className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              {run ? "Guided tutorial in progress" : "New to Symlit?"}
            </p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight">
              {run ? "Pick up where you left off" : "Learn Symlit by building a delivery drone model"}
            </h2>
            {run ? (
              <p className="mt-1 text-sm text-muted-foreground">
                {done} of {TUTORIAL_STEPS.length} steps done
                {next ? (
                  <>
                    {" "}· next: <span className="font-medium text-foreground">{next.title}</span>
                  </>
                ) : null}
              </p>
            ) : (
              <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                {TUTORIAL_LESSONS.length} short hands-on lessons, about 15 minutes. You define types in a
                metamodel, build a typed model from them, validate it, tidy the layout, save a pattern and
                export your work. Each step ticks off as you do it.
              </p>
            )}
            {run && (
              <div
                className="mt-3 h-1.5 max-w-sm overflow-hidden rounded-full bg-primary/10"
                role="progressbar"
                aria-label="Tutorial progress"
                aria-valuemin={0}
                aria-valuemax={TUTORIAL_STEPS.length}
                aria-valuenow={done}
              >
                <div className="h-full rounded-full bg-primary" style={{ width: `${(done / TUTORIAL_STEPS.length) * 100}%` }} />
              </div>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {run ? (
            <>
              <Button
                onClick={() =>
                  void openProject(next?.scope === "instance" && run.instance ? run.instance : run.metamodel)
                }
                data-testid="button-tutorial-continue"
              >
                Continue tutorial
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button variant="ghost" onClick={remove} disabled={busy}>
                Remove
              </Button>
            </>
          ) : (
            <Button onClick={start} disabled={busy} data-testid="button-tutorial-start">
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Start the guided tutorial
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
