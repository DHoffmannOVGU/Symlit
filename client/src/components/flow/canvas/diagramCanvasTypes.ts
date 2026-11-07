import type { Node } from "@xyflow/react";

export const METAMODEL_NODE_DRAG_MIME = "application/x-mbse-metamodel-node";
export const DRAG_PREVIEW_NODE_ID = "__drag-preview__";
export const DRAG_PREVIEW_WIDTH = 180;
export const DRAG_PREVIEW_HEIGHT = 110;

export type SidebarNodeInsertMode = "insert-reference" | "create-instance-node";

export type SidebarNodeTransfer = {
  nodeId: string;
  typeId?: string;
  viewId: number;
  mode?: SidebarNodeInsertMode;
  position?: { x: number; y: number };
  typeLabel?: string;
  icon?: string;
  color?: string;
};

export type SidebarCreateMetamodelNodeDetail = {
  viewId: number;
  nodeType: "partdef" | "actiondef" | "concerndef" | "agentdef" | "requirementdef" | "eventdef" | "capabilitydef";
  parentTypeId?: string;
  typeLabel?: string;
  icon?: string;
  color?: string;
};

export type SidebarCreateMetamodelNodeDragPayload =
  SidebarCreateMetamodelNodeDetail;

export type DiagramSaveRequestDetail = {
  viewId: number;
};

export type DiagramDirtyStateDetail = {
  viewId: number;
  isDirty: boolean;
};

export type DiagramSaveStateDetail = {
  viewId: number;
  isSaving: boolean;
};

export type DiagramModelNodeCreatedDetail = {
  viewId: number;
  nodeId: string;
  /** Set when the element is an instance of a referenced metamodel type. */
  typeId?: string;
};

export type DiagramModelEdgeCreatedDetail = {
  viewId: number;
  edgeId: string;
};

export type DiagramNodeActionRequestDetail = {
  nodeId: string;
  action: "edit" | "copy" | "delete";
};

export type DiagramEdgeActionRequestDetail = {
  edgeId: string;
  action: "edit" | "delete" | "toggle-type" | "reverse-direction";
};

export type DragPreviewState = {
  nodeType: SidebarCreateMetamodelNodeDetail["nodeType"];
  position: { x: number; y: number };
  typeLabel?: string;
  icon?: string;
  color?: string;
};

export type CopiedNodeSnapshot = {
  id: string;
  type?: Node["type"];
  position: Node["position"];
  data: Record<string, unknown>;
  className?: Node["className"];
  style?: Node["style"];
  width?: Node["width"];
  height?: Node["height"];
  parentId?: Node["parentId"];
};
