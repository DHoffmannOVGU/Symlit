import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { apiCall } from "@/lib/api-client";
import type { InsertProject } from "@shared/schema";
import type { MetamodelSetup } from "@shared/metamodel-setup";

export function useProjects(userId: number | undefined) {
  return useQuery({
    queryKey: [api.projects.list.path, userId],
    queryFn: async () => {
      if (!userId) return [];
      return apiCall(api.projects.list);
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

/** The project templates offered when creating a project (without "Blank project"). */
export function useProjectTemplates() {
  return useQuery({
    queryKey: [api.projectTemplates.list.path],
    queryFn: async () => apiCall(api.projectTemplates.list),
    staleTime: Infinity,
  });
}

/** Creates a project (with any metamodels the template brings) from a project template. */
export function useCreateProjectFromTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      templateId,
      ...body
    }: { templateId: string; name?: string; description?: string; metamodelSetup?: MetamodelSetup | null }) =>
      apiCall(api.projectTemplates.create, { params: { templateId }, body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.projects.list.path] });
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
