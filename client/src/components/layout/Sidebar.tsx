import {
  useEffect,
  useMemo,
  useState,
  type DragEvent,
  type MouseEvent,
} from "react";
import { Link, useLocation } from "wouter";
import { useQueries, useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  LayoutGrid,
  Layers,
  Plus,
  Box,
  Home,
  Settings2,
  ChevronRight,
  ArrowRight,
  Check,
  GripVertical,
  AlertTriangle,
} from "lucide-react";
import * as Icons from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import type { FlowNode, Project, View } from "@shared/schema";
import type { ProjectType } from "@shared/schema";
import {
  getConfiguredMagicNodeTypes,
  type MetamodelSetup,
} from "@shared/metamodel-setup";
import { api, buildUrl } from "@shared/routes";
import { apiCall } from "@/lib/api-client";
import { apiRequest } from "@/lib/queryClient";
import {
  dispatchDiagramEvent,
  subscribeDiagramEvent,
} from "@/lib/diagram-events";
import { EditViewDialog } from "@/components/layout/EditViewDialog";
import { useCreateInternalView } from "@/hooks/use-internal-views";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sidebar as ShadcnSidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuAction,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  BASE_INSTANCE_TYPE_ITEMS,
  BASE_METAMODEL_ID,
  METAMODEL_NODE_DRAG_MIME,
  METAMODEL_NODE_TYPE_ITEMS,
  getDefaultNodeStyle,
  type SidebarCreateMetamodelNodeDetail,
  type SidebarCreateMetamodelNodeDragPayload,
  type SidebarNodeInsertMode,
  type SidebarNodeTransfer,
} from "./sidebar/SidebarConstants";
import { useProjectExport } from "./sidebar/useProjectExport";
import { ExportProjectDialog } from "./sidebar-parts/ExportProjectDialog";
import { SidebarViewList } from "./sidebar-parts/SidebarViewList";
import { SidebarPatternPalette } from "./sidebar-parts/SidebarPatternPalette";
import { AI_ASSISTANT_ENABLED, INTERNAL_VIEWS_ENABLED } from "@/lib/feature-flags";
import { supportsModelRules } from "@/components/flow/rules/model-rules";

interface SidebarProps {
  projectId: number;
  views: View[];
  currentViewId?: number;
  onCreateView: () => void;
  projectName?: string;
  projectType?: ProjectType;
  workspaceRole?: string | null;
  referencedProjects?: Project[];
  unavailableMetamodelIds?: number[];
  onRemoveReferencedMetamodel?: (id: number) => void;
  metamodelSetup?: MetamodelSetup | null;
}

const VIEW_ORDER_STORAGE_KEY = "mbse.diagram-view-order";

const applyPreferredOrder = <T,>(
  items: T[],
  getId: (item: T) => string,
  preferredOrder: string[] = [],
) => {
  const orderIndex = new Map(
    preferredOrder.map((id, index) => [id, index] as const),
  );
  return items.slice().sort((a, b) => {
    const aIndex = orderIndex.get(getId(a));
    const bIndex = orderIndex.get(getId(b));
    if (aIndex === undefined && bIndex === undefined) return 0;
    if (aIndex === undefined) return 1;
    if (bIndex === undefined) return -1;
    return aIndex - bIndex;
  });
};

export function Sidebar({
  projectId,
  views,
  currentViewId,
  onCreateView,
  projectName,
  projectType,
  workspaceRole,
  referencedProjects = [],
  unavailableMetamodelIds = [],
  onRemoveReferencedMetamodel,
  metamodelSetup,
}: SidebarProps) {
  const { username, role, capabilities } = useAuth();
  const visibleRole = workspaceRole ?? role;
  const canEditMetamodels =
    capabilities.canEditMetamodels || visibleRole === "admin" || visibleRole === "architect";
  const canSeeModelRules =
    capabilities.canEditInstances ||
    capabilities.canEditMetamodels ||
    visibleRole === "admin" ||
    visibleRole === "architect" ||
    visibleRole === "engineer";
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { setOpenMobile, isMobile } = useSidebar();
  const [editingView, setEditingView] = useState<View | null>(null);
  const [expandedViews, setExpandedViews] = useState<Set<number>>(new Set());
  const [selectedNodeByViewId, setSelectedNodeByViewId] = useState<
    Map<number, string | null>
  >(() => new Map());
  const [selectedReferencedProjectId, setSelectedReferencedProjectId] =
    useState<string>(BASE_METAMODEL_ID);
  const [selectedReferencedViewId, setSelectedReferencedViewId] =
    useState<string>("all");
  const [selectedMetamodelCreateProjectId, setSelectedMetamodelCreateProjectId] =
    useState<string>(BASE_METAMODEL_ID);
  const [selectedMetamodelCreateViewId, setSelectedMetamodelCreateViewId] =
    useState<string>("all");
  const [includeReferencedMetamodelViews, setIncludeReferencedMetamodelViews] =
    useState<boolean>(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [viewOrderByProject, setViewOrderByProject] = useState<
    Record<string, string[]>
  >(() => {
    if (typeof window === "undefined") return {};
    try {
      const stored = window.localStorage.getItem(VIEW_ORDER_STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });
  const [draggedViewId, setDraggedViewId] = useState<number | null>(null);
  const [viewDropTarget, setViewDropTarget] = useState<{
    id: number;
    position: "before" | "after";
  } | null>(null);
  const { isExporting, exportProject } = useProjectExport(projectId);
  const createInternalView = useCreateInternalView();

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      VIEW_ORDER_STORAGE_KEY,
      JSON.stringify(viewOrderByProject),
    );
  }, [viewOrderByProject]);

  const viewOrderKey = String(projectId);
  const orderedViews = useMemo(
    () =>
      applyPreferredOrder(
        views,
        (view) => String(view.id),
        viewOrderByProject[viewOrderKey],
      ),
    [viewOrderByProject, viewOrderKey, views],
  );

  const finishViewReorder = (
    targetViewId: number,
    position: "before" | "after",
  ) => {
    if (draggedViewId === null || draggedViewId === targetViewId) {
      setDraggedViewId(null);
      setViewDropTarget(null);
      return;
    }
    const nextOrder = orderedViews.map((view) => view.id);
    const sourceIndex = nextOrder.indexOf(draggedViewId);
    if (sourceIndex >= 0) {
      const [movedId] = nextOrder.splice(sourceIndex, 1);
      const targetIndex = nextOrder.indexOf(targetViewId);
      if (targetIndex < 0) return;
      nextOrder.splice(targetIndex + (position === "after" ? 1 : 0), 0, movedId);
      setViewOrderByProject((current) => ({
        ...current,
        [viewOrderKey]: nextOrder.map(String),
      }));
    }
    setDraggedViewId(null);
    setViewDropTarget(null);
  };

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

  const hasReferencedMetamodels = referencedProjects.length > 0;
  const visibleMetamodelNodeTypes = useMemo(() => {
    const configuredTypes = new Set(getConfiguredMagicNodeTypes(metamodelSetup));
    return METAMODEL_NODE_TYPE_ITEMS.filter((item) =>
      configuredTypes.has(item.type),
    );
  }, [metamodelSetup]);

  useEffect(() => {
    if (referencedProjects.length === 0) {
      setSelectedReferencedProjectId(BASE_METAMODEL_ID);
      setSelectedMetamodelCreateProjectId(BASE_METAMODEL_ID);
      return;
    }

    setSelectedReferencedProjectId((current) => {
      if (current === BASE_METAMODEL_ID) {
        return String(referencedProjects[0].id);
      }
      return referencedProjects.some((project) => String(project.id) === current)
        ? current
        : String(referencedProjects[0].id);
    });
  }, [referencedProjects]);

  useEffect(() => {
    if (referencedProjects.length === 0) {
      setSelectedMetamodelCreateProjectId(BASE_METAMODEL_ID);
      return;
    }

    setSelectedMetamodelCreateProjectId((current) => {
      if (current === BASE_METAMODEL_ID) return current;
      return referencedProjects.some((project) => String(project.id) === current)
        ? current
        : BASE_METAMODEL_ID;
    });
  }, [referencedProjects]);

  const filteredReferencedViews = useMemo(() => {
    if (selectedReferencedProjectId === BASE_METAMODEL_ID) return [];
    return referencedViews.find(
      ({ project }) => String(project.id) === selectedReferencedProjectId,
    )?.views ?? [];
  }, [referencedViews, selectedReferencedProjectId]);

  useEffect(() => {
    setSelectedReferencedViewId((current) => {
      if (selectedReferencedProjectId === BASE_METAMODEL_ID) return "all";
      if (current === "all") return current;
      return filteredReferencedViews.some((view) => String(view.id) === current)
        ? current
        : "all";
    });
  }, [filteredReferencedViews, selectedReferencedProjectId]);

  const filteredMetamodelCreateViews = useMemo(() => {
    if (selectedMetamodelCreateProjectId === BASE_METAMODEL_ID) return [];
    return referencedViews.find(
      ({ project }) => String(project.id) === selectedMetamodelCreateProjectId,
    )?.views ?? [];
  }, [referencedViews, selectedMetamodelCreateProjectId]);

  useEffect(() => {
    setSelectedMetamodelCreateViewId((current) => {
      if (selectedMetamodelCreateProjectId === BASE_METAMODEL_ID) return "all";
      if (filteredMetamodelCreateViews.length <= 1) {
        return filteredMetamodelCreateViews[0]
          ? String(filteredMetamodelCreateViews[0].id)
          : "all";
      }
      if (current === "all") return current;
      return filteredMetamodelCreateViews.some(
        (view) => String(view.id) === current,
      )
        ? current
        : "all";
    });
  }, [filteredMetamodelCreateViews, selectedMetamodelCreateProjectId]);

  const currentFlowQuery = useQuery({
    queryKey: [api.flow.get.path, currentViewId],
    queryFn: async () => {
      if (!currentViewId) return null;
      return apiCall(api.flow.get, {
        params: { viewId: currentViewId },
        allowNotFound: true,
      });
    },
    enabled: !!currentViewId,
    staleTime: 30_000,
  });

  const currentViewNodeIds = useMemo(() => {
    const ids = new Set<string>();
    const nodes = currentFlowQuery.data?.nodes ?? [];
    for (const node of nodes) ids.add(node.id);
    return ids;
  }, [currentFlowQuery.data]);

  const handleOpenInternalView = async (event: MouseEvent, nodeId: string) => {
    event.preventDefault();
    event.stopPropagation();
    try {
      const view = await createInternalView.mutateAsync({
        nodeId,
        parentViewId: currentViewId,
      });
      setLocation(`/project/${view.projectId}/view/${view.id}`);
      if (isMobile) setOpenMobile(false);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Failed to open internal view",
        description:
          err instanceof Error ? err.message : "Unexpected error occurred.",
      });
    }
  };

  const currentSelectedNodeId = useMemo(() => {
    if (!currentViewId) return null;
    return selectedNodeByViewId.get(currentViewId) ?? null;
  }, [currentViewId, selectedNodeByViewId]);

  const patternsQuery = useQuery({
    queryKey: [api.patterns.list.path, projectId],
    queryFn: async () => {
      const result = await apiCall(api.patterns.list, {
        params: { projectId },
        allowNotFound: true,
      });
      return result ?? [];
    },
    enabled: projectType === "instance",
    staleTime: 30_000,
  });

  const [isDiagramDirty, setIsDiagramDirty] = useState(false);

  useEffect(
    () =>
      subscribeDiagramEvent("diagram-dirty-state", (detail) => {
        setIsDiagramDirty(!!detail.isDirty);
      }),
    [],
  );

  const handleLinkClick = (event?: MouseEvent, href?: string) => {
    if (event && href && isDiagramDirty) {
      event.preventDefault();
      dispatchDiagramEvent("diagram-leave-request", { href });
      return;
    }
    if (isMobile) {
      setOpenMobile(false);
    }
  };


  const toggleExpanded = (viewId: number, nextOpen?: boolean) => {
    setExpandedViews((prev) => {
      const next = new Set(prev);
      const shouldOpen = nextOpen ?? !next.has(viewId);
      if (shouldOpen) {
        next.add(viewId);
      } else {
        next.delete(viewId);
      }
      return next;
    });
  };

  useEffect(
    () =>
      subscribeDiagramEvent("selected-node-changed", (detail) => {
        setSelectedNodeByViewId((prev) => {
          const next = new Map(prev);
          next.set(detail.viewId, detail.nodeId);
          return next;
        });
      }),
    [],
  );

  const getNodeMeta = (node: FlowNode) => {
    const data = node.data as {
      label?: string;
      type?: string;
      icon?: string;
      color?: string;
    } | null;
    const label = typeof data?.label === "string" ? data.label.trim() : "";
    const typeLabel = typeof data?.type === "string" ? data.type.trim() : "";
    const defaults = getDefaultNodeStyle(node.type, typeLabel);
    const iconName =
      typeof data?.icon === "string" && data.icon.trim()
        ? data.icon
        : defaults.iconName;
    const color =
      typeof data?.color === "string" && data.color.trim()
        ? data.color
        : defaults.color;
    return {
      label: label || node.id,
      typeLabel,
      iconName,
      color,
    };
  };

  const getCanonicalTypeId = (node: FlowNode) => {
    const ownerProjectId =
      typeof node.projectId === "number" ? node.projectId : undefined;
    return ownerProjectId ? `mm:${ownerProjectId}:${node.id}` : node.id;
  };

  const referencedPaletteItems = useMemo(() => {
    if (selectedReferencedProjectId === BASE_METAMODEL_ID) return [];

    const items = referencedViewEntries
      .filter(({ project, view }) => {
        if (String(project.id) !== selectedReferencedProjectId) return false;
        if (selectedReferencedViewId === "all") return true;
        return String(view.id) === selectedReferencedViewId;
      })
      .flatMap(({ project, view }) => {
        const flowQuery = referencedFlowByViewId.get(view.id);
        const nodes = ((flowQuery?.data?.nodes ?? []) as FlowNode[])
          .slice()
          .sort((a, b) =>
            getNodeMeta(a).label.localeCompare(getNodeMeta(b).label),
          );
        return nodes.map((node) => ({
          project,
          view,
          node,
          meta: getNodeMeta(node),
        }));
      });

    const uniqueByType = new Map<
      string,
      (typeof items)[number] & { duplicateCount: number }
    >();

    for (const item of items) {
      const typeId = getCanonicalTypeId(item.node);
      const existing = uniqueByType.get(typeId);
      if (existing) {
        existing.duplicateCount += 1;
        continue;
      }
      uniqueByType.set(typeId, { ...item, duplicateCount: 1 });
    }

    return Array.from(uniqueByType.values()).sort((a, b) =>
      a.meta.label.localeCompare(b.meta.label),
    );
  }, [
    referencedFlowByViewId,
    referencedViewEntries,
    selectedReferencedProjectId,
    selectedReferencedViewId,
  ]);

  const metamodelCreatePaletteItems = useMemo(() => {
    if (selectedMetamodelCreateProjectId === BASE_METAMODEL_ID) return [];

    const items = referencedViewEntries
      .filter(({ project, view }) => {
        if (String(project.id) !== selectedMetamodelCreateProjectId) return false;
        if (selectedMetamodelCreateViewId === "all") return true;
        return String(view.id) === selectedMetamodelCreateViewId;
      })
      .flatMap(({ project, view }) => {
        const flowQuery = referencedFlowByViewId.get(view.id);
        const nodes = ((flowQuery?.data?.nodes ?? []) as FlowNode[])
          .filter((node) =>
            ["partdef", "actiondef", "concerndef", "agentdef", "requirementdef"].includes(node.type || ""),
          )
          .slice()
          .sort((a, b) => getNodeMeta(a).label.localeCompare(getNodeMeta(b).label));
        return nodes.map((node) => ({
          project,
          view,
          node,
          meta: getNodeMeta(node),
        }));
      });

    const uniqueByType = new Map<
      string,
      (typeof items)[number] & { duplicateCount: number }
    >();

    for (const item of items) {
      const typeId = getCanonicalTypeId(item.node);
      const existing = uniqueByType.get(typeId);
      if (existing) {
        existing.duplicateCount += 1;
        continue;
      }
      uniqueByType.set(typeId, { ...item, duplicateCount: 1 });
    }

    return Array.from(uniqueByType.values()).sort((a, b) =>
      a.meta.label.localeCompare(b.meta.label),
    );
  }, [
    referencedFlowByViewId,
    referencedViewEntries,
    selectedMetamodelCreateProjectId,
    selectedMetamodelCreateViewId,
  ]);

  const handleInsertNode = async (
    nodeId: string,
    options?: {
      mode?: SidebarNodeInsertMode;
      typeId?: string;
      typeLabel?: string;
      icon?: string;
      color?: string;
    },
  ) => {
    if (!currentViewId) return;
    dispatchDiagramEvent("insert-node-into-view", {
      nodeId,
      typeId: options?.typeId,
      viewId: currentViewId,
      mode: options?.mode,
      typeLabel: options?.typeLabel,
      icon: options?.icon,
      color: options?.color,
    });
  };

  const handleMetamodelNodeDragStart = (
    event: DragEvent<HTMLElement>,
    payload: SidebarNodeTransfer,
  ) => {
    if (!currentViewId) {
      event.preventDefault();
      return;
    }

    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData(
      METAMODEL_NODE_DRAG_MIME,
      JSON.stringify(payload),
    );
    event.dataTransfer.setData("text/plain", payload.nodeId);
  };

  const handleMetamodelNodeTypeDragStart = (
    event: DragEvent<HTMLButtonElement>,
    payload: SidebarCreateMetamodelNodeDragPayload,
  ) => {
    if (!currentViewId) {
      event.preventDefault();
      return;
    }

    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData(
      METAMODEL_NODE_DRAG_MIME,
      JSON.stringify(payload),
    );
    event.dataTransfer.setData("text/plain", payload.typeLabel ?? payload.nodeType);
  };

  const handleCreateMetamodelNode = (
    options: Omit<SidebarCreateMetamodelNodeDetail, "viewId">,
  ) => {
    if (!currentViewId) return;
    dispatchDiagramEvent("create-metamodel-node-in-view", {
      viewId: currentViewId,
      ...options,
    });
  };

  const renderViewNodeList = ({
    view,
    nodes,
    flowState,
    isCurrentView,
    isReadOnly,
    sourceLabel,
    insertMode,
    showReadOnlyBadge = true,
  }: {
    view: View;
    nodes: FlowNode[];
    flowState?: { isLoading?: boolean; isError?: boolean };
    isCurrentView: boolean;
    isReadOnly: boolean;
    sourceLabel?: string;
    insertMode?: SidebarNodeInsertMode;
    showReadOnlyBadge?: boolean;
  }) => (
    <Collapsible
      key={`${isReadOnly ? "referenced" : "local"}-${view.id}`}
      open={expandedViews.has(view.id)}
      onOpenChange={(open) => toggleExpanded(view.id, open)}
      onDragOver={(event) => {
        if (isReadOnly || draggedViewId === null || draggedViewId === view.id) {
          return;
        }
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        const bounds = event.currentTarget.getBoundingClientRect();
        setViewDropTarget({
          id: view.id,
          position:
            event.clientY < bounds.top + bounds.height / 2 ? "before" : "after",
        });
      }}
      onDrop={(event) => {
        if (isReadOnly) return;
        event.preventDefault();
        finishViewReorder(
          view.id,
          viewDropTarget?.id === view.id ? viewDropTarget.position : "before",
        );
      }}
    >
      <SidebarMenuItem
        className={cn(
          "group/item rounded-md transition-colors",
          viewDropTarget?.id === view.id &&
            (viewDropTarget.position === "before"
              ? "border-t-2 border-primary"
              : "border-b-2 border-primary"),
        )}
      >
        <SidebarMenuButton
          asChild={!isReadOnly}
          isActive={isCurrentView}
          tooltip={view.name}
          className={cn(
            "transition-all duration-200 pr-14",
            isCurrentView
              ? "bg-primary text-white hover:bg-primary/90"
              : "text-white/70 hover:bg-white/5 hover:text-white hover:pl-3",
            isReadOnly && "cursor-default hover:pl-2",
          )}
        >
          {isReadOnly ? (
            <div className="flex items-center gap-3">
              <Box className="w-4 h-4 shrink-0 text-white/40" />
              <span className="truncate font-medium">{view.name}</span>
              {showReadOnlyBadge && (
                <span className="rounded-full border border-white/10 bg-white/5 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-white/45">
                  Read only
                </span>
              )}
            </div>
          ) : (
            <Link
              href={`/project/${projectId}/view/${view.id}`}
              onClick={(event) =>
                handleLinkClick(event, `/project/${projectId}/view/${view.id}`)
              }
              className="flex items-center gap-3"
            >
              <span
                draggable
                className="cursor-grab text-white/35 opacity-0 transition-opacity hover:text-white/70 group-hover/item:opacity-100 active:cursor-grabbing"
                title="Drag to reorder view"
                aria-label={`Reorder ${view.name}`}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onDragStart={(event) => {
                  event.stopPropagation();
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", String(view.id));
                  setDraggedViewId(view.id);
                  setViewDropTarget(null);
                }}
                onDragEnd={() => {
                  setDraggedViewId(null);
                  setViewDropTarget(null);
                }}
              >
                <GripVertical className="h-4 w-4" />
              </span>
              <Box
                className={cn(
                  "w-4 h-4 shrink-0",
                  isCurrentView ? "text-white" : "text-white/40",
                )}
              />
              <span className="truncate font-medium">{view.name}</span>
            </Link>
          )}
        </SidebarMenuButton>
        <SidebarMenuAction
          onClick={() => toggleExpanded(view.id)}
          className={cn(
            "right-7 opacity-100 hover:bg-white/10 text-white/60 hover:text-white",
            expandedViews.has(view.id) && "text-white",
          )}
          title={expandedViews.has(view.id) ? "Hide nodes" : "Show nodes"}
        >
          <ChevronRight
            className={cn(
              "w-4 h-4 transition-transform",
              expandedViews.has(view.id) && "rotate-90",
            )}
          />
        </SidebarMenuAction>
        {!isReadOnly && (
          <SidebarMenuAction
            onClick={() => setEditingView(view)}
            className="opacity-0 group-hover/item:opacity-100 transition-opacity hover:bg-white/10 text-white/60 hover:text-white"
            title="Configure view"
            data-testid={`button-configure-view-${view.id}`}
          >
            <Settings2 className="w-4 h-4" />
          </SidebarMenuAction>
        )}
        <CollapsibleContent>
          <SidebarMenuSub className="mt-1 gap-2">
            {sourceLabel && (
              <SidebarMenuSubItem>
                <SidebarMenuSubButton
                  asChild
                  size="sm"
                  className="text-white/40"
                >
                  <span>{sourceLabel}</span>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            )}
            {flowState?.isLoading && (
              <SidebarMenuSubItem>
                <SidebarMenuSubButton
                  asChild
                  size="sm"
                  className="text-white/50"
                >
                  <span>Loading nodes...</span>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            )}
            {flowState?.isError && (
              <SidebarMenuSubItem>
                <SidebarMenuSubButton
                  asChild
                  size="sm"
                  className="text-red-300"
                >
                  <span>Failed to load nodes</span>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            )}
            {!flowState?.isLoading &&
              !flowState?.isError &&
              nodes.length === 0 && (
                <SidebarMenuSubItem>
                  <SidebarMenuSubButton
                    asChild
                    size="sm"
                    className="text-white/40"
                  >
                    <span>No nodes yet</span>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              )}
            {nodes.map((node) => {
              const meta = getNodeMeta(node);
              const IconComponent = (Icons as any)[meta.iconName] || Icons.Box;
              const iconBg = meta.color
                ? `${meta.color}25`
                : "rgba(255,255,255,0.08)";
              const iconColor = meta.color || "rgba(255,255,255,0.6)";
              const alreadyInCurrentView =
                !isCurrentView && currentViewId
                  ? currentViewNodeIds.has(node.id)
                  : false;
              const isSelected = selectedNodeByViewId.get(view.id) === node.id;
              const isReferencedSelection =
                !isSelected &&
                !isCurrentView &&
                !!currentSelectedNodeId &&
                currentSelectedNodeId === node.id;
              const dragPayload =
                !isCurrentView && currentViewId && insertMode
                  ? {
                      nodeId: node.id,
                      typeId:
                        insertMode === "create-instance-node"
                          ? getCanonicalTypeId(node)
                          : undefined,
                      viewId: currentViewId,
                      mode: insertMode,
                      typeLabel: meta.label,
                      icon: meta.iconName,
                      color: meta.color,
                    }
                  : null;
              return (
                <SidebarMenuSubItem key={node.id}>
                  <SidebarMenuSubButton
                    asChild
                    size="sm"
                    className={cn(
                      "text-white/70",
                      isSelected &&
                        "bg-white/10 text-white border border-white/20",
                      isReferencedSelection &&
                        "border border-dashed border-white/20 bg-white/[0.04] text-white/80",
                    )}
                  >
                    <div
                      className={cn(
                        "flex items-center gap-2 min-w-0 group/node",
                        dragPayload && "cursor-grab active:cursor-grabbing",
                      )}
                      draggable={Boolean(dragPayload)}
                      onDragStart={(event) =>
                        dragPayload
                          ? handleMetamodelNodeDragStart(event, dragPayload)
                          : undefined
                      }
                    >
                      <span
                        className="h-5 w-5 rounded flex items-center justify-center shrink-0"
                        style={{ backgroundColor: iconBg, color: iconColor }}
                      >
                        <IconComponent className="h-3.5 w-3.5" />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block truncate text-[13px] leading-tight">
                          {meta.label}
                        </span>
                        {meta.typeLabel && (
                          <span className="block text-[10px] uppercase tracking-wide text-white/40 truncate">
                            {meta.typeLabel}
                          </span>
                        )}
                      </span>
                      {!isCurrentView && currentViewId && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={cn(
                            "h-6 w-6 opacity-0 group-hover/node:opacity-100 transition-opacity",
                            alreadyInCurrentView
                              ? "text-white/20 cursor-not-allowed"
                              : "text-white/50 hover:text-white hover:bg-white/10",
                          )}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            if (alreadyInCurrentView) return;
                            void handleInsertNode(node.id, {
                              mode: insertMode,
                              typeId:
                                insertMode === "create-instance-node"
                                  ? getCanonicalTypeId(node)
                                  : undefined,
                              typeLabel: meta.label,
                              icon: meta.iconName,
                              color: meta.color,
                            });
                          }}
                          title={
                            alreadyInCurrentView
                              ? "Already in current view"
                              : "Insert into current view"
                          }
                          data-testid={`button-insert-node-${node.id}`}
                          disabled={alreadyInCurrentView}
                        >
                          {alreadyInCurrentView ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : (
                            <ArrowRight className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      )}
                      {INTERNAL_VIEWS_ENABLED && !isReadOnly && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover/node:opacity-100 transition-opacity text-white/50 hover:text-white hover:bg-white/10"
                          onClick={(event) =>
                            handleOpenInternalView(event, node.id)
                          }
                          title="Open internal view"
                          data-testid={`button-open-internal-view-${node.id}`}
                        >
                          <Layers className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              );
            })}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );

  const renderReferencedNodePalette = () => {
    if (referencedProjects.length === 0) return null;

    const selectedProject =
      selectedReferencedProjectId === BASE_METAMODEL_ID
        ? null
        : referencedProjects.find(
            (project) => String(project.id) === selectedReferencedProjectId,
          ) ?? null;
    const selectedProjectIsUnavailable =
      selectedProject !== null &&
      unavailableMetamodelIds.includes(selectedProject.id);

    const selectedReferencedFlowQueries =
      getReferencedFlowQueriesForSelection(
        selectedReferencedProjectId,
        selectedReferencedViewId,
      );
    const paletteLoading =
      selectedReferencedProjectId !== BASE_METAMODEL_ID &&
      selectedReferencedFlowQueries.some((query) => query.isFetching);
    const paletteError =
      selectedReferencedProjectId !== BASE_METAMODEL_ID &&
      selectedReferencedFlowQueries.some((query) => query.isError);

    return (
      <SidebarGroup>
        <SidebarGroupContent>
          <div className="space-y-3 px-1">
            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <div className="grid gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
                    Metamodel
                  </Label>
                  <Select
                    value={selectedReferencedProjectId}
                    onValueChange={setSelectedReferencedProjectId}
                  >
                    <SelectTrigger className="border-white/10 bg-white/5 text-white">
                      <SelectValue placeholder="Select metamodel" />
                    </SelectTrigger>
                    <SelectContent>
                      {referencedProjects.length === 0 && (
                        <SelectItem value={BASE_METAMODEL_ID}>
                          Base Metamodel
                        </SelectItem>
                      )}
                      {referencedProjects.map((project) => (
                        <SelectItem
                          key={project.id}
                          value={String(project.id)}
                        >
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
                    Diagram
                  </Label>
                  <Select
                    value={selectedReferencedViewId}
                    onValueChange={setSelectedReferencedViewId}
                    disabled={selectedReferencedProjectId === BASE_METAMODEL_ID}
                  >
                    <SelectTrigger className="border-white/10 bg-white/5 text-white">
                      <SelectValue placeholder="Select diagram" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All diagrams</SelectItem>
                      {filteredReferencedViews.map((view) => (
                        <SelectItem key={view.id} value={String(view.id)}>
                          {view.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {selectedProject?.description && (
                <p className="mt-3 text-xs text-white/50">
                  {selectedProject.description}
                </p>
              )}
              {selectedProjectIsUnavailable && (
                <div
                  className="mt-3 rounded-md border border-amber-400/30 bg-amber-500/10 p-2.5 text-xs text-amber-100"
                  role="alert"
                >
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">Metamodel unavailable</p>
                      <p className="mt-1 text-amber-100/70">
                        This reference cannot be loaded. Remove it to restore the
                        default instance modeling state.
                      </p>
                      {onRemoveReferencedMetamodel && selectedProject && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-2 border-amber-300/40 bg-transparent text-amber-100 hover:bg-amber-300/10 hover:text-white"
                          onClick={() =>
                            onRemoveReferencedMetamodel(selectedProject.id)
                          }
                          data-testid={`button-remove-unavailable-reference-${selectedProject.id}`}
                        >
                          Remove reference
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {selectedReferencedProjectId === BASE_METAMODEL_ID && (
                <p className="mt-3 text-xs text-white/50">
                  Standard fallback types for instance modeling without a referenced metamodel.
                </p>
              )}
            </div>

            {paletteLoading && (
              <div className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/55">
                Loading referenced classes...
              </div>
            )}

            {paletteError && (
              <div className="rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                Failed to load referenced classes.
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-1 h-auto px-0 text-xs text-red-100 underline hover:bg-transparent hover:text-white"
                  onClick={() =>
                    retryReferencedFlows(
                      selectedReferencedProjectId,
                      selectedReferencedViewId,
                    )
                  }
                  data-testid="button-retry-referenced-classes"
                >
                  Try again
                </Button>
              </div>
            )}

            {!paletteLoading &&
              !paletteError &&
              selectedReferencedProjectId !== BASE_METAMODEL_ID && (
                <div className="space-y-2">
                  {referencedPaletteItems.length === 0 ? (
                    <div className="rounded-md border border-dashed border-white/10 px-3 py-2 text-xs text-white/45">
                      No classes found for this filter.
                    </div>
                  ) : (
                    referencedPaletteItems.map(
                      ({ node, meta, view, duplicateCount }) => {
                        const IconComponent =
                          (Icons as Record<string, any>)[meta.iconName] ||
                          Icons.Box;
                        const typeId = getCanonicalTypeId(node);
                        const alreadyInCurrentView = currentViewId
                          ? currentViewNodeIds.has(node.id)
                          : false;
                        const dragPayload = currentViewId
                          ? {
                              nodeId: node.id,
                              typeId,
                              viewId: currentViewId,
                              mode: "create-instance-node" as const,
                              typeLabel: meta.label,
                              icon: meta.iconName,
                              color: meta.color,
                            }
                          : null;

                        return (
                          <div
                            key={typeId}
                            aria-disabled={!currentViewId || alreadyInCurrentView}
                            draggable={Boolean(dragPayload && !alreadyInCurrentView)}
                            onDragStart={(event) =>
                              dragPayload && !alreadyInCurrentView
                                ? handleMetamodelNodeDragStart(event, dragPayload)
                                : undefined
                            }
                            className={cn(
                              "w-full rounded-lg border p-3 text-left transition-colors",
                              alreadyInCurrentView
                                ? "cursor-not-allowed border-white/10 bg-white/[0.04] opacity-60"
                                : currentViewId
                                  ? "cursor-grab border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10 active:cursor-grabbing"
                                  : "cursor-not-allowed border-white/10 bg-white/[0.04] opacity-50",
                            )}
                            data-testid={`button-insert-referenced-class-${typeId}`}
                          >
                            <div className="flex items-start gap-3">
                              <span
                                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md"
                                style={{
                                  backgroundColor: `${meta.color}25`,
                                  color: meta.color,
                                }}
                              >
                                <IconComponent className="h-4 w-4" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block text-sm font-medium text-white">
                                  {meta.label}
                                </span>
                                <span className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-white/50">
                                  {meta.typeLabel && <span>{meta.typeLabel}</span>}
                                  <span>{view.name}</span>
                                  {duplicateCount > 1 && (
                                    <span>{duplicateCount} diagrams</span>
                                  )}
                                </span>
                              </span>
                              {alreadyInCurrentView ? (
                                <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-white/5 text-white/45">
                                  <Check className="h-3.5 w-3.5" />
                                </span>
                              ) : null}
                            </div>
                          </div>
                        );
                      },
                    )
                  )}
                </div>
              )}

            {selectedReferencedProjectId === BASE_METAMODEL_ID && (
              <div className="space-y-2">
                {BASE_INSTANCE_TYPE_ITEMS.map((item) => {
                  const IconComponent =
                    (Icons as Record<string, any>)[item.iconName] || Icons.Box;
                  const alreadyInCurrentView = currentViewId
                    ? currentViewNodeIds.has(item.id)
                    : false;
                  const dragPayload = currentViewId
                    ? {
                        nodeId: item.id,
                        typeId: item.id,
                        viewId: currentViewId,
                        mode: "create-instance-node" as const,
                        typeLabel: item.label,
                        icon: item.iconName,
                        color: item.color,
                      }
                    : null;

                  return (
                    <div
                      key={item.id}
                      aria-disabled={!currentViewId}
                      draggable={Boolean(dragPayload)}
                      onDragStart={(event) =>
                        dragPayload
                          ? handleMetamodelNodeDragStart(event, dragPayload)
                          : undefined
                      }
                      className={cn(
                        "w-full rounded-lg border p-3 text-left transition-colors",
                        currentViewId
                          ? "cursor-grab border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10 active:cursor-grabbing"
                          : "cursor-not-allowed border-white/10 bg-white/[0.04] opacity-50",
                      )}
                      data-testid={`button-insert-base-class-${item.id}`}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md"
                          style={{
                            backgroundColor: `${item.color}25`,
                            color: item.color,
                          }}
                        >
                          <IconComponent className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-white">
                            {item.label}
                          </span>
                          <span className="mt-1 block text-[11px] text-white/50">
                            {item.description}
                          </span>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {!currentViewId && (
              <div className="rounded-md border border-dashed border-white/10 px-3 py-2 text-xs text-white/45">
                Select a diagram view to drop referenced classes into it.
              </div>
            )}
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  };

  const renderMetamodelCreatePalette = () => {
    const selectedProject =
      selectedMetamodelCreateProjectId === BASE_METAMODEL_ID
        ? null
        : referencedProjects.find(
            (project) => String(project.id) === selectedMetamodelCreateProjectId,
          ) ?? null;

    const selectedMetamodelCreateFlowQueries =
      getReferencedFlowQueriesForSelection(
        selectedMetamodelCreateProjectId,
        selectedMetamodelCreateViewId,
      );
    const paletteLoading =
      selectedMetamodelCreateProjectId !== BASE_METAMODEL_ID &&
      selectedMetamodelCreateFlowQueries.some((query) => query.isFetching);
    const paletteError =
      selectedMetamodelCreateProjectId !== BASE_METAMODEL_ID &&
      selectedMetamodelCreateFlowQueries.some((query) => query.isError);

    const showAllMetamodelCreateViewsOption =
      filteredMetamodelCreateViews.length > 1;

    return (
      <div className="space-y-3 px-1">
        {hasReferencedMetamodels ? (
          <div className="rounded-lg border border-white/10 bg-white/5 p-3">
            <div className="grid gap-3">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
                  Parent Metamodel
                </Label>
                <Select
                  value={selectedMetamodelCreateProjectId}
                  onValueChange={setSelectedMetamodelCreateProjectId}
                >
                  <SelectTrigger className="border-white/10 bg-white/5 text-white">
                    <SelectValue placeholder="Select metamodel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={BASE_METAMODEL_ID}>
                      Common Model
                    </SelectItem>
                    {referencedProjects.map((project) => (
                      <SelectItem key={project.id} value={String(project.id)}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedMetamodelCreateProjectId !== BASE_METAMODEL_ID &&
              filteredMetamodelCreateViews.length > 1 ? (
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
                    Diagram
                  </Label>
                  <Select
                    value={selectedMetamodelCreateViewId}
                    onValueChange={setSelectedMetamodelCreateViewId}
                  >
                    <SelectTrigger className="border-white/10 bg-white/5 text-white">
                      <SelectValue placeholder="Select diagram" />
                    </SelectTrigger>
                    <SelectContent>
                      {showAllMetamodelCreateViewsOption ? (
                        <SelectItem value="all">All diagrams</SelectItem>
                      ) : null}
                      {filteredMetamodelCreateViews.map((view) => (
                        <SelectItem key={view.id} value={String(view.id)}>
                          {view.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </div>
            {selectedProject?.description && (
              <p className="mt-3 text-xs text-white/50">
                {selectedProject.description}
              </p>
            )}
            {selectedMetamodelCreateProjectId === BASE_METAMODEL_ID ? (
              <p className="mt-3 text-xs text-white/50">
                Create one of the {visibleMetamodelNodeTypes.length} enabled
                magic node types.
              </p>
            ) : (
              <p className="mt-3 text-xs text-white/50">
                Create a child class that inherits from a referenced metamodel type.
              </p>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70">
            These are the 7 standard node types that can be used in the metamodel.
          </div>
        )}

        {selectedMetamodelCreateProjectId === BASE_METAMODEL_ID ? (
          <>
             {visibleMetamodelNodeTypes.map((item) => {
              const IconComponent =
                (Icons as Record<string, any>)[item.iconName] || Icons.Box;
              const disabled = !currentViewId;
              return (
                <button
                  key={item.type}
                  type="button"
                  onClick={() =>
                    handleCreateMetamodelNode({
                      nodeType: item.type,
                      typeLabel: item.label,
                      icon: item.iconName,
                      color: item.color,
                    })
                  }
                  disabled={disabled}
                  draggable={!disabled}
                  onDragStart={(event) =>
                    handleMetamodelNodeTypeDragStart(event, {
                      viewId: currentViewId!,
                      nodeType: item.type,
                      typeLabel: item.label,
                      icon: item.iconName,
                      color: item.color,
                    })
                  }
                  className={cn(
                    "w-full rounded-lg border border-white/10 bg-white/5 p-3 text-left transition-colors",
                    disabled
                      ? "cursor-not-allowed opacity-50"
                      : "cursor-grab hover:bg-white/10 hover:border-white/20 active:cursor-grabbing",
                  )}
                  data-testid={`button-create-sidebar-${item.type}`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
                      style={{
                        backgroundColor: `${item.color}25`,
                        color: item.color,
                      }}
                    >
                      <IconComponent className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-white">
                        {item.label}
                      </span>
                      <span className="block text-xs text-white/55">
                        {item.description}
                      </span>
                    </span>
                  </div>
                </button>
              );
            })}
          </>
        ) : (
          <>
            {paletteLoading && (
              <div className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/55">
                Loading referenced classes...
              </div>
            )}

            {paletteError && (
              <div className="rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                Failed to load referenced classes.
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-1 h-auto px-0 text-xs text-red-100 underline hover:bg-transparent hover:text-white"
                  onClick={() =>
                    retryReferencedFlows(
                      selectedMetamodelCreateProjectId,
                      selectedMetamodelCreateViewId,
                    )
                  }
                  data-testid="button-retry-referenced-classes"
                >
                  Try again
                </Button>
              </div>
            )}

            {!paletteLoading && !paletteError && (
              <div className="space-y-2">
                {metamodelCreatePaletteItems.length === 0 ? (
                  <div className="rounded-md border border-dashed border-white/10 px-3 py-2 text-xs text-white/45">
                    No classes found for this filter.
                  </div>
                ) : (
                  metamodelCreatePaletteItems.map(
                    ({ node, meta, view, duplicateCount }) => {
                      const IconComponent =
                        (Icons as Record<string, any>)[meta.iconName] || Icons.Box;
                      const typeId = getCanonicalTypeId(node);
                      const nodeType = (node.type || "partdef") as SidebarCreateMetamodelNodeDetail["nodeType"];
                      const disabled = !currentViewId;
                      const dragPayload = currentViewId
                        ? {
                            viewId: currentViewId,
                            nodeType,
                            parentTypeId: typeId,
                            typeLabel: meta.label,
                            icon: meta.iconName,
                            color: meta.color,
                          }
                        : null;

                      return (
                        <button
                          key={`metamodel-create-${typeId}`}
                          type="button"
                          onClick={() =>
                            handleCreateMetamodelNode({
                              nodeType,
                              parentTypeId: typeId,
                              typeLabel: meta.label,
                              icon: meta.iconName,
                              color: meta.color,
                            })
                          }
                          disabled={disabled}
                          draggable={Boolean(dragPayload)}
                          onDragStart={(event) =>
                            dragPayload
                              ? handleMetamodelNodeTypeDragStart(event, dragPayload)
                              : undefined
                          }
                          className={cn(
                            "w-full rounded-lg border p-3 text-left transition-colors",
                            disabled
                              ? "cursor-not-allowed border-white/10 bg-white/[0.04] opacity-50"
                              : "cursor-grab border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10 active:cursor-grabbing",
                          )}
                          data-testid={`button-create-child-class-${typeId}`}
                        >
                          <div className="flex items-start gap-3">
                            <span
                              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md"
                              style={{
                                backgroundColor: `${meta.color}25`,
                                color: meta.color,
                              }}
                            >
                              <IconComponent className="h-4 w-4" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-medium text-white">
                                {meta.label}
                              </span>
                              <span className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-white/50">
                                {meta.typeLabel && <span>{meta.typeLabel}</span>}
                                <span>{view.name}</span>
                                {duplicateCount > 1 && <span>{duplicateCount} diagrams</span>}
                              </span>
                              <span className="mt-1 block text-[11px] text-white/40">
                                New child class
                              </span>
                            </span>
                          </div>
                        </button>
                      );
                    },
                  )
                )}
              </div>
            )}
          </>
        )}

        {!currentViewId && (
          <div className="rounded-md border border-dashed border-white/10 px-3 py-2 text-xs text-white/45">
            Select a diagram view to create node types.
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <ShadcnSidebar className="border-r border-sidebar-border bg-[#1e293b] text-white shadow-2xl z-20">
        <SidebarHeader className="p-4 border-b border-white/10 bg-[#1e293b]">
          <Link
            href="/projects"
            onClick={(event) => handleLinkClick(event, "/projects")}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity mb-4 group"
          >
            <div className="bg-primary/20 p-2 rounded-lg group-hover:bg-primary/30 transition-colors">
              <LayoutGrid className="w-5 h-5 text-primary" />
            </div>
            <div>
              <span className="text-[10px] font-medium text-white/60 uppercase tracking-wider block leading-none mb-1">
                Workspace
              </span>
              <h1 className="font-bold text-sm truncate max-w-[140px] leading-tight text-white">
                {projectName || "Loading..."}
              </h1>
            </div>
          </Link>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-white/5 text-xs">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="truncate opacity-80 text-white/80">
              {username}
            </span>
            {visibleRole ? (
              <span className="ml-auto rounded border border-white/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-white/50">
                {visibleRole}
              </span>
            ) : null}
          </div>
        </SidebarHeader>

        <SidebarContent className="bg-[#1e293b]">
          {projectType === "instance" ? (
            <Tabs
              defaultValue="metamodels"
              className="flex h-full flex-col px-2 pt-3"
            >
              <TabsList
                className={cn(
                  "grid w-full bg-white/5 p-1 text-white/60",
                  "grid-cols-2",
                )}
              >
                <TabsTrigger
                  value="metamodels"
                  className="text-xs font-semibold uppercase tracking-wide data-[state=active]:bg-white data-[state=active]:text-slate-900"
                >
                  Metamodels
                </TabsTrigger>
                <TabsTrigger
                  value="diagrams"
                  className="text-xs font-semibold uppercase tracking-wide data-[state=active]:bg-white data-[state=active]:text-slate-900"
                >
                  Diagram Views
                </TabsTrigger>
              </TabsList>

              <TabsContent
                value="diagrams"
                className="mt-3 flex-1 space-y-3 overflow-y-auto pr-1"
              >
                <SidebarViewList
                  views={views}
                  orderedViews={orderedViews}
                  currentViewId={currentViewId}
                  flowByViewId={flowByViewId}
                  getNodeLabel={(node) => getNodeMeta(node).label}
                  renderViewNodeList={renderViewNodeList}
                  onCreateView={onCreateView}
                />

                <SidebarPatternPalette
                  projectId={projectId}
                  currentViewId={currentViewId}
                  patterns={(patternsQuery.data ?? []).map((pattern) => ({
                    id: pattern.id,
                    name: pattern.name,
                  }))}
                  isLoading={patternsQuery.isLoading}
                  isError={patternsQuery.isError}
                  onInsertPattern={(patternId, viewId) =>
                    dispatchDiagramEvent("insert-pattern-into-view", {
                      patternId,
                      viewId,
                    })
                  }
                  onConfigurePattern={(pattern) => {
                    const fullPattern = (patternsQuery.data ?? []).find(
                      (candidate) => candidate.id === pattern.id,
                    );
                    if (fullPattern) setEditingView(fullPattern);
                  }}
                  onNavigate={handleLinkClick}
                />
              </TabsContent>

              <TabsContent
                value="metamodels"
                className="mt-3 flex-1 space-y-3 overflow-y-auto pr-1"
              >
                {renderReferencedNodePalette()}
              </TabsContent>
            </Tabs>
          ) : (
            <Tabs
              defaultValue="node-types"
              className="flex h-full flex-col px-2 pt-3"
            >
              <TabsList
                className={cn(
                  "grid w-full bg-white/5 p-1 text-white/60",
                  "grid-cols-2",
                )}
              >
                <TabsTrigger
                  value="node-types"
                  className="text-xs font-semibold uppercase tracking-wide data-[state=active]:bg-white data-[state=active]:text-slate-900"
                >
                  Create Nodes
                </TabsTrigger>
                <TabsTrigger
                  value="diagrams"
                  className="text-xs font-semibold uppercase tracking-wide data-[state=active]:bg-white data-[state=active]:text-slate-900"
                >
                  Show Views
                </TabsTrigger>
              </TabsList>

              <TabsContent
                value="diagrams"
                className="mt-3 flex-1 overflow-y-auto pr-1"
              >
                <SidebarGroup>
                  <SidebarGroupContent>
                    {hasReferencedMetamodels && (
                      <div className="mb-3 px-1">
                        <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/75">
                          <Checkbox
                            checked={includeReferencedMetamodelViews}
                            onCheckedChange={(checked) =>
                              setIncludeReferencedMetamodelViews(checked === true)
                            }
                          />
                          <span>Include referenced metamodel views</span>
                        </label>
                      </div>
                    )}
                    <SidebarMenu>
                      {views.length === 0 ? (
                        <div className="px-4 py-8 text-center text-white/30 text-xs italic">
                          No views yet.
                        </div>
                      ) : (
                        orderedViews.map((view) => {
                          const flowQuery = flowByViewId.get(view.id);
                          const nodes = (
                            (flowQuery?.data?.nodes ?? []) as FlowNode[]
                          )
                            .slice()
                            .sort((a, b) =>
                              getNodeMeta(a).label.localeCompare(
                                getNodeMeta(b).label,
                              ),
                            );
                          return renderViewNodeList({
                            view,
                            nodes,
                            flowState: flowQuery,
                            isCurrentView: view.id === currentViewId,
                            isReadOnly: false,
                          });
                        })
                      )}

                      {hasReferencedMetamodels && includeReferencedMetamodelViews &&
                        referencedViews.map(
                          ({ project, views, isLoading, isError }) => (
                            <div key={project.id} className="mt-3 mb-2">
                              <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
                                {project.name}
                              </div>
                              {isLoading && (
                                <SidebarMenuItem>
                                  <SidebarMenuButton
                                    asChild
                                    className="text-white/40"
                                  >
                                    <span>Loading referenced views...</span>
                                  </SidebarMenuButton>
                                </SidebarMenuItem>
                              )}
                              {isError && (
                                <SidebarMenuItem>
                                  <SidebarMenuButton
                                    asChild
                                    className="text-red-300"
                                  >
                                    <span>Failed to load referenced views</span>
                                  </SidebarMenuButton>
                                </SidebarMenuItem>
                              )}
                              {!isLoading && !isError && views.length === 0 && (
                                <SidebarMenuItem>
                                  <SidebarMenuButton
                                    asChild
                                    className="text-white/40"
                                  >
                                    <span>No views available</span>
                                  </SidebarMenuButton>
                                </SidebarMenuItem>
                              )}
                              {!isLoading &&
                                !isError &&
                                views.map((view) => {
                                  const flowQuery = referencedFlowByViewId.get(
                                    view.id,
                                  );
                                  const nodes = (
                                    (flowQuery?.data?.nodes ?? []) as FlowNode[]
                                  )
                                    .slice()
                                    .sort((a, b) =>
                                      getNodeMeta(a).label.localeCompare(
                                        getNodeMeta(b).label,
                                      ),
                                    );
                                  return renderViewNodeList({
                                    view,
                                    nodes,
                                    flowState: flowQuery,
                                    isCurrentView: false,
                                    isReadOnly: true,
                                    sourceLabel: project.description
                                      ? `${project.description}`
                                      : undefined,
                                    insertMode: "insert-reference",
                                    showReadOnlyBadge: false,
                                  });
                                })}
                            </div>
                          ),
                        )}
                    </SidebarMenu>
                    <div className="px-2 pt-3">
                      <Button
                        variant="ghost"
                        className="w-full justify-center gap-2 rounded-md border border-white/10 bg-white/5 text-white/75 hover:bg-white/10 hover:text-white"
                        onClick={onCreateView}
                        data-testid="button-create-view-sidebar"
                      >
                        <Plus className="w-4 h-4" />
                        Create view
                      </Button>
                    </div>
                  </SidebarGroupContent>
                </SidebarGroup>
              </TabsContent>

              <TabsContent
                value="node-types"
                className="mt-3 flex-1 overflow-y-auto pr-1"
              >
                <SidebarGroup>
                  <SidebarGroupContent>
                    {renderMetamodelCreatePalette()}
                  </SidebarGroupContent>
                </SidebarGroup>
              </TabsContent>
            </Tabs>
          )}
        </SidebarContent>

        <SidebarFooter className="p-4 border-t border-white/10 bg-[#1e293b] space-y-2">
          <Separator className="bg-white/10" />
          {AI_ASSISTANT_ENABLED &&
          projectType === "metamodel" &&
          currentViewId &&
          canEditMetamodels ? (
            <Button
              variant="ghost"
              className="w-full justify-start text-white/70 hover:text-white hover:bg-white/10"
              onClick={() => dispatchDiagramEvent("metamodel-ai-assistant-toggle-request", { viewId: currentViewId })}
              data-testid="button-ai-model-assistant"
            >
              <Icons.Sparkles className="w-4 h-4 mr-2" />
              AI Model Assistant
            </Button>
          ) : null}
          {supportsModelRules(projectType) &&
          currentViewId &&
          canSeeModelRules ? (
            <Button
              variant="ghost"
              className="w-full justify-start text-white/70 hover:text-white hover:bg-white/10"
              onClick={() =>
                dispatchDiagramEvent("model-rules-toggle-request", {
                  viewId: currentViewId,
                })
              }
              data-testid="button-model-rules"
            >
              <Icons.ListChecks className="w-4 h-4 mr-2" />
              {projectType === "instance" ? "Instance Rules" : "Model Rules"}
            </Button>
          ) : null}
          <Button
            variant="ghost"
            className="w-full justify-start text-white/70 hover:text-white hover:bg-white/10"
            onClick={() => setExportDialogOpen(true)}
            data-testid="button-export-project"
          >
            <Icons.Download className="w-4 h-4 mr-2" />
            Export Project
          </Button>
          <Separator className="bg-white/10" />
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                className="w-full justify-start text-white/60 hover:text-white hover:bg-white/5 gap-2 h-9"
              >
                <Link
                  href="/projects"
                  onClick={(event) => handleLinkClick(event, "/projects")}
                >
                  <Home className="w-4 h-4" />
                  <span className="font-medium">Projects Overview</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </ShadcnSidebar>

      <ExportProjectDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        projectType={projectType ?? "metamodel"}
        referencedMetamodelCount={referencedProjects.length}
        views={views}
        isExporting={isExporting}
        onExport={(options) => void exportProject(options)}
      />

      <EditViewDialog
        view={editingView}
        open={!!editingView}
        onOpenChange={(open) => !open && setEditingView(null)}
      />
    </>
  );
}
