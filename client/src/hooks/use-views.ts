import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { apiCall } from "@/lib/api-client";
import type { InsertView } from "@shared/schema";

export function useViews(projectId: number) {
  return useQuery({
    queryKey: [api.views.list.path, projectId],
    queryFn: async () =>
      apiCall(api.views.list, { params: { projectId } }),
    enabled: !!projectId,
  });
}

export function useView(id: number) {
  return useQuery({
    queryKey: [api.views.get.path, id],
    queryFn: async () =>
      apiCall(api.views.get, { params: { id }, allowNotFound: true }),
    enabled: !!id,
  });
}

export function useCreateView() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, ...data }: InsertView) =>
      apiCall(api.views.create, { params: { projectId }, body: data }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: [api.views.list.path, variables.projectId],
      });
    },
  });
}

export function useUpdateView() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      projectId: _projectId,
      ...data
    }: { id: number; projectId: number } & Partial<InsertView>) =>
      apiCall(api.views.update, { params: { id }, body: data }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: [api.views.list.path, variables.projectId],
      });
      queryClient.invalidateQueries({
        queryKey: [api.views.get.path, variables.id],
      });
    },
  });
}

export function useDeleteView() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: number; projectId: number }) => {
      await apiCall(api.views.delete, { params: { id } });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: [api.views.list.path, variables.projectId],
      });
      queryClient.invalidateQueries({
        queryKey: [api.patterns.list.path, variables.projectId],
      });
    },
  });
}
