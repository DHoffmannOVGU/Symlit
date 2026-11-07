import type { Node } from "@xyflow/react";
import type { NodeData } from "../types";
import type { CustomEdgeData } from "../edges/CustomEdges";

export type FlowType = NonNullable<CustomEdgeData["flowType"]>;

const isActionNode = (node?: Node | null) => {
  if (!node) return false;
  const data = node.data as NodeData | undefined;
  return node.type === "actiondef" || data?.type === "Behavior" || data?.type === "Action";
};

export const inferFlowTypeFromNodes = (
  sourceNode?: Node | null,
  targetNode?: Node | null,
): FlowType => {
  const sourceIsAction = isActionNode(sourceNode);
  const targetIsAction = isActionNode(targetNode);

  if (sourceIsAction && targetIsAction) {
    return "actionflow";
  }
  return "partflow";
};
