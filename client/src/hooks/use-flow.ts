import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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

export function useSyncFlow() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      viewId,
      nodes,
      edges,
    }: {
      viewId: number;
      nodes: InsertFlowNode[];
      edges: InsertFlowEdge[];
      /** Automatic saves do not announce themselves; the header shows the state. */
      quiet?: boolean;
    }) =>
      apiCall(api.flow.sync, {
        params: { viewId },
        body: { nodes, edges },
      }),
    onSuccess: (_result, variables) => {
      // The cached copy of the diagram is from before this save. Mark it
      // outdated, so that it is fetched again when the diagram is next opened:
      // otherwise coming back would show the old state, and the next save
      // would discard what was saved here. The open canvas already has the
      // saved state and is left alone (no refetch, undo history stays).
      void queryClient.invalidateQueries({
        queryKey: [api.flow.get.path, variables.viewId],
        exact: true,
        refetchType: "none",
      });
      if (variables.quiet) return;
      toast({
        title: "Saved",
        description: "Your diagram has been saved successfully.",
        duration: 2000,
      });
    },
    onError: (error) => {
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
