import { useReactFlow } from "@xyflow/react";
import { useDiagramModel } from "../state/DiagramModelProvider";
import { useCallback, useEffect, type DragEvent } from "react";
import type { NodeData } from "../types";
import { supportsModelRules } from "../rules/model-rules";
import { subscribeDiagramEvent } from "@/lib/diagram-events";
import {
  METAMODEL_NODE_DRAG_MIME,
  type SidebarCreateMetamodelNodeDragPayload,
  type SidebarNodeTransfer,
} from "./diagramCanvasTypes";

export interface UseCanvasDropInsertionParams {
  handleAddNode: (options?: { nodeType?: "partdef" | "actiondef" | "concerndef" | "agentdef" | "requirementdef" | "eventdef" | "capabilitydef"; typeId?: string; typeLabel?: string; icon?: string; color?: string; position?: { x: number; y: number; }; }) => void;
  insertNodeIntoView: (nodeId: string, position?: { x: number; y: number; }) => Promise<void>;
  toggleModelRules: () => void;
  clearDragPreview: () => void;
}

export function useCanvasDropInsertion({
  handleAddNode,
  insertNodeIntoView,
  toggleModelRules,
  clearDragPreview,
}: UseCanvasDropInsertionParams) {
  const { availablePartDefNodes, partDefStyleById, viewId, projectType } = useDiagramModel();
  const { screenToFlowPosition } = useReactFlow();
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
                    ? "Need"
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
                      ? "Need"
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
      clearDragPreview,
      createNodeFromTypeAtPosition,
      handleAddNode,
      insertNodeIntoView,
      projectType,
      screenToFlowPosition,
      viewId,
    ],
  );

  return {
    handleCanvasDrop,
  };
}
