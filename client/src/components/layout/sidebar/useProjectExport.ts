import { useCallback, useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { api, buildUrl } from "@shared/routes";
import type { ProjectExportInput } from "@shared/routes";

interface UseProjectExportResult {
  isExporting: boolean;
  exportProject: (options: ProjectExportInput) => Promise<void>;
}

/**
 * Encapsulates the "download project as JSON" flow: hit the export endpoint,
 * extract the suggested filename from `Content-Disposition`, and trigger a
 * browser download. Error/success toasts are surfaced via `useToast`.
 */
export function useProjectExport(projectId: number): UseProjectExportResult {
  const { toast } = useToast();
  const [isExporting, setExporting] = useState(false);

  const exportProject = useCallback(async (options: ProjectExportInput) => {
    try {
      setExporting(true);
      const url = buildUrl(api.projects.export.path, { id: projectId });
      const res = await apiRequest(api.projects.export.method, url, options);
      const blob = await res.blob();
      const contentDisposition = res.headers.get("Content-Disposition") || "";
      const match = /filename="([^"]+)"/.exec(contentDisposition);
      const extension = options.format === "json" ? "json" : "csv";
      const filename = match?.[1] || `project-${projectId}-export.${extension}`;
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
      toast({
        title: "Export created",
        description: "Your download should start shortly.",
        duration: 2500,
      });
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : "Could not export the project.";
      toast({
        variant: "destructive",
        title: "Export failed",
        description: message,
        duration: 2500,
      });
    } finally {
      setExporting(false);
    }
  }, [projectId, toast]);

  return { isExporting, exportProject };
}
