import { useEffect, useMemo } from "react";
import { dispatchDiagramEvent } from "@/lib/diagram-events";
import { useDiagramStore } from "../state/DiagramStoreProvider";
import { useDiagramModel } from "../state/DiagramModelProvider";

/**
 * The elements selected on the canvas. Keeps the store's `selectedNodeId` on
 * the first of them and tells the sidebar which element is selected.
 */
export function useSelectedNodes() {
  const nodes = useDiagramStore((state) => state.nodes);
  const selectedNodeId = useDiagramStore((state) => state.selectedNodeId);
  const setSelectedNodeId = useDiagramStore((state) => state.setSelectedNodeId);
  const { viewId } = useDiagramModel();

  const selectedNodes = useMemo(() => nodes.filter((node) => node.selected), [nodes]);
  const selectedNodeIds = useMemo(() => selectedNodes.map((node) => node.id), [selectedNodes]);

  useEffect(() => {
    const first = selectedNodes.length > 0 ? selectedNodes[0].id : null;
    setSelectedNodeId((previous) => (previous === first ? previous : first));
  }, [selectedNodes, setSelectedNodeId]);

  useEffect(() => {
    dispatchDiagramEvent("selected-node-changed", { nodeId: selectedNodeId, viewId });
  }, [selectedNodeId, viewId]);

  return { selectedNodes, selectedNodeIds };
}
