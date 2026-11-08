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
import { useElementSelection } from "../state/useElementSelection";
import { useCanvasElementActions } from "./useCanvasElementActions";
// DiagramCanvas.tsx
import { useCallback, useEffect, useRef, useState } from "react";
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
  ConnectionMode,
  useConnection,
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
import { ConnectedCanvasTableMode } from "./CanvasTableMode";
import { CanvasEdgeCreateMenu } from "./CanvasEdgeCreateMenu";
import { useInheritedTypeStyles } from "./useInheritedTypeStyles";
import { useSelectedNodes } from "./useSelectedNodes";
import { ConnectionPreviewLine, edgeTypes } from "../edges/CustomEdges";
import { useEdgeCreation } from "../hooks/useEdgeCreation";
import { EdgeRelationConfirmationProvider } from "../edges/EdgeRelationConfirmation";


import { CanvasToolbar } from "./CanvasToolbar";
import { useDiagramCanvas } from "../hooks/useDiagramCanvas";
import { DiagramStoreProvider, useDiagramStore, useDiagramStoreApi } from "../state/DiagramStoreProvider";
import { DiagramModelProvider, useDiagramModel } from "../state/DiagramModelProvider";
import { useDiagramScreenshot } from "../hooks/useDiagramScreenshot";
import { useDiagramValidation } from "../hooks/useDiagramValidation";
import { useFlowPlayback } from "../hooks/useFlowPlayback";
import { ScreenshotDialog } from "../dialogs/ScreenshotDialog";
import { DeleteConfirmDialog } from "../dialogs/DeleteConfirmDialog";
import {
  subscribeDiagramEvent,
} from "@/lib/diagram-events";
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
import type { MetamodelSetup } from "@shared/metamodel-setup";

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
  displayMode = "graph",
  onDisplayModeChange,
}: DiagramCanvasProps) {
  const [suspendFlowLoad, setSuspendFlowLoad] = useState(false);
  const canvasShellRef = useRef<HTMLDivElement | null>(null);

  const {
    isLoading,
    isError,
    reload: reloadDiagram,

    nodes,
    edges,
    setNodes,

    onEdgesChange,



    handleAddNode,
    handleAutoLayout,
    handleLayoutSelected,
    handleCenterSelected,
    handleSave,
    handleSaveAsync,
    handleSaveRecovered,

    isSaving,
    isDirty,
  } = useDiagramCanvas(viewId, projectType, suspendFlowLoad);



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
  const pendingDelete = useDiagramStore((state) => state.pendingDelete);
  const cancelDelete = useDiagramStore((state) => state.cancelDelete);
  const deleteDialogOpen = pendingDelete !== null;
  const [isCanvasReady, setIsCanvasReady] = useState(false);
  // Decided when the canvas mounts and then kept: changing React Flow's
  // `fitView` prop later would trigger another fit.
  const [fitViewOnMount, setFitViewOnMount] = useState(false);
  const diagramStore = useDiagramStoreApi();
  const preferences = useDiagramCanvasPreferences();
  const { snapNodesEnabled, showBackgroundDots, alwaysShowAccent, showNodeDescriptions } = preferences;
  const helpDialogOpen = useDiagramStore((state) => state.helpDialogOpen);
  const setHelpDialogOpen = useDiagramStore((state) => state.setHelpDialogOpen);
  const {
    dragPreviewNode,
    handleCanvasDragOver,
    clearDragPreview,
  } = useCanvasDragPreview();
  const {
    draggingNodeId,
    alignmentGuides,
    handleNodeDrag,
    handleNodeDragStart,
    handleNodeDragStop,
  } = useCanvasNodeSnapping({
    snapNodesEnabled,
  });

  const {
    isFlowMode,
    activeModelRules,
    inheritedModelRuleIds,
    configuredRelationTypes,
    localModelRules,
    referencedModelRules,
    metamodelSetup,
  } = useDiagramModel();
  const isTableMode = displayMode === "table";
  const helpContent = useDiagramHelpContent(projectType, isFlowMode);


  const {
    openNodePanel,
    openEdgePanel,
  } = useElementSelection();

  const {
    insertNodeIntoView,
  } = useCanvasInsertion();

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
    canvasShellRef,
  });
  const {
    handleApplyAiProposal,
  } = useCanvasAiProposal({
    toggleAiAssistant,
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
    handleAddNode,
    insertNodeIntoView,
    toggleModelRules,
    clearDragPreview,
  });

  const playback = useFlowPlayback();
  const {
    flowCompleted,
    flowCurrentTick,
    flowEndLabel,
    flowMaxTick,
    flowSchedule,
    flowStartLabel,
    isFlowRunning,
  } = playback;

  const {
    applyIssueHighlights,
    handleValidate,
    highlightIssues,
    setHighlightIssues,
    validationIssues,
    validationOpen,
    setValidationOpen,
  } = useDiagramValidation({
    modelRules: activeModelRules,
    inheritedModelRuleIds,
  });
  const {
    handleCanvasEdgeCreated,
    edgeRelationConfirmationValue,
  } = useEdgeRelationConfirmation();

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
    onEdgeCreated: handleCanvasEdgeCreated,
    allowedEdgeTypes: configuredRelationTypes,
  });


  const {
    displayNodes,
    displayEdges,
  } = useCanvasDisplayGraph({
    connectingFromNodeId,
    draggingNodeId,
    alwaysShowAccent,
    showNodeDescriptions,
    flowCurrentTick,
    flowSchedule,
    isFlowRunning,
    flowCompleted,
    dragPreviewNode,
  });


  const { selectedNodes, selectedNodeIds } = useSelectedNodes();
  const canSavePattern = selectedNodes.length >= 2;




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
    canSavePattern,
    selectedNodeIds,
  });

  useInheritedTypeStyles();

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
      setFitViewOnMount(diagramStore.getState().nodes.length > 0);
      setIsCanvasReady(true);
    }, 120);
    return () => window.clearTimeout(timer);
  }, [diagramStore, isLoading, viewId]);

  const onCanvasNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((current) => applyNodeChanges(changes, current));
    },
    [setNodes],
  );

  const onNodeDoubleClick: NodeMouseHandler = useCallback(
    (_event, node) => openNodePanel(node.id),
    [openNodePanel],
  );
  const onEdgeDoubleClick: EdgeMouseHandler = useCallback(
    (_event, edge) => openEdgePanel(edge.id),
    [openEdgePanel],
  );

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
    selectedNodes,
  });
  useCanvasActionRequests({
    handleOpenNodePanelForNode: openNodePanel,
    handleCopyNode,
    handleDeleteNode,
    handleOpenEdgePanelFromTable: openEdgePanel,
    handleDeleteEdge,
    handleToggleEdgeType,
    handleReverseEdgeDirection,
  });

  const handleConfirmDelete = useDiagramStore((state) => state.confirmDelete);

  useCanvasKeyboardShortcuts({
    deleteDialogOpen,
    onSave: handleSave,
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
        viewId={viewId}
        reloadDiagram={reloadDiagram}
        isSaving={isSaving}
        setSuspendFlowLoad={setSuspendFlowLoad}
        saveRecovered={handleSaveRecovered}
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
        <ConnectedCanvasTableMode
          instanceNodeTypeOptions={instanceNodeTypeOptions}
          metamodelNodeTypeOptions={metamodelNodeTypeOptions}
          onInlineNodeFieldChange={handleInlineNodeFieldChange}
          onInlineEdgeFieldChange={handleInlineEdgeFieldChange}
          displayMode="table"
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
          connectionMode={ConnectionMode.Loose}
          connectionRadius={30}
          connectionLineComponent={ConnectionPreviewLine}
          minZoom={0.1}
          deleteKeyCode={null}
          // Fit once when the canvas mounts with elements. On an empty diagram
          // React Flow would otherwise zoom onto the first element dropped in,
          // pushing the next one off-screen.
          fitView={fitViewOnMount}
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

          <CanvasToolbar
            displayMode={displayMode}
            onDisplayModeChange={(mode) => onDisplayModeChange?.(mode)}
            preferences={preferences}
            playback={playback}
            selectedNodeIds={selectedNodeIds}
            canSavePattern={canSavePattern}
            onSavePattern={openPatternDialog}
            onAutoLayout={handleAutoLayout}
            onLayoutSelected={handleLayoutSelected}
            onCenterSelected={handleCenterSelected}
            onScreenshot={takeScreenshot}
            onValidate={handleValidate}
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

      <CanvasEdgeCreateMenu
        menu={edgeCreateMenu}
        sourceNodeId={pendingConnectionSource?.nodeId ?? null}
        onCreate={finalizeEdgeCreateNode}
        onCancel={closeEdgeCreateMenu}
      />

      <CanvasInspectorPanels
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
          if (!open) cancelDelete();
        }}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}

export function DiagramCanvas(props: DiagramCanvasProps) {
  return (
    <ReactFlowProvider>
      <DiagramStoreProvider>
        <DiagramModelProvider {...props}>
          <FlowInner {...props} />
        </DiagramModelProvider>
      </DiagramStoreProvider>
    </ReactFlowProvider>
  );
}
