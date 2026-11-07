import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { apiCall } from "@/lib/api-client";
import type { InsertProject } from "@shared/schema";
import type { FlowEdgeInput, SyncFlowNodeInput } from "@shared/flow-inputs";

export function useProjects(userId: number | undefined) {
  return useQuery({
    queryKey: [api.projects.list.path, userId],
    queryFn: async () => {
      if (!userId) return [];
      return apiCall(api.projects.list, { params: { userId } });
    },
    enabled: !!userId,
  });
}

export function useProject(id: number) {
  return useQuery({
    queryKey: [api.projects.get.path, id],
    queryFn: async () =>
      apiCall(api.projects.get, { params: { id }, allowNotFound: true }),
    enabled: !!id,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertProject) =>
      apiCall(api.projects.create, { body: data }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: [api.projects.list.path, variables.userId],
      });
    },
  });
}

export function useCreateStarterProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      project,
      views,
    }: {
      project: InsertProject;
      views: Array<{
        name: string;
        description: string;
        nodes: SyncFlowNodeInput[];
        edges: FlowEdgeInput[];
      }>;
    }) =>
      apiCall(api.projects.createStarter, {
        body: { ...project, views },
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: [api.projects.list.path, variables.project.userId],
      });
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: { id: number } & Partial<InsertProject> & {
        referencedMetamodels?: number[];
      }) =>
      apiCall(api.projects.update, { params: { id }, body: data }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.projects.list.path] });
      queryClient.invalidateQueries({
        queryKey: [api.projects.get.path, variables.id],
      });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, userId }: { id: number; userId: number }) => {
      await apiCall(api.projects.delete, { params: { id } });
      return { userId };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: [api.projects.list.path, variables.userId],
      });
    },
  });
}
