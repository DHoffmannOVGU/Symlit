import type { Project, View } from "@shared/schema";

import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { apiCall } from "@/lib/api-client";
import { BASE_METAMODEL_ID } from "./SidebarConstants";

export interface UseSidebarFlowDataParams {
  views: View[];
  expandedViews: Set<number>;
  referencedProjects: Project[];
  selectedReferencedProjectId: string;
  selectedReferencedViewId: string;
}

export function useSidebarFlowData({
  views,
  expandedViews,
  referencedProjects,
  selectedReferencedProjectId,
  selectedReferencedViewId,
}: UseSidebarFlowDataParams) {
  const flowQueries = useQueries({
    queries: views.map((view) => ({
      queryKey: [api.flow.get.path, view.id],
      queryFn: async () =>
        apiCall(api.flow.get, {
          params: { viewId: view.id },
          allowNotFound: true,
        }),
      enabled: expandedViews.has(view.id),
      staleTime: 30_000,
    })),
  });

  const flowByViewId = useMemo(() => {
    const map = new Map<number, (typeof flowQueries)[number]>();
    views.forEach((view, index) => {
      map.set(view.id, flowQueries[index]);
    });
    return map;
  }, [views, flowQueries]);

  const referencedViewQueries = useQueries({
    queries: referencedProjects.map((project) => ({
      queryKey: [api.views.list.path, project.id, "referenced"],
      queryFn: async () =>
        apiCall(api.views.list, { params: { projectId: project.id } }),
      enabled: referencedProjects.length > 0,
      staleTime: 30_000,
    })),
  });

  const referencedViews = useMemo(
    () =>
      referencedProjects.map((project, index) => ({
        project,
        views: referencedViewQueries[index]?.data ?? [],
        isLoading: Boolean(referencedViewQueries[index]?.isLoading),
        isError: Boolean(referencedViewQueries[index]?.isError),
      })),
    [referencedProjects, referencedViewQueries],
  );

  const referencedViewEntries = useMemo(
    () =>
      referencedViews.flatMap(({ project, views }) =>
        views.map((view) => ({ project, view })),
      ),
    [referencedViews],
  );

  const referencedFlowEnabledViewIds = useMemo(() => {
    const ids = new Set<number>();

    for (const viewId of Array.from(expandedViews)) {
      ids.add(viewId);
    }

    if (selectedReferencedProjectId === BASE_METAMODEL_ID) {
      return ids;
    }

    for (const { project, view } of referencedViewEntries) {
      if (String(project.id) !== selectedReferencedProjectId) continue;
      if (
        selectedReferencedViewId !== "all" &&
        String(view.id) !== selectedReferencedViewId
      ) {
        continue;
      }
      ids.add(view.id);
    }

    return ids;
  }, [
    expandedViews,
    referencedViewEntries,
    selectedReferencedProjectId,
    selectedReferencedViewId,
  ]);

  const referencedFlowQueries = useQueries({
    queries: referencedViewEntries.map(({ view }) => ({
      queryKey: [api.flow.get.path, view.id, "referenced"],
      queryFn: async () =>
        apiCall(api.flow.get, {
          params: { viewId: view.id },
          allowNotFound: true,
        }),
      enabled: referencedFlowEnabledViewIds.has(view.id),
      // A reference can be removed and re-added while the same flow query
      // remains in React Query's cache. Always revalidate it so a replacement
      // cannot silently reuse an old palette.
      staleTime: 0,
    })),
  });

  const referencedFlowByViewId = useMemo(() => {
    const map = new Map<number, (typeof referencedFlowQueries)[number]>();
    referencedViewEntries.forEach(({ view }, index) => {
      map.set(view.id, referencedFlowQueries[index]);
    });
    return map;
  }, [referencedViewEntries, referencedFlowQueries]);

  const getReferencedFlowQueriesForSelection = (
    projectId: string,
    viewId: string,
  ) =>
    referencedViewEntries
      .filter(({ project, view }) => {
        if (String(project.id) !== projectId) return false;
        return viewId === "all" || String(view.id) === viewId;
      })
      .map(({ view }) => referencedFlowByViewId.get(view.id))
      .filter(
        (query): query is (typeof referencedFlowQueries)[number] =>
          Boolean(query),
      );

  const retryReferencedFlows = (projectId: string, viewId: string) => {
    void Promise.all(
      getReferencedFlowQueriesForSelection(projectId, viewId).map((query) =>
        query.refetch(),
      ),
    );
  };

  return {
    referencedViews,
    referencedViewEntries,
    referencedFlowByViewId,
    getReferencedFlowQueriesForSelection,
    retryReferencedFlows,
    flowByViewId,
  };
}
