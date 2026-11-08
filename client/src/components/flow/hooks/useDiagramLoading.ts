import { useEffect, useRef } from "react";
import { useReactFlow } from "@xyflow/react";
import { useFlow } from "@/hooks/use-flow";
import { useDiagramStore } from "../state/DiagramStoreProvider";
import { useDiagramModel } from "../state/DiagramModelProvider";
import { diagramSignature, toCanvasGraph } from "./diagram-serialization";

/**
 * Loads the open diagram into the store whenever the server copy changes
 * (unless `suspended`, e.g. while repairing it) and fits it into view once
 * per diagram.
 */
export function useDiagramLoading(suspended: boolean) {
  const { viewId, projectType } = useDiagramModel();
  const { data: flowData, isLoading, isError, refetch } = useFlow(viewId);
  const { fitView } = useReactFlow();
  const setNodes = useDiagramStore((state) => state.setNodes);
  const setEdges = useDiagramStore((state) => state.setEdges);
  const resetHistory = useDiagramStore((state) => state.resetHistory);
  const setSavedSignature = useDiagramStore((state) => state.setSavedSignature);
  const lastFittedViewId = useRef<number | null>(null);

  useEffect(() => {
    if (!flowData || suspended) return;
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
  }, [flowData, projectType, resetHistory, setEdges, setNodes, setSavedSignature, suspended]);

  useEffect(() => {
    if (!flowData || lastFittedViewId.current === viewId) return;
    lastFittedViewId.current = viewId;
    requestAnimationFrame(() => {
      fitView({ duration: 500 });
    });
  }, [flowData, fitView, viewId]);

  return { isLoading, isError, reload: refetch };
}
