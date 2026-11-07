import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { apiCall } from "@/lib/api-client";

export function useCreateInternalView() {
  return useMutation({
    mutationFn: async ({
      nodeId,
      name,
      description,
      parentViewId,
    }: {
      nodeId: string;
      name?: string;
      description?: string;
      parentViewId?: number;
    }) =>
      apiCall(api.internalViews.create, {
        params: { nodeId },
        body: { name, description, parentViewId },
      }),
  });
}

export function useInternalViews(projectId?: number) {
  return useQuery({
    queryKey: [api.internalViews.list.path, projectId],
    queryFn: async () => {
      if (!projectId) return [];
      return apiCall(api.internalViews.list, { params: { projectId } });
    },
    enabled: !!projectId,
    staleTime: 30_000,
  });
}
