import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { api, buildUrl } from "@shared/routes";
import type { Project, View } from "@shared/schema";
import {
  findTutorialProjects,
  latestTutorialRun,
  tutorialWorkspaceState,
  type TutorialProjects,
} from "@/lib/tutorial-projects";
import {
  same,
  TUTORIALS,
  type TutorialModelState,
  type TutorialScope,
  type TutorialSignal,
  type TutorialStep,
} from "@shared/tutorial";
import { apiCall } from "@/lib/api-client";
import { dispatchDiagramEvent, subscribeDiagramEvent } from "@/lib/diagram-events";
import { spotlight } from "@/lib/spotlight";
import {
  answerQuestion,
  applyModelState,
  applySignal,
  applyWorkspaceState,
  clearTutorialProgress,
  closeRecap,
  currentStep,
  isTutorialFinished,
  loadTutorialProgress,
  noteHelpUsed,
  pendingRecap,
  rememberTutorialFinished,
  returnToSkipped,
  saveTutorialProgress,
  skipStep,
  type TutorialProgress,
} from "@/lib/tutorial-progress";

/**
 * Where the coach is shown: in one of the tutorial's two projects, on the
 * project list, or in another project the tutorial created.
 */
export type CoachPlace = TutorialScope | "elsewhere";

/**
 * The progress of one tutorial run and what can be done with it, wherever the
 * coach is shown. `navigate` leaves the current page (asking first when a
 * diagram has unsaved changes).
 */
function useTutorialRun(
  run: TutorialProjects | null,
  allProjects: Project[] | undefined,
  navigate: (href: string) => void,
) {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const runId = run?.metamodel.id;
  const definition = run?.tutorial;

  const [progress, setProgress] = useState<TutorialProgress | null>(null);
  useEffect(() => {
    setProgress(runId && definition ? loadTutorialProgress(definition, runId) : null);
  }, [definition, runId]);

  const update = useCallback(
    (change: (current: TutorialProgress) => TutorialProgress) => {
      if (!runId || !definition) return;
      setProgress((current) => change(current ?? loadTutorialProgress(definition, runId)));
    },
    [definition, runId],
  );
  useEffect(() => {
    if (!runId || !progress || !definition) return;
    saveTutorialProgress(runId, progress);
    // Kept apart from the run: it is still true after the projects are removed.
    if (progress.finishedAt && isTutorialFinished(definition, progress)) {
      rememberTutorialFinished(definition.id, progress.finishedAt);
    }
  }, [definition, runId, progress]);

  // Steps on the project list complete when the list shows what they ask for.
  useEffect(() => {
    if (!run || !progress) return;
    update((current) => applyWorkspaceState(run.tutorial, current, tutorialWorkspaceState(run, allProjects)));
  }, [allProjects, progress, run, update]);

  /**
   * Opens where a step happens: the project list, or the step's diagram. A
   * step that names no diagram counts in any diagram of its project, so a
   * learner already in that project stays where they are.
   */
  const openStep = useCallback(
    async (step: TutorialStep, here: { projectId?: number; viewId?: number }) => {
      if (!run) return;
      if (step.scope === "projects" || (step.scope === "variant" && run.variants.length === 0)) {
        navigate("/projects");
        return;
      }
      const target =
        step.scope === "metamodel" ? run.metamodel : step.scope === "variant" ? run.variants[0] : run.instance;
      if (!target) return;
      const inTarget = here.projectId === target.id && here.viewId !== undefined;
      if (inTarget && !step.view) return;
      const views = await queryClient.fetchQuery<View[]>({
        queryKey: [api.views.list.path, target.id],
        queryFn: () => apiCall(api.views.list, { params: { projectId: target.id } }),
      });
      const diagrams = views.filter((view) => view.viewType !== "pattern");
      const view = (step.view ? diagrams.find((candidate) => same(candidate.name, step.view!)) : undefined) ?? diagrams[0];
      if (inTarget && view?.id === here.viewId) return;
      navigate(view ? `/project/${target.id}/view/${view.id}` : buildUrl("/project/:id", { id: target.id }));
    },
    [navigate, queryClient, run],
  );

  /** Throws the tutorial projects away and starts again with fresh ones. */
  const restart = useCallback(async () => {
    if (!definition) return;
    if (runId) clearTutorialProgress(runId);
    const params = { tutorial: definition.id };
    await apiCall(api.tutorial.deleteOne, { params });
    const created = await apiCall(api.tutorial.createOne, { params });
    // Project numbers can repeat (after the database was reset): start clean.
    clearTutorialProgress(created.metamodel.id);
    await queryClient.invalidateQueries({ queryKey: [api.projects.list.path] });
    setLocation(`/project/${created.metamodel.id}/view/${created.metamodelViewId}`);
  }, [definition, queryClient, runId, setLocation]);

  /** Removes the projects of this tutorial. */
  const remove = useCallback(async () => {
    if (!definition) return;
    await apiCall(api.tutorial.deleteOne, { params: { tutorial: definition.id } });
    if (runId) clearTutorialProgress(runId);
    await queryClient.invalidateQueries({ queryKey: [api.projects.list.path] });
  }, [definition, queryClient, runId]);

  return {
    definition,
    progress,
    update,
    openStep,
    restart,
    remove,
    skip: (stepId: string) => definition && update((current) => skipStep(definition, current, stepId)),
    returnToSkipped: () => update(returnToSkipped),
    answer: (lessonId: string, option: number) => update((current) => answerQuestion(current, lessonId, option)),
    closeRecap: (lessonId: string) => definition && update((current) => closeRecap(definition, current, lessonId)),
    noteHint: (stepId: string) => update((current) => noteHelpUsed(current, stepId, "hints")),
    noteShowMe: (stepId: string) => update((current) => noteHelpUsed(current, stepId, "showMe")),
    setCollapsed: (collapsed: boolean) => update((current) => ({ ...current, collapsed })),
  };
}

interface UseTutorialCoachOptions {
  project: Project | undefined;
  allProjects: Project[] | undefined;
  viewId: number | undefined;
  isDiagramDirty: boolean;
}

/** The coach inside a project of a tutorial: it follows what is built in the open diagram. */
export function useTutorialCoach({ project, allProjects, viewId, isDiagramDirty }: UseTutorialCoachOptions) {
  const [, setLocation] = useLocation();
  const tutorial = useMemo(() => findTutorialProjects(project, allProjects), [project, allProjects]);
  const place: CoachPlace | null = !tutorial || !project
    ? null
    : project.id === tutorial.metamodel.id
      ? "metamodel"
      : project.id === tutorial.instance?.id
        ? "instance"
        : tutorial.variants.some((variant) => variant.id === project.id)
          ? "variant"
          : "elsewhere";
  // Steps happen in the tutorial's metamodel, its model or a variant of it; elsewhere nothing completes.
  const scope: TutorialScope | null = place === "metamodel" || place === "instance" || place === "variant" ? place : null;

  const navigate = useCallback(
    (href: string) => {
      if (isDiagramDirty) dispatchDiagramEvent("diagram-leave-request", { href });
      else setLocation(href);
    },
    [isDiagramDirty, setLocation],
  );
  const run = useTutorialRun(tutorial, allProjects, navigate);
  const { definition, progress, update } = run;

  // What the open diagram contains, reported by the canvas.
  const [modelState, setModelState] = useState<TutorialModelState | null>(null);
  const modelStateRef = useRef<TutorialModelState | null>(null);
  modelStateRef.current = modelState;
  useEffect(() => {
    setModelState(null);
    if (!scope || !viewId) return;
    const unsubscribe = subscribeDiagramEvent("tutorial-model-state", (detail) => {
      // Reported while the canvas renders; defer so we never update state mid-render.
      if (detail.viewId === viewId) queueMicrotask(() => setModelState(detail.state));
    });
    // The canvas reports only changes, and may have reported before this was listening.
    dispatchDiagramEvent("tutorial-model-state-request", {});
    return unsubscribe;
  }, [scope, viewId]);

  // Steps that ask for a result complete when the model shows it.
  useEffect(() => {
    if (!modelState || !progress || !definition || !scope) return;
    update((current) => applyModelState(definition, current, modelState, Date.now(), scope));
  }, [definition, modelState, progress, scope, update]);

  const signal = useCallback(
    (name: TutorialSignal) => {
      if (!scope || !definition) return;
      // Some events are dispatched while another component renders (e.g. from
      // inside a state updater); defer so we never update state mid-render.
      queueMicrotask(() =>
        update((current) => applySignal(definition, current, name, scope, modelStateRef.current)),
      );
    },
    [definition, scope, update],
  );

  // Opening a diagram of a tutorial project.
  useEffect(() => {
    if (scope && viewId) signal("view-opened");
  }, [scope, viewId, signal]);

  // Features the learner used, reported by the canvas and the rest of the app.
  useEffect(() => {
    if (!scope) return;
    return subscribeDiagramEvent("tutorial-signal", (detail) => signal(detail.signal));
  }, [scope, signal]);

  const here = useMemo(() => ({ projectId: project?.id, viewId }), [project?.id, viewId]);
  const openStepDiagram = useCallback((step: TutorialStep) => run.openStep(step, here), [here, run]);

  /** Opens where a step happens and highlights what to use. */
  const showMe = useCallback(
    async (step: TutorialStep) => {
      run.noteShowMe(step.id);
      await run.openStep(step, here);
      if (step.highlight?.length) await spotlight(step.highlight);
    },
    [here, run],
  );

  return {
    ...run,
    active: Boolean(tutorial && progress),
    tutorial,
    place,
    /** The name of the open project when it is neither the tutorial's metamodel nor its model. */
    placeName: place === "elsewhere" || place === "variant" ? (project?.name ?? "") : "",
    diagram: modelState?.diagram ?? "",
    diagrams: modelState?.diagrams ?? [],
    showMe,
    openStepDiagram,
    navigate,
  };
}

/**
 * The coach on the project list. It appears when a running tutorial has
 * reached a step that happens there, and stays until the page is left.
 */
export function useTutorialCoachOnProjectList(allProjects: Project[] | undefined) {
  const [, setLocation] = useLocation();
  const runs = useMemo(
    () =>
      TUTORIALS.map((tutorial) => latestTutorialRun(tutorial, allProjects)).filter(
        (run): run is TutorialProjects => run !== null,
      ),
    [allProjects],
  );
  const [chosenId, setChosenId] = useState<string | null>(null);
  useEffect(() => {
    if (chosenId && runs.some((run) => run.tutorial.id === chosenId)) return;
    // A run waits here when its next step happens here, or when a lesson that
    // ended here waits for its question.
    const waiting = runs.find((run) => {
      const stored = loadTutorialProgress(run.tutorial, run.metamodel.id);
      const recap = pendingRecap(run.tutorial, stored);
      const where = currentStep(run.tutorial, stored)?.scope ?? recap?.steps[recap.steps.length - 1].scope;
      return where === "projects";
    });
    setChosenId(waiting?.tutorial.id ?? null);
  }, [chosenId, runs]);
  const tutorial = useMemo(() => runs.find((run) => run.tutorial.id === chosenId) ?? null, [chosenId, runs]);

  const navigate = useCallback((href: string) => setLocation(href), [setLocation]);
  const run = useTutorialRun(tutorial, allProjects, navigate);
  const openStepDiagram = useCallback((step: TutorialStep) => run.openStep(step, {}), [run]);
  const showMe = useCallback(
    async (step: TutorialStep) => {
      run.noteShowMe(step.id);
      await run.openStep(step, {});
      if (step.highlight?.length) await spotlight(step.highlight);
    },
    [run],
  );

  return {
    ...run,
    active: Boolean(tutorial && run.progress),
    tutorial,
    place: "projects" as CoachPlace,
    placeName: "",
    diagram: "",
    diagrams: [] as string[],
    showMe,
    openStepDiagram,
    navigate,
  };
}
