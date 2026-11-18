import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/queryClient";
import { api } from "@shared/routes";
import { apiCall } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import type { FlowNode } from "@shared/schema";
import type {
  FlowEdgeInput,
  SyncFlowNodeInput,
} from "@shared/flow-inputs";

export type InsertFlowNode = SyncFlowNodeInput;
export type InsertFlowEdge = FlowEdgeInput;

export function useNode(nodeId: string | null | undefined) {
  return useQuery<FlowNode | null>({
    queryKey: [api.nodes.get.path, nodeId],
    queryFn: async () => {
      if (!nodeId) return null;
      return apiCall(api.nodes.get, {
        params: { nodeId },
        allowNotFound: true,
      });
    },
    enabled: !!nodeId,
    staleTime: 60_000,
  });
}

export function useFlow(viewId: number) {
  return useQuery({
    queryKey: [api.flow.get.path, viewId],
    queryFn: async () =>
      apiCall(api.flow.get, { params: { viewId }, allowNotFound: true }),
    enabled: !!viewId,
  });
}

/** The save was refused because the stored diagram changed since it was loaded. */
export const isSaveConflict = (error: unknown) => error instanceof ApiError && error.status === 409;

export function useSyncFlow() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      viewId,
      nodes,
      edges,
      baseRevision,
    }: {
      viewId: number;
      nodes: InsertFlowNode[];
      edges: InsertFlowEdge[];
      /** Leave out to overwrite whatever is stored. */
      baseRevision?: string;
      /** Automatic saves do not announce themselves; the header shows the state. */
      quiet?: boolean;
    }) =>
      apiCall(api.flow.sync, {
        params: { viewId },
        body: { nodes, edges, ...(baseRevision ? { baseRevision } : {}) },
      }),
    onSuccess: (result, variables) => {
      // Elements are shared between diagrams, and cached diagrams never go
      // stale on their own: without this, switching away and back showed the
      // diagram as it was before the save.
      void queryClient.invalidateQueries({ queryKey: [api.flow.get.path] });
      // Related Formulas calculate over the whole project's saved relationships.
      void queryClient.invalidateQueries({ queryKey: [api.projects.graph.path] });
      // The project list shows and sorts by when a project was last edited.
      void queryClient.invalidateQueries({ queryKey: [api.projects.list.path] });
      const relabeled = result?.relabeled ?? 0;
      if (variables.quiet && relabeled === 0) return;
      toast({
        title: "Saved",
        description:
          relabeled > 0
            ? `Your diagram has been saved. ${relabeled === 1 ? "1 relationship in models now carries" : `${relabeled} relationships in models now carry`} the new name.`
            : "Your diagram has been saved successfully.",
        duration: relabeled > 0 ? 4000 : 2000,
      });
    },
    onError: (error) => {
      // A conflict is settled in its own dialog (SaveConflictDialog).
      if (isSaveConflict(error)) return;
      console.error("Flow save failed:", error);
      toast({
        variant: "destructive",
        title: "Save Failed",
        description:
          error instanceof Error
            ? error.message
            : "Could not save your changes. Please try again.",
      });
    },
  });
}
