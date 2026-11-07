import { SidebarViewNodeList, type SidebarViewNodeListArgs } from "./sidebar-parts/SidebarViewNodeList";
import { ReferencedNodePalette } from "./sidebar-parts/ReferencedNodePalette";
import { MetamodelCreatePalette } from "./sidebar-parts/MetamodelCreatePalette";
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
import { LayoutGrid, Plus, Home } from "lucide-react";
import * as Icons from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import type { FlowNode, Project, View } from "@shared/schema";
import type { ProjectType } from "@shared/schema";
import {
  getConfiguredMagicNodeTypes,
  type MetamodelSetup,
} from "@shared/metamodel-setup";
import { api } from "@shared/routes";
import { apiCall } from "@/lib/api-client";
import {
  dispatchDiagramEvent,
  subscribeDiagramEvent,
} from "@/lib/diagram-events";
import { EditViewDialog } from "@/components/layout/EditViewDialog";
import { useCreateInternalView } from "@/hooks/use-internal-views";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sidebar as ShadcnSidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from "@/components/ui/sidebar";
import {
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
import { AI_ASSISTANT_ENABLED } from "@/lib/feature-flags";
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

  const renderViewNodeList = (args: SidebarViewNodeListArgs) => (
    <SidebarViewNodeList
      key={`${args.isReadOnly ? "referenced" : "local"}-${args.view.id}`}
      expandedViews={expandedViews}
      toggleExpanded={toggleExpanded}
      draggedViewId={draggedViewId}
      setViewDropTarget={setViewDropTarget}
      finishViewReorder={finishViewReorder}
      viewDropTarget={viewDropTarget}
      projectId={projectId}
      handleLinkClick={handleLinkClick}
      setDraggedViewId={setDraggedViewId}
      setEditingView={setEditingView}
      getNodeMeta={getNodeMeta}
      currentViewId={currentViewId}
      currentViewNodeIds={currentViewNodeIds}
      selectedNodeByViewId={selectedNodeByViewId}
      currentSelectedNodeId={currentSelectedNodeId}
      getCanonicalTypeId={getCanonicalTypeId}
      handleMetamodelNodeDragStart={handleMetamodelNodeDragStart}
      handleInsertNode={handleInsertNode}
      handleOpenInternalView={handleOpenInternalView}
      {...args}
    />
  );

  const renderReferencedNodePalette = () => (
    <ReferencedNodePalette
      referencedProjects={referencedProjects}
      selectedReferencedProjectId={selectedReferencedProjectId}
      unavailableMetamodelIds={unavailableMetamodelIds}
      getReferencedFlowQueriesForSelection={getReferencedFlowQueriesForSelection}
      selectedReferencedViewId={selectedReferencedViewId}
      setSelectedReferencedProjectId={setSelectedReferencedProjectId}
      setSelectedReferencedViewId={setSelectedReferencedViewId}
      filteredReferencedViews={filteredReferencedViews}
      onRemoveReferencedMetamodel={onRemoveReferencedMetamodel}
      retryReferencedFlows={retryReferencedFlows}
      referencedPaletteItems={referencedPaletteItems}
      getCanonicalTypeId={getCanonicalTypeId}
      currentViewId={currentViewId}
      currentViewNodeIds={currentViewNodeIds}
      handleMetamodelNodeDragStart={handleMetamodelNodeDragStart}
    />
  );

  const renderMetamodelCreatePalette = () => (
    <MetamodelCreatePalette
      selectedMetamodelCreateProjectId={selectedMetamodelCreateProjectId}
      referencedProjects={referencedProjects}
      getReferencedFlowQueriesForSelection={getReferencedFlowQueriesForSelection}
      selectedMetamodelCreateViewId={selectedMetamodelCreateViewId}
      filteredMetamodelCreateViews={filteredMetamodelCreateViews}
      hasReferencedMetamodels={hasReferencedMetamodels}
      setSelectedMetamodelCreateProjectId={setSelectedMetamodelCreateProjectId}
      setSelectedMetamodelCreateViewId={setSelectedMetamodelCreateViewId}
      visibleMetamodelNodeTypes={visibleMetamodelNodeTypes}
      currentViewId={currentViewId}
      handleCreateMetamodelNode={handleCreateMetamodelNode}
      handleMetamodelNodeTypeDragStart={handleMetamodelNodeTypeDragStart}
      retryReferencedFlows={retryReferencedFlows}
      metamodelCreatePaletteItems={metamodelCreatePaletteItems}
      getCanonicalTypeId={getCanonicalTypeId}
    />
  );

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
