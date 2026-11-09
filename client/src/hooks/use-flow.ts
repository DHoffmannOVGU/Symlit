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
    }) =>
      apiCall(api.flow.sync, {
        params: { viewId },
        body: { nodes, edges, ...(baseRevision ? { baseRevision } : {}) },
      }),
    onSuccess: () => {
      // Elements are shared between diagrams, and cached diagrams never go
      // stale on their own: without this, switching away and back showed the
      // diagram as it was before the save.
      void queryClient.invalidateQueries({ queryKey: [api.flow.get.path] });
      toast({
        title: "Saved",
        description: "Your diagram has been saved successfully.",
        duration: 2000,
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
