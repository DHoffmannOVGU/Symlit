import { newNodeId, randomId } from "@/lib/ids";
// DiagramCanvas.tsx
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
} from "react";
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
import { useLocation } from "wouter";

import PartNode from "../nodes/PartNode";
import PartDefNode from "../nodes/PartDefNode";
import ActionDefNode from "../nodes/ActionDefNode";
import ConcernDefNode from "../nodes/ConcernDefNode";
import AgentDefNode from "../nodes/AgentDefNode";
import RequirementDefNode from "../nodes/RequirementDefNode";
import EventDefNode from "../nodes/EventDefNode";
import CapabilityDefNode from "../nodes/CapabilityDefNode";
import ExternalStubNode from "../nodes/ExternalStubNode";
import { ModelRulesPanel } from "../panels/ModelRulesPanel";
import { MetamodelAiAssistant } from "../panels/MetamodelAiAssistant";
import { AI_ASSISTANT_ENABLED } from "@/lib/feature-flags";
import type { DiagramNode as Node, NodeData } from "../types";
import { CanvasTableMode } from "./CanvasTableMode";
import {
  ConnectionPreviewLine,
  edgeTypes,
  getEdgeSemanticDefaults,
  getEdgeMarkers,
  type CustomEdgeData,
} from "../edges/CustomEdges";
import { useMetamodelParts } from "../hooks/useMetamodelParts";
import { useEdgeCreation } from "../hooks/useEdgeCreation";
import {
  EdgeRelationConfirmationProvider,
  type PendingEdgeRelationConfirmation,
} from "../edges/EdgeRelationConfirmation";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

import { DiagramToolbar } from "./DiagramToolBar";
import { useDiagramCanvas } from "../hooks/useDiagramCanvas";
import { useDiagramScreenshot } from "../hooks/useDiagramScreenshot";
import { useDiagramValidation } from "../hooks/useDiagramValidation";
import { useExternalCanvasElements } from "../hooks/useExternalCanvasElements";
import { useFlowPlayback } from "../hooks/useFlowPlayback";
import { EdgeCreateMenu } from "../menus/EdgeCreateMenu";
import { ScreenshotDialog } from "../dialogs/ScreenshotDialog";
import { DeleteConfirmDialog } from "../dialogs/DeleteConfirmDialog";
import { DiagramRecoveryDialog } from "../dialogs/DiagramRecoveryDialog";
import {
  buildParentMap,
  buildParentMapFromNodes,
  getTypeAncestors,
  mergeParentMaps,
} from "@shared/metamodel-inheritance";
import { evaluateModelRuleResults, supportsModelRules } from "../rules/model-rules";
import { getViewportForBottomPanel } from "../utils/rules-panel-viewport";
import {
  buildMetamodelProposalElements,
  chooseMetamodelProposalLayoutDirection,
} from "../utils/ai-metamodel-apply";
import { layoutSelectedNodesWithDagre } from "../utils/dagre-layout";
import type { AiMetamodelProposal } from "@shared/ai-metamodel";
import { api, buildUrl } from "@shared/routes";
import type { FlowRecoveryResponse } from "@shared/routes";
import type { FlowEdgeInput, SyncFlowNodeInput } from "@shared/flow-inputs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiCall } from "@/lib/api-client";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  dispatchDiagramEvent,
  subscribeDiagramEvent,
} from "@/lib/diagram-events";
import { computeStraightenedEdge } from "./straightenEdge";
import {
  useCreateInternalView,
  useInternalViews,
} from "@/hooks/use-internal-views";
import { useNode, useFlow } from "@/hooks/use-flow";
import { useView } from "@/hooks/use-views";
import {
  METAMODEL_NODE_DRAG_MIME,
  type SidebarCreateMetamodelNodeDragPayload,
  type SidebarNodeTransfer,
} from "./diagramCanvasTypes";
import { useDiagramHelpContent } from "./useDiagramHelpContent";
import { useDiagramCanvasPreferences } from "./useDiagramCanvasPreferences";
import { useDiagramClipboard } from "./useDiagramClipboard";
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
  externalStub: ExternalStubNode,
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
  parentNodeId?: string | null;
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
  parentNodeId,
}: DiagramCanvasProps) {
  const [suspendFlowLoad, setSuspendFlowLoad] = useState(false);
  const [modelRulesOpen, setModelRulesOpen] = useState(false);
  const [aiAssistantOpen, setAiAssistantOpen] = useState(false);
  const [modelRulesPanelHeight, setModelRulesPanelHeight] = useState(560);
  const canvasShellRef = useRef<HTMLDivElement | null>(null);
  const rulesViewportBaselineRef = useRef<{
    viewport: { x: number; y: number; zoom: number };
    width: number;
    height: number;
  } | null>(null);
  const viewQuery = useView(viewId);
  const internalViewsQuery = useInternalViews(projectId);
  const parentNodeQuery = useNode(parentNodeId);
  const internalView = (internalViewsQuery.data ?? []).find(
    (v) => v.id === viewId,
  );
  const parentViewId = internalView?.parentViewId;
  const parentViewFlow = useFlow(parentViewId ?? 0);
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
    debugInfoById,
    isDirty,
  } = useDiagramCanvas(viewId, projectType, suspendFlowLoad, parentNodeId);

  const { externalEdges, externalRender } = useExternalCanvasElements({
    parentNodeId,
    parentViewFlowData: parentViewFlow.data,
    nodes,
  });

  const { screenToFlowPosition, getViewport, setViewport, fitView } = useReactFlow();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const createInternalView = useCreateInternalView();

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
  const [pendingEdgeRelation, setPendingEdgeRelation] =
    useState<PendingEdgeRelationConfirmation | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{
    nodeIds: string[];
    edgeIds: string[];
    label?: string;
  } | null>(null);
  const [isCanvasReady, setIsCanvasReady] = useState(false);

  useEffect(() => {
    setPendingEdgeRelation(null);
  }, [viewId]);
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
  const [patternDialogOpen, setPatternDialogOpen] = useState(false);
  const [helpDialogOpen, setHelpDialogOpen] = useState(false);
  const [patternName, setPatternName] = useState("");
  const [patternDescription, setPatternDescription] = useState("");
  const [nodeTableFilter, setNodeTableFilter] = useState("");
  const [edgeTableFilter, setEdgeTableFilter] = useState("");
  const [patternSnapshot, setPatternSnapshot] = useState<{
    nodes: typeof selectedNodes;
    edges: typeof edges;
  } | null>(null);
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
  const pendingSelectionRef = useRef<{
    beforeIds: Set<string>;
    mode: "single" | "pattern";
    targetNodeId?: string;
  } | null>(null);

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

  const insertNodeIntoView = useCallback(
    async (nodeId: string, position?: { x: number; y: number }) => {
      pendingSelectionRef.current = {
        beforeIds: new Set(nodes.map((node) => node.id)),
        mode: "single",
        targetNodeId: nodeId,
      };
      try {
        const targetPosition =
          position ??
          screenToFlowPosition({
            x: window.innerWidth / 2,
            y: window.innerHeight / 2,
          });
        const url = buildUrl(api.flow.insertNode.path, { viewId, nodeId });
        await apiRequest(api.flow.insertNode.method, url, {
          position: targetPosition,
        });
        const nodeUrl = buildUrl(api.nodes.get.path, { nodeId });
        const nodeRes = await apiRequest("GET", nodeUrl);
        const insertedNode = api.nodes.get.responses[200].parse(
          await nodeRes.json(),
        );
        if (!insertedNode) throw new Error("Inserted node not found");

        setNodes((current) => {
          if (current.some((node) => node.id === insertedNode.id)) {
            return current.map((node) => ({
              ...node,
              selected: node.id === insertedNode.id,
            }));
          }

          return [
            ...current.map((node) => ({ ...node, selected: false })),
            {
              id: insertedNode.id,
              type: insertedNode.type,
              position: targetPosition,
              selected: true,
              data: insertedNode.data as Record<string, unknown>,
            },
          ];
        });
        setSelectedEdgeId(null);
        setSelectedNodeId(insertedNode.id);
      } catch (error) {
        pendingSelectionRef.current = null;
        console.error("Failed to insert node into view:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to insert node. Please try again.",
        });
      }
    },
    [nodes, screenToFlowPosition, setNodes, viewId, toast],
  );

  const externalNodeIds = useMemo(
    () =>
      new Set(
        nodes
          .filter((node) => {
            const debug = debugInfoById.get(node.id);
            return !!debug && debug.projectId !== projectId;
          })
          .map((node) => node.id),
      ),
    [debugInfoById, nodes, projectId],
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

  const insertPatternIntoView = useCallback(
    async (patternId: number) => {
      pendingSelectionRef.current = {
        beforeIds: new Set(nodes.map((node) => node.id)),
        mode: "pattern",
      };
      try {
        const center = screenToFlowPosition({
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
        });
        const url = buildUrl(api.flow.insertPattern.path, {
          viewId,
          patternId,
        });
        await apiRequest(api.flow.insertPattern.method, url, {
          position: center,
        });
        await queryClient.invalidateQueries({
          queryKey: [api.flow.get.path, viewId],
        });
      } catch (error) {
        pendingSelectionRef.current = null;
        console.error("Failed to insert pattern into view:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to insert pattern. Please try again.",
        });
      }
    },
    [nodes, queryClient, screenToFlowPosition, viewId],
  );

  useEffect(() => {
    const pending = pendingSelectionRef.current;
    if (!pending) return;
    if (nodes.length === 0) return;

    const newNodeIds = nodes
      .filter((node) => !pending.beforeIds.has(node.id))
      .map((node) => node.id);

    if (pending.mode === "single") {
      const targetId =
        pending.targetNodeId &&
        new Set(nodes.map((node) => node.id)).has(pending.targetNodeId)
          ? pending.targetNodeId
          : newNodeIds[0];

      if (!targetId) return;
      pendingSelectionRef.current = null;
      setSelectedEdgeId(null);
      setNodes((current) =>
        current.map((node) => ({
          ...node,
          selected: node.id === targetId,
        })),
      );
      return;
    }

    if (newNodeIds.length === 0) return;
    const newIdSet = new Set(newNodeIds);
    pendingSelectionRef.current = null;
    setSelectedEdgeId(null);
    setNodes((current) =>
      current.map((node) => ({
        ...node,
        selected: newIdSet.has(node.id),
      })),
    );
  }, [nodes, setNodes, setSelectedEdgeId]);

  useEffect(
    () =>
      subscribeDiagramEvent("insert-pattern-into-view", (detail) => {
        if (detail.viewId !== viewId) return;
        void insertPatternIntoView(detail.patternId);
      }),
    [insertPatternIntoView, viewId],
  );

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
  const modelRulesPanelVisible = modelRulesOpen && supportsModelRules(projectType);

  const openModelRules = useCallback(() => {
    if (!rulesViewportBaselineRef.current) {
      const bounds = canvasShellRef.current?.getBoundingClientRect();
      rulesViewportBaselineRef.current = {
        viewport: getViewport(),
        width: bounds?.width ?? window.innerWidth,
        height: bounds?.height ?? window.innerHeight,
      };
    }
    setModelRulesOpen(true);
  }, [getViewport]);

  const closeModelRules = useCallback(() => {
    const baseline = rulesViewportBaselineRef.current;
    rulesViewportBaselineRef.current = null;
    setModelRulesOpen(false);
    if (baseline) {
      window.requestAnimationFrame(() => {
        void setViewport(baseline.viewport, { duration: 150 });
      });
    }
  }, [setViewport]);

  const toggleModelRules = useCallback(() => {
    if (modelRulesOpen) closeModelRules();
    else {
      setAiAssistantOpen(false);
      openModelRules();
    }
  }, [closeModelRules, modelRulesOpen, openModelRules]);

  const toggleAiAssistant = useCallback(() => {
    if (!aiAssistantOpen && modelRulesOpen) closeModelRules();
    setAiAssistantOpen((open) => !open);
  }, [aiAssistantOpen, closeModelRules, modelRulesOpen]);

  useEffect(() => {
    if (!modelRulesPanelVisible) return;
    const baseline = rulesViewportBaselineRef.current;
    if (!baseline || baseline.height <= 0) return;
    const nextViewport = getViewportForBottomPanel(
      baseline.viewport,
      baseline.width,
      baseline.height,
      modelRulesPanelHeight,
    );
    const frame = window.requestAnimationFrame(() => {
      void setViewport(nextViewport);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [modelRulesPanelHeight, modelRulesPanelVisible, setViewport]);

  const createNodeFromTypeAtPosition = useCallback(
    (
      typeId: string,
      position?: { x: number; y: number },
      fallback?: { typeLabel?: string; icon?: string; color?: string },
    ) => {
      const typeNode = availablePartDefNodes.find((node) => node.id === typeId);
      const data = typeNode?.data as NodeData | undefined;
      const style = partDefStyleById.get(typeId);
      const targetPosition =
        position ??
        screenToFlowPosition({
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
        });
      handleAddNode({
        typeId,
        typeLabel: data?.label ?? fallback?.typeLabel,
        icon: style?.icon ?? data?.icon ?? fallback?.icon,
        color: style?.color ?? data?.color ?? fallback?.color,
        position: targetPosition,
      });
    },
    [
      availablePartDefNodes,
      handleAddNode,
      partDefStyleById,
      screenToFlowPosition,
    ],
  );

  useEffect(
    () =>
      subscribeDiagramEvent("insert-node-into-view", (detail) => {
        if (detail.viewId !== viewId) return;
        if (
          detail.mode === "create-instance-node" &&
          projectType === "instance"
        ) {
          createNodeFromTypeAtPosition(
            detail.typeId ?? detail.nodeId,
            detail.position,
            {
              typeLabel: detail.typeLabel,
              icon: detail.icon,
              color: detail.color,
            },
          );
          return;
        }
        void insertNodeIntoView(detail.nodeId, detail.position);
      }),
    [createNodeFromTypeAtPosition, insertNodeIntoView, projectType, viewId],
  );

  useEffect(
    () =>
      subscribeDiagramEvent("create-metamodel-node-in-view", (detail) => {
        if (detail.viewId !== viewId || projectType !== "metamodel") return;

        handleAddNode({
          nodeType: detail.nodeType,
          typeId: detail.parentTypeId,
          typeLabel:
            detail.typeLabel ??
            (detail.nodeType === "actiondef"
              ? "Behavior"
              : detail.nodeType === "concerndef"
                ? "Concern"
                : detail.nodeType === "agentdef"
                  ? "Performer"
                  : detail.nodeType === "requirementdef"
                    ? "Requirement"
                    : detail.nodeType === "eventdef"
                      ? "Event"
                      : detail.nodeType === "capabilitydef"
                        ? "Capability"
                        : "Object"),
          icon: detail.icon,
          color: detail.color,
        });
      }),
    [handleAddNode, projectType, viewId],
  );

  useEffect(
    () =>
      subscribeDiagramEvent("model-rules-toggle-request", (detail) => {
        if (detail.viewId === viewId && supportsModelRules(projectType)) {
          toggleModelRules();
        }
      }),
    [projectType, toggleModelRules, viewId],
  );

  useEffect(
    () => subscribeDiagramEvent("metamodel-ai-assistant-toggle-request", (detail) => {
      if (AI_ASSISTANT_ENABLED && detail.viewId === viewId && projectType === "metamodel") toggleAiAssistant();
    }),
    [projectType, toggleAiAssistant, viewId],
  );

  const handleApplyAiProposal = useCallback((proposal: AiMetamodelProposal) => {
    const additions = buildMetamodelProposalElements(
      proposal,
      nodes,
      edges,
      (kind) => `ai_${kind}_${randomId()}`,
    );
    if (!additions.nodes.length && !additions.edges.length) {
      toast({
        title: "Nothing to apply",
        description:
          additions.skipped[0] ??
          "The proposal contains no valid additions.",
      });
      return;
    }
    const layoutDirection = chooseMetamodelProposalLayoutDirection(proposal);
    const nextEdges = [...edges, ...additions.edges];
    const nextNodes = layoutSelectedNodesWithDagre(
      [...nodes, ...additions.nodes],
      nextEdges,
      additions.nodes.map((node) => node.id),
      layoutDirection,
    );
    takeSnapshot(nodes, edges);
    setNodes(nextNodes);
    setEdges(nextEdges);
    toast({
      title: "AI proposal applied",
      description: [
        `Added ${additions.nodes.length} element${additions.nodes.length === 1 ? "" : "s"} and ${additions.edges.length} relationship${additions.edges.length === 1 ? "" : "s"}, arranged ${layoutDirection === "TB" ? "vertically" : "horizontally"}.`,
        additions.skipped.length
          ? `Skipped ${additions.skipped.length} invalid item${additions.skipped.length === 1 ? "" : "s"}.`
          : "",
      ].filter(Boolean).join(" "),
    });
    window.requestAnimationFrame(() => { void fitView({ duration: 600 }); });
  }, [edges, fitView, nodes, setEdges, setNodes, takeSnapshot, toast]);

  useEffect(
    () =>
      subscribeDiagramEvent("diagram-save-request", (detail) => {
        if (detail.viewId !== viewId) return;
        handleSave();
      }),
    [handleSave, viewId],
  );

  const handleCanvasDrop = useCallback(
    (event: DragEvent) => {
      const raw = event.dataTransfer.getData(METAMODEL_NODE_DRAG_MIME);
      if (!raw) return;

      event.preventDefault();
      clearDragPreview();

      try {
        const payload = JSON.parse(raw) as
          | SidebarNodeTransfer
          | SidebarCreateMetamodelNodeDragPayload;
        if (!payload || payload.viewId !== viewId) return;

        const position = screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });
        if ("nodeType" in payload && projectType === "metamodel") {
          handleAddNode({
            nodeType: payload.nodeType,
            typeId: payload.parentTypeId,
            typeLabel:
              payload.typeLabel ??
              (payload.nodeType === "actiondef"
                ? "Behavior"
                : payload.nodeType === "concerndef"
                  ? "Concern"
                  : payload.nodeType === "agentdef"
                    ? "Performer"
                    : payload.nodeType === "requirementdef"
                      ? "Requirement"
                    : payload.nodeType === "eventdef"
                      ? "Event"
                      : payload.nodeType === "capabilitydef"
                        ? "Capability"
                        : "Object"),
            icon: payload.icon,
            color: payload.color,
            position,
          });
          return;
        }
        if (!("nodeId" in payload) || !payload.nodeId) return;
        if (
          payload.mode === "create-instance-node" &&
          projectType === "instance"
        ) {
          createNodeFromTypeAtPosition(payload.typeId ?? payload.nodeId, position, {
            typeLabel: payload.typeLabel,
            icon: payload.icon,
            color: payload.color,
          });
          return;
        }
        void insertNodeIntoView(payload.nodeId, position);
      } catch (error) {
        console.error("Failed to parse dropped metamodel node payload:", error);
      }
    },
    [
      createNodeFromTypeAtPosition,
      handleAddNode,
      insertNodeIntoView,
      projectType,
      screenToFlowPosition,
      viewId,
    ],
  );
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

  const handleCanvasEdgeCreated = useCallback(
    (confirmation: PendingEdgeRelationConfirmation | null) => {
      setPendingEdgeRelation(confirmation);
    },
    [],
  );

  const handleConfirmEdgeRelation = useCallback(
    (edgeId: string, relationId: string) => {
      if (!pendingEdgeRelation || pendingEdgeRelation.edgeId !== edgeId) return;
      const relation = pendingEdgeRelation.options.find(
        (option) => option.id === relationId,
      );
      if (!relation) return;

      setEdges((current) =>
        current.map((edge) => {
          if (edge.id !== edgeId) return edge;
          const existingData =
            (edge.data as CustomEdgeData | undefined) ?? {
              edgeType: relation.edgeType,
            };
          const { data, markerStart, markerEnd } = getEdgeMarkers({
            ...existingData,
            ...getEdgeSemanticDefaults(relation.edgeType),
            edgeType: relation.edgeType,
            flowType: relation.flowType,
            label: relation.label,
          });
          return {
            ...edge,
            type: data.edgeType,
            data,
            markerStart,
            markerEnd,
          };
        }),
      );
      setPendingEdgeRelation(null);
    },
    [pendingEdgeRelation, setEdges],
  );

  const handleRejectEdgeRelation = useCallback(
    (edgeId: string) => {
      if (!pendingEdgeRelation || pendingEdgeRelation.edgeId !== edgeId) return;
      setEdges((current) =>
        current.map((edge) => {
          if (edge.id !== edgeId) return edge;
          const existingData =
            (edge.data as CustomEdgeData | undefined) ?? {
              edgeType: "association",
            };
          const { data, markerStart, markerEnd } = getEdgeMarkers({
            ...existingData,
            label: undefined,
          });
          return { ...edge, data, markerStart, markerEnd };
        }),
      );
      setPendingEdgeRelation(null);
    },
    [pendingEdgeRelation, setEdges],
  );

  const edgeRelationConfirmationValue = useMemo(
    () => ({
      pending: pendingEdgeRelation,
      onConfirm: handleConfirmEdgeRelation,
      onReject: handleRejectEdgeRelation,
    }),
    [handleConfirmEdgeRelation, handleRejectEdgeRelation, pendingEdgeRelation],
  );

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

  const handleOpenInternalViewForNode = useCallback(
    async (nodeId: string) => {
      try {
        const view = await createInternalView.mutateAsync({
          nodeId,
          parentViewId: viewId,
        });
        setLocation(`/project/${view.projectId}/view/${view.id}`);
      } catch (err) {
        toast({
          variant: "destructive",
          title: "Failed to open internal view",
          description:
            err instanceof Error ? err.message : "Unexpected error occurred.",
        });
      }
    },
    [createInternalView, setLocation, toast, viewId],
  );

  const baseDisplayNodes = useMemo(() => {
    const stripFlowTags = !isFlowMode;
    const selectedNodeCount = nodes.filter((node) => node.selected).length;
    const internalNodeIds = new Set(
      (internalViewsQuery.data ?? [])
        .map((view) => view.parentNodeId)
        .filter((id): id is string => !!id),
    );
    return nodes.map((node) => {
      const nextNode =
        node.id === connectingFromNodeId
          ? {
              ...node,
              className: `${node.className ?? ""} is-connection-source`.trim(),
            }
          : node;
      const rawData = nextNode.data as unknown as NodeData | undefined;
      const data = rawData;
      const hasInternalView = internalNodeIds.has(node.id);
      const isGroupContainer = data?.isGroupContainer === true;
      const isEditableNode = !isExternalNode(node.id);
      const isConnectableNode = isEditableNode && !isGroupContainer;
      if (stripFlowTags) {
        if (
          !data?.flowStart &&
          !data?.flowEnd &&
          data?.flowTick === undefined &&
          data?.flowActive === undefined
        ) {
          return {
            ...nextNode,
            connectable: isConnectableNode,
            data: {
              ...data,
              hasInternalView,
              isGroupContainer,
              showActionToolbar:
                nextNode.selected &&
                selectedNodeCount === 1 &&
                !isGroupContainer,
              suppressActionToolbar:
                connectingFromNodeId === node.id || draggingNodeId === node.id,
              isReadOnly: isExternalNode(node.id),
              canOpenInternalViewAction:
                !isFlowMode &&
                !isGroupContainer &&
                !isExternalNode(node.id),
              externalEdges: isGroupContainer ? externalEdges : undefined,
              onOpenInternalView: handleOpenInternalViewForNode,
              alwaysShowAccent,
              showDescription: showNodeDescriptions,
            },
          };
        }
        return {
          ...nextNode,
          connectable: isConnectableNode,
          data: {
            ...data,
            hasInternalView,
            isGroupContainer,
            showActionToolbar:
              nextNode.selected && selectedNodeCount === 1 && !isGroupContainer,
            suppressActionToolbar:
              connectingFromNodeId === node.id || draggingNodeId === node.id,
            isReadOnly: isExternalNode(node.id),
            canOpenInternalViewAction:
              !isFlowMode &&
              !isGroupContainer &&
              !isExternalNode(node.id),
            externalEdges: isGroupContainer ? externalEdges : undefined,
            flowStart: false,
            flowEnd: false,
            flowTick: undefined,
            flowActive: false,
            onOpenInternalView: handleOpenInternalViewForNode,
            alwaysShowAccent,
            showDescription: showNodeDescriptions,
          },
        };
      }

      const hasFlowProgress = flowCurrentTick > 0;
      const scheduledTicks = flowSchedule?.get(nextNode.id) ?? [];
      const visibleTicks =
        (isFlowRunning || flowCompleted || hasFlowProgress) &&
        scheduledTicks.length > 0
          ? scheduledTicks.filter((tick) => tick <= flowCurrentTick)
          : [];
      const shouldShowTick = visibleTicks.length > 0;
      const isFlowActive =
        (isFlowRunning || flowCompleted || hasFlowProgress) &&
        scheduledTicks.includes(flowCurrentTick);
      if (!data && !shouldShowTick) {
        return {
          ...nextNode,
          connectable: isConnectableNode,
        };
      }
      return {
        ...nextNode,
        connectable: isConnectableNode,
        data: {
          ...data,
          hasInternalView,
          isGroupContainer,
          showActionToolbar:
            nextNode.selected && selectedNodeCount === 1 && !isGroupContainer,
          suppressActionToolbar:
            connectingFromNodeId === node.id || draggingNodeId === node.id,
          isReadOnly: isExternalNode(node.id),
          canOpenInternalViewAction: false,
          externalEdges: isGroupContainer ? externalEdges : undefined,
          flowTick: shouldShowTick ? visibleTicks : undefined,
          flowActive: isFlowActive,
          onOpenInternalView: handleOpenInternalViewForNode,
          alwaysShowAccent,
          showDescription: showNodeDescriptions,
        },
      };
    });
  }, [
    connectingFromNodeId,
    flowCompleted,
    flowCurrentTick,
    flowSchedule,
    handleOpenInternalViewForNode,
    isFlowMode,
    isFlowRunning,
    nodes,
    internalViewsQuery.data,
    isExternalNode,
    parentNodeId,
    externalEdges,
    alwaysShowAccent,
    showNodeDescriptions,
    draggingNodeId,
    projectType,
  ]);

  const modelRuleResults = useMemo(
    () =>
      supportsModelRules(projectType)
        ? evaluateModelRuleResults(activeModelRules, nodes, edges)
        : [],
    [activeModelRules, edges, nodes, projectType],
  );
  const modelRuleViolations = useMemo(
    () => modelRuleResults.flatMap((result) => result.outcome.kind === "issue" ? [{ ...result, severity: result.outcome.severity }] : []),
    [modelRuleResults],
  );
  const modelRuleViolationByNodeId = useMemo(() => {
    const result = new Map<string, (typeof modelRuleViolations)[number]>();
    modelRuleViolations.forEach((violation) => {
      const existing = result.get(violation.nodeId);
      if (!existing || violation.severity === "error") result.set(violation.nodeId, violation);
    });
    return result;
  }, [modelRuleViolations]);
  const modelRuleTagsByNodeId = useMemo(() => {
    const result = new Map<string, Array<{ label: string; color?: string; ruleName: string; origin?: "meta" | "instance" | "model" }>>();
    modelRuleResults.forEach((match) => {
      if (match.outcome.kind !== "tag") return;
      const outcome = match.outcome;
      const tags = result.get(match.nodeId) ?? [];
      if (!tags.some((tag) => tag.label === outcome.label)) {
        tags.push({
          label: outcome.label,
          color: outcome.color,
          ruleName: match.ruleName,
          origin: inheritedModelRuleIds.has(match.ruleId) ? "meta" : projectType === "instance" ? "instance" : "model",
        });
      }
      result.set(match.nodeId, tags);
    });
    return result;
  }, [inheritedModelRuleIds, modelRuleResults, projectType]);

  const displayNodes = useMemo<Node[]>(
    () => {
      const ruleDecoratedNodes: Node[] = baseDisplayNodes.map(
        (node): Node => {
          const violation = modelRuleViolationByNodeId.get(node.id);
          const tags = modelRuleTagsByNodeId.get(node.id);
          if (!violation && !tags?.length) return node;
          const data = node.data;
          return {
            ...node,
            data: {
              ...data,
              modelRuleTags: tags,
              ...(violation ? {
                ruleAccentColor: violation.severity === "error" ? "#ef4444" : "#f59e0b",
                ruleEmphasis:
                  violation.severity === "error"
                    ? ("strong" as const)
                    : ("soft" as const),
                ruleStateLabel: violation.ruleName,
              } : {}),
            },
          };
        },
      );
      return [
        ...ruleDecoratedNodes,
        ...(dragPreviewNode ? [dragPreviewNode] : []),
        ...externalRender.nodes,
      ];
    },
    [
      baseDisplayNodes,
      modelRuleViolationByNodeId,
      modelRuleTagsByNodeId,
      dragPreviewNode,
      externalRender.nodes,
    ],
  );

  const displayEdges = useMemo(
    () =>
      (externalRender.edges.length > 0
        ? edges.concat(externalRender.edges)
        : edges
      ).map((edge) => {
        const edgeData = (edge.data as CustomEdgeData | undefined) ?? {
          edgeType:
            (edge.type as CustomEdgeData["edgeType"] | undefined) ||
            "association",
        };
        const baseEdge =
          edgeData.edgeType === "aggregation"
            ? { ...edge, zIndex: Math.max(edge.zIndex ?? 0, 10) }
            : edge;
        return baseEdge;
      }),
    [edges, externalRender.edges],
  );

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
  const selectedNodeDebug = selectedNode
    ? debugInfoById.get(selectedNode.id)
    : undefined;
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

  const openPatternDialog = useCallback(() => {
    if (!canSavePattern) return;
    const nodeSet = new Set(selectedNodeIds);
    const snapshotEdges = edges.filter(
      (edge) => nodeSet.has(edge.source) && nodeSet.has(edge.target),
    );
    setPatternSnapshot({ nodes: selectedNodes, edges: snapshotEdges });
    setPatternName("");
    setPatternDescription("");
    setPatternDialogOpen(true);
  }, [canSavePattern, edges, selectedNodeIds, selectedNodes]);

  const handleCreatePattern = useCallback(async () => {
    if (!patternName.trim()) return;
    if (!patternSnapshot || patternSnapshot.nodes.length === 0) return;
    const positions = patternSnapshot.nodes.map((node) => node.position);
    const minX = Math.min(...positions.map((p) => p.x));
    const maxX = Math.max(...positions.map((p) => p.x));
    const minY = Math.min(...positions.map((p) => p.y));
    const maxY = Math.max(...positions.map((p) => p.y));
    const center = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };

    const patternNodesPayload = patternSnapshot.nodes.map((node) => ({
      nodeId: node.id,
      type: node.type || "part",
      position: {
        x: node.position.x - center.x,
        y: node.position.y - center.y,
      },
      data: node.data,
    }));

    const patternEdgesPayload = patternSnapshot.edges.map((edge) => ({
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle ?? null,
      targetHandle: edge.targetHandle ?? null,
      data: edge.data,
    }));

    const url = buildUrl(api.patterns.create.path, { projectId });
    await apiRequest(api.patterns.create.method, url, {
      name: patternName.trim(),
      description: patternDescription.trim() || undefined,
      nodes: patternNodesPayload,
      edges: patternEdgesPayload,
    });
    await queryClient.invalidateQueries({
      queryKey: [api.patterns.list.path, projectId],
    });
    setPatternDialogOpen(false);
    setPatternSnapshot(null);
  }, [
    patternDescription,
    patternName,
    patternSnapshot,
    projectId,
    queryClient,
  ]);

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
    if (!parentNodeId) return;
    if (!parentNodeQuery.data) return;
    if (isLoading) return;
    setNodes((current) => {
      const alreadyPresent = current.some((n) => n.id === parentNodeId);
      if (alreadyPresent) return current;
      const parentData = parentNodeQuery.data!;
      const isGroupContainer = true;
      const containerNode: Node = {
        id: parentData.id,
        type: parentData.type || "part",
        position: { x: 100, y: 100 },
        style: { width: 700, height: 500 },
        data: {
          ...(parentData.data as Record<string, unknown>),
          isGroupContainer,
          _nodeStyle: { width: 700, height: 500 },
        },
      };
      return [containerNode, ...current];
    });
  }, [parentNodeId, parentNodeQuery.data, isLoading, setNodes]);

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

  const handleOpenNodePanelFromTable = useCallback(
    (nodeId: string) => {
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
      setSelectedNodeId(nodeId);
      setSelectedEdgeId(null);
      if (isExternalNode(nodeId)) {
        toast({
          title: "Referenced node",
          description: "Referenced metamodel nodes are read-only.",
        });
        setIsNodePanelOpen(false);
        setIsEdgePanelOpen(false);
        return;
      }
      setIsNodePanelOpen(true);
      setIsEdgePanelOpen(false);
    },
    [isExternalNode, setEdges, setNodes, toast],
  );

  const handleOpenEdgePanelFromTable = useCallback(
    (edgeId: string) => {
      setEdges((current) =>
        current.map((edge) => ({
          ...edge,
          selected: edge.id === edgeId,
        })),
      );
      setNodes((current) =>
        current.map((node) => ({
          ...node,
          selected: false,
        })),
      );
      setSelectedEdgeId(edgeId);
      setSelectedNodeId(null);
      setIsEdgePanelOpen(true);
      setIsNodePanelOpen(false);
    },
    [setEdges, setNodes],
  );

  const handleSelectNodeFromTable = useCallback(
    (nodeId: string) => {
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
      setSelectedNodeId(nodeId);
    },
    [setEdges, setNodes],
  );

  const handleSelectEdgeFromTable = useCallback(
    (edgeId: string) => {
      setSelectedNodeId(null);
      setIsNodePanelOpen(false);
      setEdges((current) =>
        current.map((edge) => ({
          ...edge,
          selected: edge.id === edgeId,
        })),
      );
      setNodes((current) =>
        current.map((node) => ({
          ...node,
          selected: false,
        })),
      );
      setSelectedEdgeId(edgeId);
    },
    [setEdges, setNodes],
  );
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

  const handleSaveNodeData = useCallback(
    (nodeId: string, data: NodeData) => {
      if (isExternalNode(nodeId)) return;
      takeSnapshot(nodes, edges);
      const nextNodes = nodes.map((n) =>
        n.id === nodeId
          ? {
              ...n,
              type:
                data.type === "Behavior" || data.type === "Action"
                  ? "actiondef"
                  : data.type === "Concern"
                    ? "concerndef"
                    : data.type === "Performer" || data.type === "Agent"
                      ? "agentdef"
                      : data.type === "Requirement"
                        ? "requirementdef"
                      : data.type === "Event"
                        ? "eventdef"
                        : data.type === "Capability"
                          ? "capabilitydef"
                      : (data.type === "Object" || data.type === "Part") &&
                          [
                            "partdef",
                            "actiondef",
                            "concerndef",
                            "agentdef",
                            "requirementdef",
                            "eventdef",
                            "capabilitydef",
                          ].includes(n.type || "")
                        ? "partdef"
                        : n.type,
              data: {
                ...n.data,
                ...data,
                ...((data.type === "Behavior" || data.type === "Action") ? { icon: data.icon || "Zap" } : {}),
                ...(data.type === "Concern"
                  ? { icon: data.icon || "Shield" }
                  : {}),
                ...((data.type === "Performer" || data.type === "Agent") ? { icon: data.icon || "Bot" } : {}),
                ...(data.type === "Requirement"
                  ? { icon: data.icon || "BadgeCheck" }
                  : {}),
                ...(data.type === "Event" ? { icon: data.icon || "Radio" } : {}),
                ...(data.type === "Capability" ? { icon: data.icon || "Gem" } : {}),
                ...(n.type === "part"
                  ? (() => {
                      if (!data.typeId || data.inheritStyle === false) {
                        return {
                          icon: data.icon,
                          color: data.color,
                          inheritStyle: false,
                        };
                      }
                      const style = partDefStyleById.get(data.typeId);
                      return style
                        ? {
                            icon: style.icon,
                            color: style.color,
                            inheritStyle: true,
                          }
                        : {};
                    })()
                  : {}),
              },
            }
          : n,
      );
      setNodes(nextNodes);
    },
    [nodes, edges, setNodes, takeSnapshot, partDefStyleById, isExternalNode],
  );

  const handleSaveEdgeData = useCallback(
    (edgeId: string, data: CustomEdgeData) => {
      takeSnapshot(nodes, edges);
      const nextEdges = edges.map((e) =>
        e.id === edgeId
          ? (() => {
              const existingData = (e.data as CustomEdgeData | undefined) ?? {
                edgeType:
                  (e.type as CustomEdgeData["edgeType"] | undefined) ||
                  "association",
              };
              const {
                data: normalizedData,
                markerStart,
                markerEnd,
              } = getEdgeMarkers({
                ...existingData,
                ...(data.edgeType &&
                data.edgeType !== existingData.edgeType
                  ? getEdgeSemanticDefaults(data.edgeType)
                  : {}),
                ...data,
              });
              return {
                ...e,
                type: normalizedData.edgeType,
                data: normalizedData,
                markerStart,
                markerEnd,
              };
            })()
          : e,
      );
      setEdges(nextEdges);
    },
    [nodes, edges, setEdges, takeSnapshot],
  );

  const metamodelNodeTypeOptions = useMemo(
    () => [
      { value: "Object", label: "Object" },
      { value: "Behavior", label: "Behavior" },
      { value: "Concern", label: "Concern" },
      { value: "Performer", label: "Performer" },
      { value: "Requirement", label: "Requirement" },
      { value: "Event", label: "Event" },
      { value: "Capability", label: "Capability" },
    ],
    [],
  );

  const instanceNodeTypeOptions = useMemo(
    () =>
      partTypeOptions.map((option) => ({
        value: option.id,
        label: option.label,
      })),
    [partTypeOptions],
  );

  const handleInlineNodeFieldChange = useCallback(
    (nodeId: string, field: "name" | "description" | "type", value: string) => {
      const node = nodes.find((candidate) => candidate.id === nodeId);
      if (!node) return;
      if (isExternalNode(nodeId)) return;

      const existingData = (node.data as unknown as NodeData | undefined) ?? {
        label: "",
        type: node.type || "Object",
      };

      if (field === "type") {
        if (projectType === "instance") {
          if (value === "untyped") {
            handleSaveNodeData(nodeId, {
              ...existingData,
              type: existingData.type || "Object",
              typeId: undefined,
              inheritStyle: false,
            });
            return;
          }
          const selectedOption = partTypeOptions.find(
            (option) => option.id === value,
          );
          if (!selectedOption) return;
          handleSaveNodeData(nodeId, {
            ...existingData,
            type: selectedOption.label,
            typeId: selectedOption.id,
            inheritStyle: true,
          });
          return;
        }

        handleSaveNodeData(nodeId, {
          ...existingData,
          type: value,
        });
        return;
      }

      handleSaveNodeData(nodeId, {
        ...existingData,
        ...(field === "name"
          ? { label: value }
          : { description: value || undefined }),
      });
    },
    [nodes, partTypeOptions, projectType, handleSaveNodeData, isExternalNode],
  );

  const handleInlineEdgeFieldChange = useCallback(
    (edgeId: string, field: "name" | "description" | "type", value: string) => {
      const edge = edges.find((candidate) => candidate.id === edgeId);
      if (!edge) return;

      const existingData = (edge.data as CustomEdgeData | undefined) ?? {
        edgeType:
          (edge.type as CustomEdgeData["edgeType"] | undefined) ||
          "association",
      };

      handleSaveEdgeData(edgeId, {
        ...existingData,
        ...(field === "name"
          ? { label: value || undefined }
          : field === "description"
            ? { description: value || undefined }
            : { edgeType: value as CustomEdgeData["edgeType"] }),
      });
    },
    [edges, handleSaveEdgeData],
  );

  const handleCopyNode = useCallback(
    (nodeId: string) => {
      const sourceNode = nodes.find((node) => node.id === nodeId);
      if (!sourceNode) return;

      const sourceData = sourceNode.data;
      const baseLabel = sourceData.label ?? "Untitled";
      const attributes = sourceData.attributes
        ? sourceData.attributes.map((attr) => ({
            ...attr,
            options: attr.options ? [...attr.options] : undefined,
          }))
        : undefined;

      takeSnapshot(nodes, edges);
      const newNode: Node = {
        id: newNodeId(),
        type: sourceNode.type,
        position: {
          x: sourceNode.position.x + 40,
          y: sourceNode.position.y + 40,
        },
        data: {
          ...sourceData,
          label: `${baseLabel} (copy)`,
          attributes,
        },
        className: sourceNode.className,
        style: sourceNode.style ? { ...sourceNode.style } : undefined,
        width: sourceNode.width,
        height: sourceNode.height,
      };

      setNodes((nds) => [
        ...nds.map((node) => ({ ...node, selected: false })),
        { ...newNode, selected: true },
      ]);
      setSelectedNodeId(newNode.id);
    },
    [nodes, edges, takeSnapshot, setNodes],
  );

  useDiagramClipboard({
    nodes,
    edges,
    selectedNodes,
    setNodes,
    setSelectedNodeId,
    setSelectedEdgeId,
    takeSnapshot,
  });

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      const target = nodes.find((n) => n.id === nodeId);
      const label =
        (target?.data as NodeData | undefined)?.label || "this node";
      requestDelete({ nodeIds: [nodeId], edgeIds: [], label });
    },
    [nodes, requestDelete],
  );

  const handleDeleteEdge = useCallback(
    (edgeId: string) => {
      const target = edges.find((e) => e.id === edgeId);
      const label =
        (target?.data as CustomEdgeData | undefined)?.label ||
        "this relationship";
      requestDelete({ nodeIds: [], edgeIds: [edgeId], label });
    },
    [edges, requestDelete],
  );

  const handleToggleEdgeType = useCallback(
    (edgeId: string) => {
      const target = edges.find((edge) => edge.id === edgeId);
      if (!target) return;

      const currentData = (target.data as CustomEdgeData | undefined) ?? {
        edgeType:
          (target.type as CustomEdgeData["edgeType"] | undefined) ||
          "association",
      };
      const currentType = currentData.edgeType || "association";
      const currentIndex = edgeTypeCycle.indexOf(
        currentType as (typeof edgeTypeCycle)[number],
      );
      const nextType =
        edgeTypeCycle[
          currentIndex >= 0
            ? (currentIndex + 1) % edgeTypeCycle.length
            : 0
        ] ?? "association";

      handleSaveEdgeData(edgeId, {
        ...currentData,
        edgeType: nextType,
        ...getEdgeSemanticDefaults(nextType),
        flowType: nextType === "association" ? currentData.flowType : undefined,
        variability:
          nextType === "aggregation" || nextType === "composition"
            ? currentData.variability
            : undefined,
      });
    },
    [edgeTypeCycle, edges, handleSaveEdgeData],
  );

  const handleReverseEdgeDirection = useCallback(
    (edgeId: string) => {
      const target = edges.find((edge) => edge.id === edgeId);
      if (!target) return;

      takeSnapshot(nodes, edges);
      setEdges((current) =>
        current.map((edge) => {
          if (edge.id !== edgeId) return edge;
          const existingData = (edge.data as CustomEdgeData | undefined) ?? {
            edgeType:
              (edge.type as CustomEdgeData["edgeType"] | undefined) ||
              "association",
          };
          const swappedDataInput: CustomEdgeData = {
            ...existingData,
            sourceArrow: existingData.targetArrow,
            targetArrow: existingData.sourceArrow,
            sourceAnchor: existingData.targetAnchor,
            targetAnchor: existingData.sourceAnchor,
          };
          const {
            data: normalizedData,
            markerStart,
            markerEnd,
          } = getEdgeMarkers(swappedDataInput);

          return {
            ...edge,
            source: edge.target,
            target: edge.source,
            sourceHandle: edge.targetHandle,
            targetHandle: edge.sourceHandle,
            type: normalizedData.edgeType,
            data: normalizedData,
            markerStart,
            markerEnd,
          };
        }),
      );
    },
    [edges, nodes, setEdges, takeSnapshot],
  );

  const handleOpenInternalView = useCallback(async () => {
    if (!selectedNodeId) return;
    try {
      const view = await createInternalView.mutateAsync({
        nodeId: selectedNodeId,
        parentViewId: viewId,
      });
      setLocation(`/project/${view.projectId}/view/${view.id}`);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Failed to open internal view",
        description:
          err instanceof Error ? err.message : "Unexpected error occurred.",
      });
    }
  }, [createInternalView, selectedNodeId, setLocation, toast, viewId]);

  useEffect(
    () =>
      subscribeDiagramEvent("diagram-node-action-request", (detail) => {
        if (!detail.nodeId) return;
        if (detail.action === "edit") {
          handleOpenNodePanelForNode(detail.nodeId);
          return;
        }
        if (detail.action === "copy") {
          handleCopyNode(detail.nodeId);
          return;
        }
        if (detail.action === "open-internal-view") {
          void handleOpenInternalViewForNode(detail.nodeId);
          return;
        }
        if (detail.action === "delete") {
          handleDeleteNode(detail.nodeId);
        }
      }),
    [
      handleCopyNode,
      handleDeleteNode,
      handleOpenInternalViewForNode,
      handleOpenNodePanelForNode,
    ],
  );

  useEffect(
    () =>
      subscribeDiagramEvent("diagram-edge-action-request", (detail) => {
        if (!detail.edgeId) return;
        if (detail.action === "edit") {
          handleOpenEdgePanelFromTable(detail.edgeId);
          return;
        }
        if (detail.action === "delete") {
          handleDeleteEdge(detail.edgeId);
          return;
        }
        if (detail.action === "toggle-type") {
          handleToggleEdgeType(detail.edgeId);
          return;
        }
        if (detail.action === "reverse-direction") {
          handleReverseEdgeDirection(detail.edgeId);
        }
      }),
    [
      handleDeleteEdge,
      handleOpenEdgePanelFromTable,
      handleReverseEdgeDirection,
      handleToggleEdgeType,
    ],
  );

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

  const nodeTableRows = useMemo(
    () =>
      nodes.map((node) => {
        const data = node.data as unknown as NodeData | undefined;
        return {
          id: node.id,
          name: data?.label || "",
          type: data?.type || node.type || "",
          typeId: data?.typeId || "",
          icon: data?.icon || "Box",
          color: data?.color,
          description: data?.description || "",
          isReadOnly: isExternalNode(node.id),
          parentId: node.parentId || data?.typeId || "",
        };
      }),
    [nodes, isExternalNode],
  );

  const edgeTableRows = useMemo(
    () =>
      edges.map((edge) => {
        const data = edge.data as
          | (CustomEdgeData & {
              parentId?: string;
              name?: string;
            })
          | undefined;
        return {
          id: edge.id,
          name:
            data?.label ||
            data?.name ||
            [edge.source, edge.target].join(" -> "),
          type: data?.edgeType || edge.type || "",
          source: edge.source,
          target: edge.target,
          description: data?.description || "",
          parentId: data?.parentId || edge.source || "",
        };
      }),
    [edges],
  );

  const normalizedNodeTableFilter = nodeTableFilter.trim().toLowerCase();
  const normalizedEdgeTableFilter = edgeTableFilter.trim().toLowerCase();

  const filteredNodeTableRows = useMemo(() => {
    if (!normalizedNodeTableFilter) return nodeTableRows;
    return nodeTableRows.filter((row) =>
      [row.name, row.id, row.type, row.description, row.parentId]
        .join(" ")
        .toLowerCase()
        .includes(normalizedNodeTableFilter),
    );
  }, [nodeTableRows, normalizedNodeTableFilter]);

  const filteredEdgeTableRows = useMemo(() => {
    if (!normalizedEdgeTableFilter) return edgeTableRows;
    return edgeTableRows.filter((row) =>
      [
        row.name,
        row.id,
        row.type,
        row.description,
        row.parentId,
        row.source,
        row.target,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedEdgeTableFilter),
    );
  }, [edgeTableRows, normalizedEdgeTableFilter]);

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
      <>
        <div className="flex-1 flex items-center justify-center h-full">
          <div className="flex max-w-md flex-col items-center gap-3 px-6 text-center">
            <p className="font-medium text-destructive">
              This diagram could not be loaded safely.
            </p>
            <p className="text-sm text-muted-foreground">
              The saved diagram contains invalid positions or relationship
              endpoints. Your saved data was not changed.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button
                variant="outline"
                onClick={() => void reloadDiagram()}
                data-testid="button-reload-diagram"
              >
                Try again
              </Button>
              <Button onClick={openRecovery} data-testid="button-repair-diagram">
                Repair saved diagram
              </Button>
            </div>
          </div>
        </div>
        <DiagramRecoveryDialog
          open={recoveryOpen}
          flow={recoveryQuery.data}
          isLoading={recoveryQuery.isFetching}
          error={
            recoveryQuery.error instanceof Error ? recoveryQuery.error : null
          }
          isSaving={isSaving}
          onOpenChange={(open) => {
            setRecoveryOpen(open);
            if (!open) setSuspendFlowLoad(false);
          }}
          onRetry={() => void recoveryQuery.refetch()}
          onSave={handleRecoverySave}
        />
      </>
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
            canSavePattern={canSavePattern}
            onSavePattern={openPatternDialog}
            onUndo={undo}
            onRedo={redo}
            onAddNode={() =>
              handleAddNode(
                projectType === "metamodel"
                  ? { nodeType: "partdef", typeLabel: "Object" }
                  : undefined,
              )
            }
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
            onAutoLayout={handleAutoLayout}
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
            canOpenInternalView={!isFlowMode && Boolean(selectedNodeId)}
            onOpenInternalView={handleOpenInternalView}
            onValidate={handleValidate}
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

      <Dialog open={patternDialogOpen} onOpenChange={setPatternDialogOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Save Pattern</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pattern-name">Name</Label>
              <Input
                id="pattern-name"
                value={patternName}
                onChange={(event) => setPatternName(event.target.value)}
                placeholder="e.g. Control loop starter"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pattern-description">
                Description (optional)
              </Label>
              <Textarea
                id="pattern-description"
                value={patternDescription}
                onChange={(event) => setPatternDescription(event.target.value)}
                placeholder="What should this pattern be used for?"
                rows={3}
              />
            </div>
            <div className="text-xs text-muted-foreground">
              Saving {patternSnapshot?.nodes.length ?? 0} nodes and{" "}
              {patternSnapshot?.edges.length ?? 0} edges.
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPatternDialogOpen(false);
                setPatternSnapshot(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreatePattern}
              disabled={!patternName.trim() || !patternSnapshot?.nodes.length}
            >
              Save Pattern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={helpDialogOpen} onOpenChange={setHelpDialogOpen}>
        <DialogContent className="sm:max-w-[620px]">
          <DialogHeader>
            <DialogTitle>{helpContent.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground">
              {helpContent.description}
            </p>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Shortcuts</h3>
              <div className="space-y-2">
                {helpContent.shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.key}
                    className="flex items-start justify-between gap-4 rounded-lg border bg-muted/20 px-3 py-2"
                  >
                    <code className="shrink-0 rounded bg-background px-2 py-1 text-xs font-semibold">
                      {shortcut.key}
                    </code>
                    <span className="text-sm text-muted-foreground">
                      {shortcut.description}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Main Functions</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {helpContent.functions.map((item) => (
                  <li
                    key={item}
                    className="rounded-lg border bg-muted/20 px-3 py-2"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
        viewId={viewId}
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
        selectedNodeDebug={selectedNodeDebug}
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

      <Dialog open={validationOpen} onOpenChange={setValidationOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Validation Results</DialogTitle>
          </DialogHeader>

          {validationIssues.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              {projectType === "instance"
                ? "No issues found. All meta and instance rules pass."
                : "No issues found. Your model rules pass."}
            </div>
          ) : (
            <div className="space-y-2 max-h-[320px] overflow-y-auto">
              {validationIssues.map((issue, index) => (
                <div
                  key={`${issue.type}-${issue.id}-${index}`}
                  className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
                >
                  {issue.message}
                </div>
              ))}
            </div>
          )}

          <DialogFooter>
            {validationIssues.length > 0 && (
              <Button
                variant="outline"
                onClick={() => {
                  const next = !highlightIssues;
                  setHighlightIssues(next);
                  applyIssueHighlights(next);
                }}
              >
                {highlightIssues ? "Clear marks" : "Mark issues"}
              </Button>
            )}
            <Button onClick={() => setValidationOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={leaveDialogOpen}
        onOpenChange={(open) => {
          if (isLeaving) return;
          if (!open) handleCancelLeave();
        }}
      >
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Unsaved changes</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground">
            You have unsaved changes in this diagram. Save now or leave without
            saving?
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={handleCancelLeave}
              disabled={isLeaving || isSaving}
            >
              Stay
            </Button>
            <Button
              variant="outline"
              onClick={handleLeaveWithoutSaving}
              disabled={isLeaving || isSaving}
            >
              Leave without saving
            </Button>
            <Button
              onClick={handleSaveAndLeave}
              disabled={isLeaving || isSaving}
            >
              {isLeaving || isSaving ? "Saving..." : "Save and leave"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
