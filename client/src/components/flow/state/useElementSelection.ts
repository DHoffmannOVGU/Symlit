import { useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useDiagramStore } from "./DiagramStoreProvider";
import { useDiagramModel } from "./DiagramModelProvider";

/**
 * Selecting elements and opening their panels. Elements from referenced
 * projects are read-only: they are selected, but their panel does not open.
 */
export function useElementSelection() {
  const { isExternalNode } = useDiagramModel();
  const { toast } = useToast();
  const selectNode = useDiagramStore((state) => state.selectNode);
  const selectEdge = useDiagramStore((state) => state.selectEdge);
  const openNodePanelInStore = useDiagramStore((state) => state.openNodePanel);
  const openEdgePanel = useDiagramStore((state) => state.openEdgePanel);
  const closeNodePanel = useDiagramStore((state) => state.closeNodePanel);
  const closeEdgePanel = useDiagramStore((state) => state.closeEdgePanel);
  const setNodePanelOpen = useDiagramStore((state) => state.setNodePanelOpen);

  const openNodePanel = useCallback(
    (nodeId: string) => {
      if (isExternalNode(nodeId)) {
        selectNode(nodeId);
        setNodePanelOpen(false);
        toast({ title: "Read-only type", description: "Types from a referenced metamodel are edited in their own metamodel." });
        return;
      }
      openNodePanelInStore(nodeId);
    },
    [isExternalNode, openNodePanelInStore, selectNode, setNodePanelOpen, toast],
  );

  return { selectNode, selectEdge, openNodePanel, openEdgePanel, closeNodePanel, closeEdgePanel };
}
