import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { api, buildUrl } from "@shared/routes";
import type { Project, View } from "@shared/schema";
import { findTutorialProjects } from "@/lib/tutorial-projects";
import {
  type TutorialScope,
  type TutorialSignal,
  type TutorialStep,
} from "@shared/tutorial";
import { apiCall } from "@/lib/api-client";
import { dispatchDiagramEvent, subscribeDiagramEvent } from "@/lib/diagram-events";
import { spotlight } from "@/lib/spotlight";
import {
  applySignal,
  loadTutorialProgress,
  restartTutorial,
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
  const scope: TutorialScope | null = !tutorial || !project
    ? null
    : project.id === tutorial.metamodel.id
      ? "metamodel"
      : "instance";

  const [progress, setProgress] = useState<TutorialProgress | null>(null);
  useEffect(() => {
    setProgress(runId ? loadTutorialProgress(runId) : null);
  }, [runId]);

  const update = useCallback(
    (change: (current: TutorialProgress) => TutorialProgress) => {
      if (!runId) return;
      setProgress((current) => change(current ?? loadTutorialProgress(runId)));
    },
    [runId],
  );
  useEffect(() => {
    if (runId && progress) saveTutorialProgress(runId, progress);
  }, [runId, progress]);

  const signal = useCallback(
    (name: TutorialSignal) => {
      if (!scope) return;
      // Some events are dispatched while another component renders (e.g. from
      // inside a state updater); defer so we never update state mid-render.
      queueMicrotask(() => update((current) => applySignal(current, name, scope)));
    },
    [scope, update],
  );

  // Opening a diagram of a tutorial project.
  useEffect(() => {
    if (scope && viewId) signal("view-opened");
  }, [scope, viewId, signal]);

  // Actions reported by the canvas and the rest of the app.
  useEffect(() => {
    if (!scope) return;
    const unsubscribers = [
      subscribeDiagramEvent("diagram-model-node-created", (detail) => {
        if (detail.viewId !== viewId) return;
        signal("node-created");
        if (detail.typeId?.startsWith("mm:")) signal("typed-node-created");
      }),
      subscribeDiagramEvent("diagram-model-edge-created", (detail) => {
        if (detail.viewId === viewId) signal("edge-created");
      }),
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

  /** Opens the diagram a step happens in and highlights what to use. */
  const showMe = useCallback(
    async (step: TutorialStep) => {
      if (!tutorial) return;
      const target = step.scope === "metamodel" ? tutorial.metamodel : tutorial.instance;
      if (!target) return;
      const views = await queryClient.fetchQuery<View[]>({
        queryKey: [api.views.list.path, target.id],
        queryFn: () => apiCall(api.views.list, { params: { projectId: target.id } }),
      });
      const firstView = views[0];
      const alreadyThere = project?.id === target.id && (viewId ?? null) === (firstView?.id ?? null);
      if (!alreadyThere) {
        navigate(firstView ? `/project/${target.id}/view/${firstView.id}` : buildUrl("/project/:id", { id: target.id }));
      }
      if (step.highlight?.length) await spotlight(step.highlight);
    },
    [navigate, project?.id, queryClient, tutorial, viewId],
  );

  return {
    active: Boolean(tutorial && progress),
    tutorial,
    scope,
    progress,
    skip: (stepId: string) => update((current) => skipStep(current, stepId)),
    restart: () => update(restartTutorial),
    setCollapsed: (collapsed: boolean) => update((current) => ({ ...current, collapsed })),
    showMe,
    navigate,
  };
}
