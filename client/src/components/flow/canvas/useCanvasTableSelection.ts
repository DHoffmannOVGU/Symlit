import type { DiagramEdge } from "../types";
import { useCallback } from "react";
import type { DiagramNode as Node } from "../types";
import { useToast } from "@/hooks/use-toast";

export interface UseCanvasTableSelectionParams {
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  setEdges: React.Dispatch<React.SetStateAction<DiagramEdge[]>>;
  setSelectedNodeId: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedEdgeId: React.Dispatch<React.SetStateAction<string | null>>;
  isExternalNode: (nodeId: string) => boolean;
  toast: ReturnType<typeof useToast>["toast"];
  setIsNodePanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsEdgePanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useCanvasTableSelection({
  setNodes,
  setEdges,
  setSelectedNodeId,
  setSelectedEdgeId,
  isExternalNode,
  toast,
  setIsNodePanelOpen,
  setIsEdgePanelOpen,
}: UseCanvasTableSelectionParams) {
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
    [isExternalNode, setEdges, setIsEdgePanelOpen, setIsNodePanelOpen, setNodes, setSelectedEdgeId, setSelectedNodeId, toast],
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
    [setEdges, setIsEdgePanelOpen, setIsNodePanelOpen, setNodes, setSelectedEdgeId, setSelectedNodeId],
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
    [setEdges, setIsEdgePanelOpen, setNodes, setSelectedEdgeId, setSelectedNodeId],
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
    [setEdges, setIsNodePanelOpen, setNodes, setSelectedEdgeId, setSelectedNodeId],
  );

  return {
    handleSelectEdgeFromTable,
    handleOpenEdgePanelFromTable,
    handleSelectNodeFromTable,
    handleOpenNodePanelFromTable,
  };
}
