import { useReactFlow } from "@xyflow/react";
import { useDiagramModel } from "../state/DiagramModelProvider";
import { useCallback, useEffect, useState, type DragEvent } from "react";
import type { DiagramNode as Node } from "../types";
import {
  DRAG_PREVIEW_HEIGHT,
  DRAG_PREVIEW_NODE_ID,
  DRAG_PREVIEW_WIDTH,
  METAMODEL_NODE_DRAG_MIME,
  type DragPreviewState,
  type SidebarCreateMetamodelNodeDragPayload,
  type SidebarNodeTransfer,
} from "./diagramCanvasTypes";


const NODE_TYPE_DEFAULT_LABEL: Record<DragPreviewState["nodeType"], string> = {
  partdef: "Object",
  actiondef: "Behavior",
  concerndef: "Concern",
  agentdef: "Performer",
  requirementdef: "Need",
  eventdef: "Event",
  capabilitydef: "Capability",
};

function buildDragPreviewNode(dragPreview: DragPreviewState): Node {
  return {
    id: DRAG_PREVIEW_NODE_ID,
    type: dragPreview.nodeType,
    position: dragPreview.position,
    draggable: false,
    selectable: false,
    connectable: false,
    data: {
      label: dragPreview.typeLabel || "New node",
      type:
        dragPreview.typeLabel ||
        NODE_TYPE_DEFAULT_LABEL[dragPreview.nodeType],
      icon: dragPreview.icon,
      color: dragPreview.color,
      alwaysShowAccent: true,
    },
    style: {
      opacity: 0.72,
      pointerEvents: "none",
    },
    className: "pointer-events-none",
  };
}

/**
 * Manages the transient ghost-node state shown while a sidebar item is being
 * dragged over the diagram canvas. Owns the ghost state, the dragover handler
 * that updates it, and the global dragend/drop cleanup listeners.
 */
export function useCanvasDragPreview() {
  const { viewId } = useDiagramModel();
  const { screenToFlowPosition } = useReactFlow();
  const [dragPreview, setDragPreview] = useState<DragPreviewState | null>(null);

  const handleCanvasDragOver = useCallback(
    (event: DragEvent) => {
      if (!event.dataTransfer.types.includes(METAMODEL_NODE_DRAG_MIME)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";

      try {
        const raw = event.dataTransfer.getData(METAMODEL_NODE_DRAG_MIME);
        if (!raw) return;
        const payload = JSON.parse(raw) as
          | SidebarNodeTransfer
          | SidebarCreateMetamodelNodeDragPayload;
        if (!payload || payload.viewId !== viewId || !("nodeType" in payload)) {
          setDragPreview(null);
          return;
        }

        const position = screenToFlowPosition({
          x: event.clientX - DRAG_PREVIEW_WIDTH / 2,
          y: event.clientY - DRAG_PREVIEW_HEIGHT / 2,
        });

        setDragPreview({
          nodeType: payload.nodeType,
          position,
          typeLabel: payload.typeLabel,
          icon: payload.icon,
          color: payload.color,
        });
      } catch {
        setDragPreview(null);
      }
    },
    [screenToFlowPosition, viewId],
  );

  const clearDragPreview = useCallback(() => setDragPreview(null), []);

  useEffect(() => {
    const handler = () => setDragPreview(null);
    window.addEventListener("dragend", handler);
    window.addEventListener("drop", handler);
    return () => {
      window.removeEventListener("dragend", handler);
      window.removeEventListener("drop", handler);
    };
  }, []);

  const dragPreviewNode = dragPreview ? buildDragPreviewNode(dragPreview) : null;

  return {
    dragPreview,
    dragPreviewNode,
    handleCanvasDragOver,
    clearDragPreview,
  };
}
