import { SidebarProjectHeader } from "./sidebar-parts/SidebarProjectHeader";
import { SidebarTabsContent } from "./sidebar-parts/SidebarTabsContent";
import { SidebarFooterActions } from "./sidebar-parts/SidebarFooterActions";
import { useViewOrdering } from "./sidebar/useViewOrdering";
import { useSidebarFlowData } from "./sidebar/useSidebarFlowData";
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
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
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
import { Sidebar as ShadcnSidebar, useSidebar } from "@/components/ui/sidebar";
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
  const { isExporting, exportProject } = useProjectExport(projectId);
  const {
    draggedViewId,
    setViewDropTarget,
    finishViewReorder,
    viewDropTarget,
    setDraggedViewId,
    orderedViews,
  } = useViewOrdering({
    projectId,
    views,
  });
  const {
    referencedViews,
    referencedViewEntries,
    referencedFlowByViewId,
    getReferencedFlowQueriesForSelection,
    retryReferencedFlows,
    flowByViewId,
  } = useSidebarFlowData({
    views,
    expandedViews,
    referencedProjects,
    selectedReferencedProjectId,
    selectedReferencedViewId,
  });

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
        <SidebarProjectHeader
          handleLinkClick={handleLinkClick}
          projectName={projectName}
          username={username}
          visibleRole={visibleRole}
        />

        <SidebarTabsContent
          projectType={projectType}
          views={views}
          orderedViews={orderedViews}
          currentViewId={currentViewId}
          flowByViewId={flowByViewId}
          getNodeMeta={getNodeMeta}
          renderViewNodeList={renderViewNodeList}
          onCreateView={onCreateView}
          projectId={projectId}
          patternsQuery={patternsQuery}
          setEditingView={setEditingView}
          handleLinkClick={handleLinkClick}
          renderReferencedNodePalette={renderReferencedNodePalette}
          hasReferencedMetamodels={hasReferencedMetamodels}
          includeReferencedMetamodelViews={includeReferencedMetamodelViews}
          setIncludeReferencedMetamodelViews={setIncludeReferencedMetamodelViews}
          referencedViews={referencedViews}
          referencedFlowByViewId={referencedFlowByViewId}
          renderMetamodelCreatePalette={renderMetamodelCreatePalette}
        />

        <SidebarFooterActions
          projectType={projectType}
          currentViewId={currentViewId}
          canEditMetamodels={canEditMetamodels}
          canSeeModelRules={canSeeModelRules}
          setExportDialogOpen={setExportDialogOpen}
          handleLinkClick={handleLinkClick}
        />
      </ShadcnSidebar>

      <ExportProjectDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        projectType={projectType ?? "metamodel"}
        referencedMetamodelCount={referencedProjects.length}
        views={views}
        isExporting={isExporting}
        onExport={async (options) => {
          // Close once the download has started; keep it open on errors so
          // the user can adjust and retry.
          if (await exportProject(options)) setExportDialogOpen(false);
        }}
      />

      <EditViewDialog
        view={editingView}
        open={!!editingView}
        onOpenChange={(open) => !open && setEditingView(null)}
      />
    </>
  );
}
