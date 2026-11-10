import { useEffect, useRef } from "react";
import { useReactFlow } from "@xyflow/react";
import { useFlow } from "@/hooks/use-flow";
import { useDiagramStore } from "../state/DiagramStoreProvider";
import { useDiagramModel } from "../state/DiagramModelProvider";
import { diagramSignature, toCanvasGraph } from "./diagram-serialization";
import { canvasFitOptions } from "../utils/fit-options";

/**
 * Loads the open diagram into the store whenever the server copy changes
 * (unless `suspended`, e.g. while repairing it) and fits it into view once
 * per diagram.
 */
export function useDiagramLoading(suspended: boolean) {
  const { viewId, projectType } = useDiagramModel();
  const { data: flowData, isLoading, isFetching, isError, refetch } = useFlow(viewId);
  const { fitView } = useReactFlow();
  const setNodes = useDiagramStore((state) => state.setNodes);
  const setEdges = useDiagramStore((state) => state.setEdges);
  const resetHistory = useDiagramStore((state) => state.resetHistory);
  const setSavedSignature = useDiagramStore((state) => state.setSavedSignature);
  const lastFittedViewId = useRef<number | null>(null);
  // When a diagram is opened while a newer copy is on its way (the cached one
  // is outdated, e.g. it was saved since), wait for the new copy: showing the
  // old one would let edits start from a state that is no longer the saved one.
  const openedViewId = useRef<number | null>(null);
  const awaitingFreshCopy = openedViewId.current !== viewId && isFetching;

  useEffect(() => {
    if (!flowData || suspended || awaitingFreshCopy) return;
    openedViewId.current = viewId;
    const { nodes, edges } = toCanvasGraph(flowData);
    setNodes(nodes);
    setEdges(edges);
    // Undo must not cross into another diagram (or the state before a reload).
    resetHistory();
    // Compare later edits against what was loaded into the canvas, not the raw
    // server records: loading adds defaults (e.g. relationship markers and line
    // styles), which would otherwise make every diagram with relationships look
    // unsaved right after opening it.
    setSavedSignature(diagramSignature(nodes, edges, projectType));
  }, [awaitingFreshCopy, flowData, projectType, resetHistory, setEdges, setNodes, setSavedSignature, suspended, viewId]);

  useEffect(() => {
    if (!flowData || awaitingFreshCopy || lastFittedViewId.current === viewId) return;
    lastFittedViewId.current = viewId;
    requestAnimationFrame(() => {
      fitView(canvasFitOptions(500));
    });
  }, [awaitingFreshCopy, flowData, fitView, viewId]);

  return { isLoading: isLoading || awaitingFreshCopy, isError, reload: refetch };
}
