import { emitTutorialSignal } from "@/lib/tutorial-signals";
import { DiagramLoadError } from "./DiagramLoadError";
import { SavePatternDialog } from "./SavePatternDialog";
import { DiagramHelpDialog } from "./DiagramHelpDialog";
import { ValidationResultsDialog } from "./ValidationResultsDialog";
import { UnsavedChangesDialog } from "./UnsavedChangesDialog";
import { useCanvasInsertion } from "./useCanvasInsertion";
import { useCanvasAiProposal } from "./useCanvasAiProposal";
import { useCanvasDropInsertion } from "./useCanvasDropInsertion";
import { useEdgeRelationConfirmation } from "./useEdgeRelationConfirmation";
import { useCanvasActionRequests } from "./useCanvasActionRequests";
import { useCanvasSidePanels } from "./useCanvasSidePanels";
import { useCanvasDisplayGraph } from "./useCanvasDisplayGraph";
import { usePatternCreation } from "./usePatternCreation";
import { useCanvasTableSelection } from "./useCanvasTableSelection";
import { useCanvasElementActions } from "./useCanvasElementActions";
import { useCanvasTableRows } from "./useCanvasTableRows";
// DiagramCanvas.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Controls,
  Background,
  BackgroundVariant,
  ReactFlowProvider,
  applyNodeChanges,
  type NodeChange,
  type NodeMouseHandler,
  type EdgeMouseHandler,
  ConnectionLineType,
  useConnection,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import PartNode from "../nodes/PartNode";
import PartDefNode from "../nodes/PartDefNode";
import ActionDefNode from "../nodes/ActionDefNode";
import ConcernDefNode from "../nodes/ConcernDefNode";
import AgentDefNode from "../nodes/AgentDefNode";
import RequirementDefNode from "../nodes/RequirementDefNode";
import EventDefNode from "../nodes/EventDefNode";
import CapabilityDefNode from "../nodes/CapabilityDefNode";
import { ModelRulesPanel } from "../panels/ModelRulesPanel";
import { MetamodelAiAssistant } from "../panels/MetamodelAiAssistant";
import type { NodeData } from "../types";
import { CanvasTableMode } from "./CanvasTableMode";
import { ConnectionPreviewLine, edgeTypes, type CustomEdgeData } from "../edges/CustomEdges";
import { useMetamodelParts } from "../hooks/useMetamodelParts";
import { useEdgeCreation } from "../hooks/useEdgeCreation";
import { EdgeRelationConfirmationProvider } from "../edges/EdgeRelationConfirmation";


import { DiagramToolbar } from "./DiagramToolBar";
import { useDiagramCanvas } from "../hooks/useDiagramCanvas";
import { useDiagramScreenshot } from "../hooks/useDiagramScreenshot";
import { useDiagramValidation } from "../hooks/useDiagramValidation";
import { useFlowPlayback } from "../hooks/useFlowPlayback";
import { EdgeCreateMenu } from "../menus/EdgeCreateMenu";
import { ScreenshotDialog } from "../dialogs/ScreenshotDialog";
import { DeleteConfirmDialog } from "../dialogs/DeleteConfirmDialog";
import {
  buildParentMap,
  buildParentMapFromNodes,
  getTypeAncestors,
  mergeParentMaps,
} from "@shared/metamodel-inheritance";
import { api } from "@shared/routes";
import type { FlowRecoveryResponse } from "@shared/routes";
import type { FlowEdgeInput, SyncFlowNodeInput } from "@shared/flow-inputs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiCall } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import {
  dispatchDiagramEvent,
  subscribeDiagramEvent,
} from "@/lib/diagram-events";
import { computeStraightenedEdge } from "./straightenEdge";
import { useView } from "@/hooks/use-views";
import { useDiagramHelpContent } from "./useDiagramHelpContent";
import { useDiagramCanvasPreferences } from "./useDiagramCanvasPreferences";
import { useDiagramLeaveConfirmation } from "./useDiagramLeaveConfirmation";
import { AggregationMarkerDefs } from "./AggregationMarkerDefs";
import { CanvasAlignmentGuides } from "./CanvasAlignmentGuides";
import { CanvasFlowStatusCard } from "./CanvasFlowStatusCard";
import { CanvasInspectorPanels } from "./CanvasInspectorPanels";
import { useCanvasDragPreview } from "./useCanvasDragPreview";
import { useCanvasKeyboardShortcuts } from "./useCanvasKeyboardShortcuts";
import { useCanvasNodeSnapping } from "./useCanvasNodeSnapping";
import type { ProjectType } from "@shared/schema";
import {
  getConfiguredMagicNodeTypes,
  getConfiguredMagicRelationTypes,
  magicNodeTypeCatalog,
  type MagicRelationType,
  type MetamodelSetup,
} from "@shared/metamodel-setup";

const nodeTypes = {
  part: PartNode,
  partdef: PartDefNode,
  actiondef: ActionDefNode,
  concerndef: ConcernDefNode,
  agentdef: AgentDefNode,
  requirementdef: RequirementDefNode,
  eventdef: EventDefNode,
  capabilitydef: CapabilityDefNode,
};

export interface DiagramCanvasProps {
  viewId: number;
  projectId: number;
  projectType: ProjectType;
  metamodelSetup?: MetamodelSetup | null;
  referencedMetamodelIds?: number[];
  referencedMetamodels?: Array<{
    id: number;
    name: string;
    metamodelSetup?: MetamodelSetup | null;
  }>;
  viewMode?: "build" | "flow";
  displayMode?: "graph" | "table";
  onDisplayModeChange?: (mode: "graph" | "table") => void;
}

function FlowInner({
  viewId,
  projectId,
  projectType,
  metamodelSetup,
  referencedMetamodelIds = [],
  referencedMetamodels = [],
  viewMode = "build",
  displayMode = "graph",
  onDisplayModeChange,
}: DiagramCanvasProps) {
  const [suspendFlowLoad, setSuspendFlowLoad] = useState(false);
  const canvasShellRef = useRef<HTMLDivElement | null>(null);
  const viewQuery = useView(viewId);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const recoveryQuery = useQuery<FlowRecoveryResponse>({
    queryKey: [api.flow.recovery.path, viewId],
    queryFn: () => apiCall(api.flow.recovery, { params: { viewId } }),
    enabled: false,
  });

  const {
    isLoading,
    isError,
    reload: reloadDiagram,

    nodes,
    edges,
    setNodes,
    setEdges,

    onEdgesChange,

    undo,
    redo,
    canUndo,
    canRedo,

    takeSnapshot,

    handleAddNode,
    handleAutoLayout,
    handleLayoutSelected,
    handleCenterSelected,
    handleSave,
    handleSaveAsync,
    handleSaveRecovered,

    isSaving,
    projectIdById,
    isDirty,
  } = useDiagramCanvas(viewId, projectType, suspendFlowLoad);

  const { screenToFlowPosition, getViewport, setViewport, fitView } = useReactFlow();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const openRecovery = useCallback(() => {
    setSuspendFlowLoad(true);
    setRecoveryOpen(true);
    void recoveryQuery.refetch();
  }, [recoveryQuery]);

  const handleRecoverySave = useCallback(
    async (
      repairedNodes: SyncFlowNodeInput[],
      repairedEdges: FlowEdgeInput[],
    ) => {
      await handleSaveRecovered(repairedNodes, repairedEdges);
      const result = await reloadDiagram();
      if (result.error) throw result.error;
      setRecoveryOpen(false);
      setSuspendFlowLoad(false);
    },
    [handleSaveRecovered, reloadDiagram],
  );

  const {
    screenshot,
    isScreenshotOpen,
    setIsScreenshotOpen,
    takeScreenshot,
    copyToClipboard,
    downloadImage,
  } = useDiagramScreenshot();
  const isConnecting = useConnection((connection) => connection.inProgress);
  const isConnectionValid = useConnection((connection) =>
    connection.inProgress ? connection.isValid : null,
  );
  // Selection + panels
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [isNodePanelOpen, setIsNodePanelOpen] = useState(false);
  const [isEdgePanelOpen, setIsEdgePanelOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{
    nodeIds: string[];
    edgeIds: string[];
    label?: string;
  } | null>(null);
  const [isCanvasReady, setIsCanvasReady] = useState(false);
  const {
    snapNodesEnabled,
    setSnapEnabled,
    showBackgroundDots,
    setShowBackgroundDots,
    alwaysShowAccent,
    setAlwaysShowAccent,
    showNodeDescriptions,
    setShowNodeDescriptions,
  } = useDiagramCanvasPreferences();
  const [helpDialogOpen, setHelpDialogOpen] = useState(false);
  const [nodeTableFilter, setNodeTableFilter] = useState("");
  const [edgeTableFilter, setEdgeTableFilter] = useState("");
  const {
    dragPreviewNode,
    handleCanvasDragOver,
    clearDragPreview,
  } = useCanvasDragPreview({ viewId, screenToFlowPosition });
  const {
    draggingNodeId,
    alignmentGuides,
    handleNodeDrag,
    handleNodeDragStart,
    handleNodeDragStop,
  } = useCanvasNodeSnapping({
    nodes,
    edges,
    snapNodesEnabled,
    setNodes,
    takeSnapshot,
  });

  const isFlowMode = viewMode === "flow" && projectType === "instance";
  const isTableMode = displayMode === "table";
  const metamodelDefaultType =
    projectType === "metamodel"
      ? (() => {
          const defaultType = magicNodeTypeCatalog.find(
            (item) =>
              item.id === getConfiguredMagicNodeTypes(metamodelSetup)[0],
          );
          return defaultType
            ? {
                id: defaultType.id,
                label: defaultType.label,
                icon: defaultType.iconName,
              }
            : undefined;
        })()
      : undefined;
  const helpContent = useDiagramHelpContent(projectType, isFlowMode);

  const externalNodeIds = useMemo(
    () =>
      new Set(
        nodes
          .filter((node) => {
            const owner = projectIdById.get(node.id);
            return owner !== undefined && owner !== projectId;
          })
          .map((node) => node.id),
      ),
    [projectIdById, nodes, projectId],
  );
  const isExternalNode = useCallback(
    (nodeId: string) => externalNodeIds.has(nodeId),
    [externalNodeIds],
  );

  const handleOpenNodePanelForNode = useCallback(
    (nodeId: string) => {
      setSelectedNodeId(nodeId);
      setSelectedEdgeId(null);
      setIsEdgePanelOpen(false);
      setNodes((current) =>
        current.map((node) => ({
          ...node,
          selected: node.id === nodeId,
        })),
      );
      setEdges((current) =>
        current.map((edge) => ({
          ...edge,
          selected: false,
        })),
      );
      if (isExternalNode(nodeId)) {
        toast({
          title: "Referenced node",
          description: "Referenced metamodel nodes are read-only.",
        });
        return;
      }
      setIsNodePanelOpen(true);
    },
    [isExternalNode, setEdges, setNodes, toast],
  );

  useEffect(() => {
    dispatchDiagramEvent("selected-node-changed", {
      nodeId: selectedNodeId,
      viewId,
    });
  }, [selectedNodeId, viewId]);
  const {
    insertNodeIntoView,
  } = useCanvasInsertion({
    nodes,
    screenToFlowPosition,
    viewId,
    setNodes,
    setSelectedEdgeId,
    setSelectedNodeId,
    toast,
    queryClient,
  });

  const {
    availablePartDefs,
    availablePartDefNodes,
    availablePartDefEdges,
    partDefStyleById,
    partTypeOptions,
    referencedModelRules,
    referencedRelationTypes,
  } = useMetamodelParts({
    nodes,
    edges,
    projectType,
    referencedMetamodelIds,
    referencedMetamodels,
    selectedNodeId,
  });

  const localModelRules = useMemo(
    () => viewQuery.data?.modelRules ?? [],
    [viewQuery.data?.modelRules],
  );
  const activeModelRules = useMemo(
    () => projectType === "metamodel"
      ? localModelRules
      : projectType === "instance"
        ? [...referencedModelRules, ...localModelRules]
        : [],
    [localModelRules, projectType, referencedModelRules],
  );
  const inheritedModelRuleIds = useMemo(
    () => new Set(referencedModelRules.map((rule) => rule.id)),
    [referencedModelRules],
  );
  const {
    toggleModelRules,
    toggleAiAssistant,
    modelRulesPanelVisible,
    modelRulesPanelHeight,
    aiAssistantOpen,
    setAiAssistantOpen,
    closeModelRules,
    setModelRulesPanelHeight,
  } = useCanvasSidePanels({
    projectType,
    canvasShellRef,
    getViewport,
    setViewport,
  });
  const {
    handleApplyAiProposal,
  } = useCanvasAiProposal({
    viewId,
    projectType,
    toggleAiAssistant,
    nodes,
    edges,
    toast,
    takeSnapshot,
    setNodes,
    setEdges,
    fitView,
  });
  useEffect(
    () =>
      subscribeDiagramEvent("diagram-save-request", (detail) => {
        if (detail.viewId !== viewId) return;
        handleSave();
      }),
    [handleSave, viewId],
  );
  const {
    handleCanvasDrop,
  } = useCanvasDropInsertion({
    availablePartDefNodes,
    partDefStyleById,
    screenToFlowPosition,
    handleAddNode,
    viewId,
    projectType,
    insertNodeIntoView,
    toggleModelRules,
    clearDragPreview,
  });
  const typeMetaById = useMemo(
    () =>
      new Map(
        availablePartDefNodes.map((node) => {
          const data = node.data as unknown as
            | (NodeData & {
                _referenceTypeId?: string;
                _originTypeId?: string;
                _originProjectId?: number;
              })
            | undefined;
          return [
            node.id,
            {
              referenceTypeId: data?._referenceTypeId || node.id,
              originTypeId: data?._originTypeId || node.id,
              originProjectId: data?._originProjectId,
              label: data?.label || node.id,
            },
          ] as const;
        }),
      ),
    [availablePartDefNodes],
  );

  const parentMap = useMemo(
    () =>
      mergeParentMaps(
        buildParentMap(availablePartDefEdges),
        buildParentMapFromNodes(
          availablePartDefNodes.map((node) => ({
            id: node.id,
            data: (node.data as unknown as NodeData | undefined)
              ? { typeId: (node.data as unknown as NodeData).typeId }
              : undefined,
          })),
        ),
      ),
    [availablePartDefEdges, availablePartDefNodes],
  );
  const relationEdges = useMemo(
    () =>
      availablePartDefEdges.filter(
        (edge) => edge.edgeType !== "generalization",
      ),
    [availablePartDefEdges],
  );
  const configuredRelationTypes = useMemo<MagicRelationType[] | undefined>(() => {
    if (projectType === "metamodel") {
      return getConfiguredMagicRelationTypes(metamodelSetup);
    }
    if (projectType === "instance" && referencedMetamodelIds.length > 0) {
      return referencedRelationTypes;
    }
    return undefined;
  }, [
    metamodelSetup,
    projectType,
    referencedMetamodelIds.length,
    referencedRelationTypes,
  ]);
  const edgeTypeCycle = useMemo(
    () => configuredRelationTypes ?? getConfiguredMagicRelationTypes(null),
    [configuredRelationTypes],
  );

  const {
    flowCompleted,
    flowCurrentTick,
    flowEndLabel,
    flowEndNodeId,
    flowMaxTick,
    flowSchedule,
    flowStartLabel,
    flowStartNodeId,
    handlePlayFlow,
    handleResetFlow,
    handleSetFlowEnd,
    handleSetFlowStart,
    handleStepBack,
    handleStepForward,
    handleStopFlow,
    isFlowRunning,
  } = useFlowPlayback({
    isFlowMode,
    nodes,
    edges,
    selectedNodeId,
    setNodes,
    toast,
  });

  const {
    applyIssueHighlights,
    handleValidate,
    highlightIssues,
    setHighlightIssues,
    validationIssues,
    validationOpen,
    setValidationOpen,
  } = useDiagramValidation({
    projectType,
    nodes,
    edges,
    availablePartDefNodes,
    relationEdges,
    parentMap,
    setNodes,
    setEdges,
    modelRules: activeModelRules,
    inheritedModelRuleIds,
  });
  const {
    handleCanvasEdgeCreated,
    edgeRelationConfirmationValue,
  } = useEdgeRelationConfirmation({
    viewId,
    setEdges,
  });

  const {
    connectingFromNodeId,
    pendingConnectionSource,
    edgeCreateMenu,
    handleConnect,
    handleConnectStart,
    handleConnectEnd,
    closeEdgeCreateMenu,
    finalizeEdgeCreateNode,
  } = useEdgeCreation({
    viewId,
    projectType,
    nodes,
    edges,
    setNodes,
    setEdges,
    takeSnapshot,
    availablePartDefEdges,
    typeMetaById,
    parentMap,
    screenToFlowPosition,
    onEdgeCreated: handleCanvasEdgeCreated,
    allowedEdgeTypes: configuredRelationTypes,
  });

  const [limitToValidTargets, setLimitToValidTargets] = useState<boolean>(
    () => {
      if (typeof window === "undefined") return true;
      const stored = window.sessionStorage.getItem(
        "flow.edgeCreateMenu.limitToValidTargets",
      );
      if (stored === null) return true;
      return stored === "true";
    },
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(
      "flow.edgeCreateMenu.limitToValidTargets",
      String(limitToValidTargets),
    );
  }, [limitToValidTargets]);

  const {
    displayNodes,
    displayEdges,
  } = useCanvasDisplayGraph({
    isFlowMode,
    nodes,
    connectingFromNodeId,
    isExternalNode,
    draggingNodeId,
    alwaysShowAccent,
    showNodeDescriptions,
    flowCurrentTick,
    flowSchedule,
    isFlowRunning,
    flowCompleted,
    projectType,
    activeModelRules,
    edges,
    inheritedModelRuleIds,
    dragPreviewNode,
  });

  const edgeCreateSourceTypeId = useMemo(() => {
    if (!pendingConnectionSource?.nodeId) return null;
    const sourceNode = nodes.find(
      (node) => node.id === pendingConnectionSource.nodeId,
    );
    return (sourceNode?.data as NodeData | undefined)?.typeId ?? null;
  }, [nodes, pendingConnectionSource?.nodeId]);

  const validTargetTypeIds = useMemo(() => {
    if (!edgeCreateSourceTypeId) return null;
    const sourceAncestors = getTypeAncestors(edgeCreateSourceTypeId, parentMap);
    const validTargets = new Set<string>();

    partTypeOptions.forEach((option) => {
      const targetAncestors = getTypeAncestors(option.id, parentMap);
      const hasRelation = relationEdges.some(
        (edge) =>
          sourceAncestors.has(edge.sourceTypeId) &&
          targetAncestors.has(edge.targetTypeId),
      );
      if (hasRelation) {
        validTargets.add(option.id);
      }
    });

    return validTargets;
  }, [relationEdges, edgeCreateSourceTypeId, parentMap, partTypeOptions]);

  const filteredPartTypeOptions = useMemo(() => {
    if (!limitToValidTargets || !validTargetTypeIds) return partTypeOptions;
    return partTypeOptions.filter((option) =>
      validTargetTypeIds.has(option.id),
    );
  }, [limitToValidTargets, partTypeOptions, validTargetTypeIds]);

  const selectedNodes = useMemo(
    () => nodes.filter((node) => node.selected),
    [nodes],
  );
  const selectedNodeIds = useMemo(
    () => selectedNodes.map((node) => node.id),
    [selectedNodes],
  );
  const canSavePattern = selectedNodes.length >= 2;

  useEffect(() => {
    const nextSelectedId =
      selectedNodes.length > 0 ? selectedNodes[0].id : null;
    setSelectedNodeId((prev) =>
      prev === nextSelectedId ? prev : nextSelectedId,
    );
  }, [selectedNodes]);

  const selectedNode = selectedNodeId
    ? nodes.find((n) => n.id === selectedNodeId) || null
    : null;
  const selectedEdge = selectedEdgeId
    ? edges.find((e) => e.id === selectedEdgeId) || null
    : null;

  const selectedEdgeForToolbar = useMemo(
    () => edges.find((edge) => edge.selected) || null,
    [edges],
  );

  const requestDelete = useCallback(
    (payload: { nodeIds: string[]; edgeIds: string[]; label?: string }) => {
      if (deleteDialogOpen) return;
      setPendingDelete(payload);
      setDeleteDialogOpen(true);
    },
    [deleteDialogOpen],
  );

  const parentNodesForSelected = useMemo(() => {
    if (!selectedNodeId) return [];
    const selected = nodes.find((node) => node.id === selectedNodeId);
    const typeId = (selected?.data as NodeData | undefined)?.typeId;
    if (!typeId) return [];
    const parent =
      availablePartDefNodes.find((node) => node.id === typeId) ||
      nodes.find((node) => node.id === typeId);
    return parent ? [parent] : [];
  }, [nodes, selectedNodeId, availablePartDefNodes]);
  const {
    openPatternDialog,
    patternDialogOpen,
    setPatternDialogOpen,
    patternName,
    setPatternName,
    patternDescription,
    setPatternDescription,
    patternSnapshot,
    setPatternSnapshot,
    handleCreatePattern,
  } = usePatternCreation({
    selectedNodes,
    edges,
    canSavePattern,
    selectedNodeIds,
    projectId,
    queryClient,
  });

  useEffect(() => {
    if (projectType !== "instance") return;

    setNodes((current) => {
      let hasChanges = false;
      const next = current.map((node) => {
        if (node.type !== "part") return node;
        const data = node.data as unknown as NodeData | undefined;
        if (!data?.typeId) return node;
        const style = partDefStyleById.get(data.typeId);
        if (!style) return node;
        const shouldInherit =
          data.inheritStyle === true ||
          (data.inheritStyle !== false && !data.icon && !data.color);
        if (!shouldInherit) return node;
        if (
          data.icon === style.icon &&
          data.color === style.color &&
          data.inheritStyle === true
        ) {
          return node;
        }
        hasChanges = true;
        return {
          ...node,
          data: {
            ...node.data,
            icon: style.icon,
            color: style.color,
            inheritStyle: true,
          },
        };
      });
      return hasChanges ? next : current;
    });
  }, [partDefStyleById, projectType, setNodes]);

  useEffect(() => {
    setIsCanvasReady(false);
  }, [viewId]);

  const {
    leaveDialogOpen,
    isLeaving,
    handleCancelLeave,
    handleLeaveWithoutSaving,
    handleSaveAndLeave,
  } = useDiagramLeaveConfirmation({
    viewId,
    isDirty,
    isSaving,
    setSuspendFlowLoad,
    handleSaveAsync,
  });

  useEffect(() => {
    if (isLoading) return;
    const timer = window.setTimeout(() => {
      setIsCanvasReady(true);
    }, 120);
    return () => window.clearTimeout(timer);
  }, [isLoading, viewId]);

  const onCanvasNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((current) => applyNodeChanges(changes, current));
    },
    [setNodes],
  );

  const onNodeDoubleClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      setSelectedNodeId(node.id);
      if (isExternalNode(node.id)) {
        toast({
          title: "Referenced node",
          description: "Referenced metamodel nodes are read-only.",
        });
        return;
      }
      setIsNodePanelOpen(true);
    },
    [isExternalNode, toast],
  );

  const onEdgeDoubleClick: EdgeMouseHandler = useCallback((_event, edge) => {
    setSelectedEdgeId(edge.id);
    setIsEdgePanelOpen(true);
  }, []);

  const handleCloseNodePanel = useCallback(() => {
    setIsNodePanelOpen(false);
    setSelectedNodeId(null);
  }, []);

  const handleCloseEdgePanel = useCallback(() => {
    setIsEdgePanelOpen(false);
    setSelectedEdgeId(null);
  }, []);
  const {
    handleOpenEdgePanelFromTable,
    handleSelectNodeFromTable,
    handleOpenNodePanelFromTable,
    handleSelectEdgeFromTable,
  } = useCanvasTableSelection({
    setNodes,
    setEdges,
    setSelectedNodeId,
    setSelectedEdgeId,
    isExternalNode,
    toast,
    setIsNodePanelOpen,
    setIsEdgePanelOpen,
  });

  const handleStraightenEdge = useCallback(() => {
    if (!selectedEdgeForToolbar) return;
    const patch = computeStraightenedEdge(selectedEdgeForToolbar, nodes);
    if (!patch) return;

    setEdges((current) =>
      current.map((edge) =>
        edge.id === selectedEdgeForToolbar.id
          ? {
              ...edge,
              data: patch.data,
              sourceHandle: patch.sourceHandle,
              targetHandle: patch.targetHandle,
            }
          : edge,
      ),
    );
  }, [nodes, selectedEdgeForToolbar, setEdges]);
  const {
    handleCopyNode,
    handleDeleteNode,
    handleDeleteEdge,
    handleToggleEdgeType,
    handleReverseEdgeDirection,
    instanceNodeTypeOptions,
    metamodelNodeTypeOptions,
    handleInlineNodeFieldChange,
    handleInlineEdgeFieldChange,
    handleSaveNodeData,
    handleSaveEdgeData,
  } = useCanvasElementActions({
    isExternalNode,
    takeSnapshot,
    nodes,
    edges,
    partDefStyleById,
    setNodes,
    setEdges,
    partTypeOptions,
    projectType,
    setSelectedNodeId,
    selectedNodes,
    setSelectedEdgeId,
    requestDelete,
    edgeTypeCycle,
  });
  useCanvasActionRequests({
    handleOpenNodePanelForNode,
    handleCopyNode,
    handleDeleteNode,
    handleOpenEdgePanelFromTable,
    handleDeleteEdge,
    handleToggleEdgeType,
    handleReverseEdgeDirection,
  });

  const handleConfirmDelete = useCallback(() => {
    if (!pendingDelete) return;
    const nodeIdSet = new Set(pendingDelete.nodeIds);
    const edgeIdSet = new Set(pendingDelete.edgeIds);
    const hasSelection = nodeIdSet.size > 0 || edgeIdSet.size > 0;

    if (!hasSelection) {
      setDeleteDialogOpen(false);
      setPendingDelete(null);
      return;
    }

    takeSnapshot(nodes, edges);
    setNodes((nds) => nds.filter((n) => !nodeIdSet.has(n.id)));
    setEdges((eds) =>
      eds.filter(
        (e) =>
          !edgeIdSet.has(e.id) &&
          !nodeIdSet.has(e.source) &&
          !nodeIdSet.has(e.target),
      ),
    );

    if (selectedNodeId && nodeIdSet.has(selectedNodeId)) {
      setSelectedNodeId(null);
      setIsNodePanelOpen(false);
    }
    if (selectedEdgeId && edgeIdSet.has(selectedEdgeId)) {
      setSelectedEdgeId(null);
      setIsEdgePanelOpen(false);
    }

    setDeleteDialogOpen(false);
    setPendingDelete(null);
  }, [
    pendingDelete,
    nodes,
    edges,
    selectedNodeId,
    selectedEdgeId,
    setNodes,
    setEdges,
    takeSnapshot,
  ]);

  useCanvasKeyboardShortcuts({
    nodes,
    edges,
    deleteDialogOpen,
    onSave: handleSave,
    requestDelete,
  });
  const {
    nodeTableRows,
    filteredNodeTableRows,
    edgeTableRows,
    filteredEdgeTableRows,
  } = useCanvasTableRows({
    nodes,
    isExternalNode,
    edges,
    nodeTableFilter,
    edgeTableFilter,
  });

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center h-full bg-muted/20">
        <div className="flex flex-col items-center gap-4 text-muted-foreground animate-pulse">
          <div className="w-10 h-10 rounded-full bg-muted" />
          <p>Loading diagram...</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <DiagramLoadError
        reloadDiagram={reloadDiagram}
        openRecovery={openRecovery}
        recoveryOpen={recoveryOpen}
        recoveryQuery={recoveryQuery}
        isSaving={isSaving}
        setRecoveryOpen={setRecoveryOpen}
        setSuspendFlowLoad={setSuspendFlowLoad}
        handleRecoverySave={handleRecoverySave}
      />
    );
  }

  return (
    <div ref={canvasShellRef} className="h-full w-full bg-slate-50 relative group">
      <div
        className="absolute inset-x-0 top-0 min-h-0"
        style={{ bottom: modelRulesPanelVisible ? modelRulesPanelHeight : 0 }}
        data-testid="diagram-canvas-region"
      >
      {isTableMode ? (
        <CanvasTableMode
          projectType={projectType}
          nodeTableRows={nodeTableRows}
          filteredNodeTableRows={filteredNodeTableRows}
          nodeTableFilter={nodeTableFilter}
          onNodeTableFilterChange={setNodeTableFilter}
          edgeTableRows={edgeTableRows}
          filteredEdgeTableRows={filteredEdgeTableRows}
          edgeTableFilter={edgeTableFilter}
          onEdgeTableFilterChange={setEdgeTableFilter}
          selectedNodeId={selectedNodeId}
          selectedEdgeId={selectedEdgeId}
          instanceNodeTypeOptions={instanceNodeTypeOptions}
          metamodelNodeTypeOptions={metamodelNodeTypeOptions}
          onSelectNode={handleSelectNodeFromTable}
          onSelectEdge={handleSelectEdgeFromTable}
          onOpenNodePanel={handleOpenNodePanelFromTable}
          onOpenEdgePanel={handleOpenEdgePanelFromTable}
          onInlineNodeFieldChange={handleInlineNodeFieldChange}
          onInlineEdgeFieldChange={handleInlineEdgeFieldChange}
          displayMode={displayMode === "table" ? "table" : "graph"}
          onDisplayModeChange={(mode) => onDisplayModeChange?.(mode)}
        />
      ) : isCanvasReady ? (
        <EdgeRelationConfirmationProvider
          value={edgeRelationConfirmationValue}
        >
        <ReactFlow
          nodes={displayNodes}
          edges={displayEdges}
          onNodesChange={onCanvasNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDragStart={handleNodeDragStart}
          onNodeDrag={handleNodeDrag}
          onNodeDragStop={handleNodeDragStop}
          onConnect={handleConnect}
          onConnectStart={handleConnectStart}
          onConnectEnd={handleConnectEnd}
          onNodeDoubleClick={onNodeDoubleClick}
          onEdgeDoubleClick={onEdgeDoubleClick}
          onDragOver={handleCanvasDragOver}
          onDrop={handleCanvasDrop}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          connectionLineType={ConnectionLineType.Straight}
          connectionLineComponent={ConnectionPreviewLine}
          minZoom={0.1}
          deleteKeyCode={null}
          fitView
          className={`bg-slate-50 dark:bg-slate-950${isConnecting ? " flow-connecting" : ""}${isConnectionValid === true ? " flow-connecting-valid" : ""}${isConnectionValid === false ? " flow-connecting-invalid" : ""}`}
        >
          <AggregationMarkerDefs />
          {showBackgroundDots && (
            <Background
              variant={BackgroundVariant.Dots}
              gap={20}
              size={1}
              className="opacity-50"
            />
          )}
          <CanvasAlignmentGuides guides={alignmentGuides} />
          <Controls className="bg-white dark:bg-slate-900 border-border shadow-lg" />

          <DiagramToolbar
            projectType={projectType}
            displayMode={displayMode}
            onDisplayModeChange={(mode) => onDisplayModeChange?.(mode)}
            canUndo={canUndo}
            canRedo={canRedo}
            canStraightenEdge={Boolean(
              !isFlowMode &&
                selectedEdgeForToolbar &&
                (selectedEdgeForToolbar.data as CustomEdgeData | undefined)
                  ?.pathType === "straight",
            )}
            canLayoutSelection={selectedNodeIds.length > 0}
            canAutoLayout={nodes.length > 0}
            canSavePattern={canSavePattern}
            onSavePattern={openPatternDialog}
            onUndo={undo}
            onRedo={redo}
            snapNodesEnabled={snapNodesEnabled}
            alwaysShowAccent={alwaysShowAccent}
            showBackgroundDots={showBackgroundDots}
            showNodeDescriptions={showNodeDescriptions}
            isFlowMode={isFlowMode}
            isFlowRunning={isFlowRunning}
            canSetFlowStart={Boolean(selectedNodeId)}
            canSetFlowEnd={Boolean(selectedNodeId)}
            canPlayFlow={Boolean(flowStartNodeId && flowEndNodeId)}
            canStepBack={Boolean(!isFlowRunning && flowCurrentTick > 1)}
            canStepForward={Boolean(
              !isFlowRunning &&
                flowStartNodeId &&
                flowEndNodeId &&
                (flowMaxTick === null || flowCurrentTick < flowMaxTick),
            )}
            onSetFlowStart={handleSetFlowStart}
            onSetFlowEnd={handleSetFlowEnd}
            onPlayFlow={handlePlayFlow}
            onStopFlow={handleStopFlow}
            onStepBack={handleStepBack}
            onStepForward={handleStepForward}
            onResetFlow={handleResetFlow}
            onAutoLayout={() => {
              handleAutoLayout();
              emitTutorialSignal("auto-layout");
            }}
            onLayoutSelectedVertical={() =>
              handleLayoutSelected("TB", selectedNodeIds)
            }
            onLayoutSelectedHorizontal={() =>
              handleLayoutSelected("LR", selectedNodeIds)
            }
            onCenterSelectedVertical={() =>
              handleCenterSelected("x", selectedNodeIds)
            }
            onCenterSelectedHorizontal={() =>
              handleCenterSelected("y", selectedNodeIds)
            }
            onScreenshot={takeScreenshot}
            onValidate={() => {
              handleValidate();
              emitTutorialSignal("validation-run");
            }}
            onStraightenEdge={handleStraightenEdge}
            onToggleSnap={() => setSnapEnabled((current) => !current)}
            onToggleAlwaysShowAccent={() =>
              setAlwaysShowAccent((current) => !current)
            }
            onToggleBackgroundDots={() =>
              setShowBackgroundDots((current) => !current)
            }
            onToggleNodeDescriptions={() =>
              setShowNodeDescriptions((current) => !current)
            }
            onOpenHelp={() => setHelpDialogOpen(true)}
          />
        </ReactFlow>
        </EdgeRelationConfirmationProvider>
      ) : (
        <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
          Loading view…
        </div>
      )}
      </div>

      {!isTableMode &&
        isFlowMode &&
        (isFlowRunning || flowCompleted || flowCurrentTick > 0) && (
          <CanvasFlowStatusCard
            completed={flowCompleted}
            startLabel={flowStartLabel}
            endLabel={flowEndLabel}
            currentTick={flowCurrentTick}
            maxTick={flowMaxTick}
          />
        )}

      <SavePatternDialog
        patternDialogOpen={patternDialogOpen}
        setPatternDialogOpen={setPatternDialogOpen}
        patternName={patternName}
        setPatternName={setPatternName}
        patternDescription={patternDescription}
        setPatternDescription={setPatternDescription}
        patternSnapshot={patternSnapshot}
        setPatternSnapshot={setPatternSnapshot}
        handleCreatePattern={handleCreatePattern}
      />

      <DiagramHelpDialog
        helpDialogOpen={helpDialogOpen}
        setHelpDialogOpen={setHelpDialogOpen}
        helpContent={helpContent}
      />

      <EdgeCreateMenu
        open={!!edgeCreateMenu}
        position={
          edgeCreateMenu
            ? { x: edgeCreateMenu.x, y: edgeCreateMenu.y }
            : undefined
        }
        projectType={projectType}
        partTypeOptions={filteredPartTypeOptions}
        metamodelDefaultType={metamodelDefaultType}
        limitToValidTargets={limitToValidTargets}
        onLimitToValidTargetsChange={setLimitToValidTargets}
        onSelectDefault={() =>
          finalizeEdgeCreateNode(
            metamodelDefaultType
              ? {
                  typeLabel: metamodelDefaultType.label,
                  icon: metamodelDefaultType.icon,
                }
              : undefined,
          )
        }
        onSelectType={(option) =>
          finalizeEdgeCreateNode({
            typeId: option.id,
            typeLabel: option.label,
            icon: option.icon,
            color: option.color,
          })
        }
        onCancel={closeEdgeCreateMenu}
      />

      <CanvasInspectorPanels
        node={selectedNode}
        edge={selectedEdge}
        nodes={nodes}
        edges={edges}
        nodePanelOpen={isNodePanelOpen}
        edgePanelOpen={isEdgePanelOpen}
        availablePartDefs={availablePartDefs}
        availablePartDefNodes={availablePartDefNodes}
        availablePartDefEdges={availablePartDefEdges}
        parentNodes={parentNodesForSelected}
        referencedMetamodels={referencedMetamodels}
        allowedEdgeTypes={configuredRelationTypes}
        onCloseNodePanel={handleCloseNodePanel}
        onCloseEdgePanel={handleCloseEdgePanel}
        onSaveNode={handleSaveNodeData}
        onDeleteNode={handleDeleteNode}
        onSaveEdge={handleSaveEdgeData}
        onDeleteEdge={handleDeleteEdge}
      />

      <MetamodelAiAssistant
        open={aiAssistantOpen && projectType === "metamodel"}
        onClose={() => setAiAssistantOpen(false)}
        projectId={projectId}
        viewId={viewId}
        nodes={nodes}
        edges={edges}
        metamodelSetup={metamodelSetup}
        onApply={handleApplyAiProposal}
      />

      <ModelRulesPanel
        open={modelRulesPanelVisible}
        onClose={closeModelRules}
        viewId={viewId}
        projectId={projectId}
        initialRules={localModelRules}
        inheritedRules={projectType === "instance" ? referencedModelRules : []}
        projectType={projectType}
        height={modelRulesPanelHeight}
        onHeightChange={setModelRulesPanelHeight}
        nodes={nodes}
        edges={edges}
      />

      <ScreenshotDialog
        open={isScreenshotOpen}
        onOpenChange={setIsScreenshotOpen}
        screenshot={screenshot}
        onCopy={copyToClipboard}
        onDownload={downloadImage}
      />

      <ValidationResultsDialog
        validationOpen={validationOpen}
        setValidationOpen={setValidationOpen}
        validationIssues={validationIssues}
        projectType={projectType}
        highlightIssues={highlightIssues}
        setHighlightIssues={setHighlightIssues}
        applyIssueHighlights={applyIssueHighlights}
      />

      <UnsavedChangesDialog
        leaveDialogOpen={leaveDialogOpen}
        isLeaving={isLeaving}
        handleCancelLeave={handleCancelLeave}
        isSaving={isSaving}
        handleLeaveWithoutSaving={handleLeaveWithoutSaving}
        handleSaveAndLeave={handleSaveAndLeave}
      />

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        label={pendingDelete?.label}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) {
            setPendingDelete(null);
          }
        }}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}

export function DiagramCanvas(props: DiagramCanvasProps) {
  return (
    <ReactFlowProvider>
      <FlowInner {...props} />
    </ReactFlowProvider>
  );
}
