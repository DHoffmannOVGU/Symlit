import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { api, buildUrl } from "@shared/routes";
import type { Project, View } from "@shared/schema";
import { findTutorialProjects } from "@/lib/tutorial-projects";
import {
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
  clearTutorialProgress,
  closeRecap,
  loadTutorialProgress,
  noteHelpUsed,
  returnToSkipped,
  saveTutorialProgress,
  skipStep,
  type TutorialProgress,
} from "@/lib/tutorial-progress";

interface UseTutorialCoachOptions {
  project: Project | undefined;
  allProjects: Project[] | undefined;
  viewId: number | undefined;
  isDiagramDirty: boolean;
}

export function useTutorialCoach({ project, allProjects, viewId, isDiagramDirty }: UseTutorialCoachOptions) {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const tutorial = useMemo(() => findTutorialProjects(project, allProjects), [project, allProjects]);
  const runId = tutorial?.metamodel.id;
  const definition = tutorial?.tutorial;
  const scope: TutorialScope | null = !tutorial || !project
    ? null
    : project.id === tutorial.metamodel.id
      ? "metamodel"
      : "instance";

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
    if (runId && progress) saveTutorialProgress(runId, progress);
  }, [runId, progress]);

  // What the open diagram contains, reported by the canvas.
  const [modelState, setModelState] = useState<TutorialModelState | null>(null);
  const modelStateRef = useRef<TutorialModelState | null>(null);
  modelStateRef.current = modelState;
  useEffect(() => {
    setModelState(null);
    if (!scope || !viewId) return;
    return subscribeDiagramEvent("tutorial-model-state", (detail) => {
      // Reported while the canvas renders; defer so we never update state mid-render.
      if (detail.viewId === viewId) queueMicrotask(() => setModelState(detail.state));
    });
  }, [scope, viewId]);

  // Steps that ask for a result complete when the model shows it.
  useEffect(() => {
    if (modelState && progress && definition) update((current) => applyModelState(definition, current, modelState));
  }, [definition, modelState, progress, update]);

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
    const unsubscribers = [
      subscribeDiagramEvent("diagram-save-request", (detail) => {
        if (detail.viewId === viewId) signal("saved");
      }),
      subscribeDiagramEvent("tutorial-signal", (detail) => signal(detail.signal)),
    ];
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [scope, signal, viewId]);

  const navigate = useCallback(
    (href: string) => {
      if (isDiagramDirty) dispatchDiagramEvent("diagram-leave-request", { href });
      else setLocation(href);
    },
    [isDiagramDirty, setLocation],
  );

  /** Opens the diagram a step happens in. Returns whether it was open already. */
  const openStepDiagram = useCallback(
    async (step: TutorialStep) => {
      if (!tutorial) return false;
      const target = step.scope === "metamodel" ? tutorial.metamodel : tutorial.instance;
      if (!target) return false;
      const views = await queryClient.fetchQuery<View[]>({
        queryKey: [api.views.list.path, target.id],
        queryFn: () => apiCall(api.views.list, { params: { projectId: target.id } }),
      });
      const firstView = views[0];
      const alreadyThere = project?.id === target.id && (viewId ?? null) === (firstView?.id ?? null);
      if (!alreadyThere) {
        navigate(firstView ? `/project/${target.id}/view/${firstView.id}` : buildUrl("/project/:id", { id: target.id }));
      }
      return alreadyThere;
    },
    [navigate, project?.id, queryClient, tutorial, viewId],
  );

  /** Opens the diagram a step happens in and highlights what to use. */
  const showMe = useCallback(
    async (step: TutorialStep) => {
      update((current) => noteHelpUsed(current, step.id, "showMe"));
      await openStepDiagram(step);
      if (step.highlight?.length) await spotlight(step.highlight);
    },
    [openStepDiagram, update],
  );

  /** Throws the tutorial projects away and starts again with fresh ones. */
  const restart = useCallback(async () => {
    if (!definition) return;
    if (runId) clearTutorialProgress(runId);
    const params = { tutorial: definition.id };
    await apiCall(api.tutorial.deleteOne, { params });
    const created = await apiCall(api.tutorial.createOne, { params });
    await queryClient.invalidateQueries({ queryKey: [api.projects.list.path] });
    setLocation(`/project/${created.metamodel.id}/view/${created.metamodelViewId}`);
  }, [definition, queryClient, runId, setLocation]);

  return {
    active: Boolean(tutorial && progress),
    tutorial,
    definition,
    scope,
    progress,
    skip: (stepId: string) => definition && update((current) => skipStep(definition, current, stepId)),
    returnToSkipped: () => update(returnToSkipped),
    answer: (lessonId: string, option: number) => update((current) => answerQuestion(current, lessonId, option)),
    closeRecap: (lessonId: string) => definition && update((current) => closeRecap(definition, current, lessonId)),
    /** Removes the projects of this tutorial. */
    remove: async () => {
      if (!definition) return;
      await apiCall(api.tutorial.deleteOne, { params: { tutorial: definition.id } });
      if (runId) clearTutorialProgress(runId);
      await queryClient.invalidateQueries({ queryKey: [api.projects.list.path] });
    },
    noteHint: (stepId: string) => update((current) => noteHelpUsed(current, stepId, "hints")),
    restart,
    setCollapsed: (collapsed: boolean) => update((current) => ({ ...current, collapsed })),
    showMe,
    openStepDiagram,
    navigate,
  };
}
