import { useCallback, useMemo } from "react";
import { emitTutorialSignal } from "@/lib/tutorial-signals";
import type { CustomEdgeData } from "../edges/CustomEdges";
import type { useFlowPlayback } from "../hooks/useFlowPlayback";
import { useDiagramStore } from "../state/DiagramStoreProvider";
import { useDiagramModel } from "../state/DiagramModelProvider";
import { DiagramToolbar } from "./DiagramToolBar";
import { computeStraightenedEdge } from "./straightenEdge";
import type { DiagramCanvasPreferences } from "./useDiagramCanvasPreferences";

export interface CanvasToolbarProps {
  displayMode: "graph" | "table";
  onDisplayModeChange: (mode: "graph" | "table") => void;
  preferences: DiagramCanvasPreferences;
  playback: ReturnType<typeof useFlowPlayback>;
  selectedNodeIds: string[];
  canSavePattern: boolean;
  onSavePattern: () => void;
  onAutoLayout: () => void;
  onLayoutSelected: (direction: "TB" | "LR", nodeIds: string[]) => void;
  onCenterSelected: (axis: "x" | "y", nodeIds: string[]) => void;
  onScreenshot: () => void;
  onValidate: () => void;
}

/** The canvas toolbar, wired to the open diagram. */
export function CanvasToolbar({
  displayMode,
  onDisplayModeChange,
  preferences,
  playback,
  selectedNodeIds,
  canSavePattern,
  onSavePattern,
  onAutoLayout,
  onLayoutSelected,
  onCenterSelected,
  onScreenshot,
  onValidate,
}: CanvasToolbarProps) {
  const { projectType, isFlowMode } = useDiagramModel();
  const nodes = useDiagramStore((state) => state.nodes);
  const edges = useDiagramStore((state) => state.edges);
  const setEdges = useDiagramStore((state) => state.setEdges);
  const undo = useDiagramStore((state) => state.undo);
  const redo = useDiagramStore((state) => state.redo);
  const canUndo = useDiagramStore((state) => state.past.length > 0);
  const canRedo = useDiagramStore((state) => state.future.length > 0);
  const selectedNodeId = useDiagramStore((state) => state.selectedNodeId);
  const setHelpDialogOpen = useDiagramStore((state) => state.setHelpDialogOpen);

  const selectedEdge = useMemo(() => edges.find((edge) => edge.selected) ?? null, [edges]);
  const straightenSelectedEdge = useCallback(() => {
    if (!selectedEdge) return;
    const patch = computeStraightenedEdge(selectedEdge, nodes);
    if (!patch) return;
    setEdges((current) =>
      current.map((edge) =>
        edge.id === selectedEdge.id
          ? { ...edge, data: patch.data, sourceHandle: patch.sourceHandle, targetHandle: patch.targetHandle }
          : edge,
      ),
    );
  }, [nodes, selectedEdge, setEdges]);

  const {
    snapNodesEnabled,
    setSnapEnabled,
    showBackgroundDots,
    setShowBackgroundDots,
    alwaysShowAccent,
    setAlwaysShowAccent,
    showNodeDescriptions,
    setShowNodeDescriptions,
  } = preferences;
  const {
    isFlowRunning,
    flowStartNodeId,
    flowEndNodeId,
    flowCurrentTick,
    flowMaxTick,
    handleSetFlowStart,
    handleSetFlowEnd,
    handlePlayFlow,
    handleStopFlow,
    handleStepBack,
    handleStepForward,
    handleResetFlow,
  } = playback;

  return (
    <DiagramToolbar
      projectType={projectType}
      displayMode={displayMode}
      onDisplayModeChange={onDisplayModeChange}
      canUndo={canUndo}
      canRedo={canRedo}
      canStraightenEdge={Boolean(
        !isFlowMode && (selectedEdge?.data as CustomEdgeData | undefined)?.pathType === "straight",
      )}
      canLayoutSelection={selectedNodeIds.length > 0}
      canAutoLayout={nodes.length > 0}
      canSavePattern={canSavePattern}
      onSavePattern={onSavePattern}
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
        onAutoLayout();
        emitTutorialSignal("auto-layout");
      }}
      onLayoutSelectedVertical={() => onLayoutSelected("TB", selectedNodeIds)}
      onLayoutSelectedHorizontal={() => onLayoutSelected("LR", selectedNodeIds)}
      onCenterSelectedVertical={() => onCenterSelected("x", selectedNodeIds)}
      onCenterSelectedHorizontal={() => onCenterSelected("y", selectedNodeIds)}
      onScreenshot={onScreenshot}
      onValidate={onValidate}
      onStraightenEdge={straightenSelectedEdge}
      onToggleSnap={() => setSnapEnabled((current) => !current)}
      onToggleAlwaysShowAccent={() => setAlwaysShowAccent((current) => !current)}
      onToggleBackgroundDots={() => setShowBackgroundDots((current) => !current)}
      onToggleNodeDescriptions={() => setShowNodeDescriptions((current) => !current)}
      autoSave={preferences.autoSave}
      onToggleAutoSave={() => preferences.setAutoSave((current) => !current)}
      onOpenHelp={() => setHelpDialogOpen(true)}
    />
  );
}
