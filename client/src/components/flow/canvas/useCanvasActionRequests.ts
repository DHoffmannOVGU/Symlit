import { useEffect } from "react";
import { subscribeDiagramEvent } from "@/lib/diagram-events";

export interface UseCanvasActionRequestsParams {
  handleOpenNodePanelForNode: (nodeId: string) => void;
  handleCopyNode: (nodeId: string) => void;
  handleDeleteNode: (nodeId: string) => void;
  handleOpenEdgePanelFromTable: (edgeId: string) => void;
  handleDeleteEdge: (edgeId: string) => void;
  handleToggleEdgeType: (edgeId: string) => void;
  handleReverseEdgeDirection: (edgeId: string) => void;
}

export function useCanvasActionRequests({
  handleOpenNodePanelForNode,
  handleCopyNode,
  handleDeleteNode,
  handleOpenEdgePanelFromTable,
  handleDeleteEdge,
  handleToggleEdgeType,
  handleReverseEdgeDirection,
}: UseCanvasActionRequestsParams) {
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
        if (detail.action === "delete") {
          handleDeleteNode(detail.nodeId);
        }
      }),
    [
      handleCopyNode,
      handleDeleteNode,
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

  return {

  };
}
