import { useMemo } from "react";
import type {
  DiagramEdge,
  DiagramNode as Node,
} from "../types";

type ExternalCanvasEdge = {
  id: string;
  label?: string;
  type: "input" | "output";
  side: "left" | "right" | "top" | "bottom";
  otherNodeName: string;
};

type FlowData = {
  nodes: Array<{
    id: string;
    position: { x: number; y: number };
    data?: unknown;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
    data?: unknown;
  }>;
} | null | undefined;

interface UseExternalCanvasElementsParams {
  parentNodeId?: string | null;
  parentViewFlowData: FlowData;
  nodes: Node[];
}

export function useExternalCanvasElements({
  parentNodeId,
  parentViewFlowData,
  nodes,
}: UseExternalCanvasElementsParams) {
  const externalEdges = useMemo<ExternalCanvasEdge[]>(() => {
    if (!parentNodeId || !parentViewFlowData) return [];

    return parentViewFlowData.edges
      .filter(
        (edge) => edge.source === parentNodeId || edge.target === parentNodeId,
      )
      .map((edge) => {
        const isInput = edge.target === parentNodeId;
        const otherNodeId = isInput ? edge.source : edge.target;
        const otherNode = parentViewFlowData.nodes.find(
          (node) => node.id === otherNodeId,
        );

        let side: ExternalCanvasEdge["side"] = "left";
        const handle = isInput ? edge.targetHandle : edge.sourceHandle;

        if (handle) {
          if (handle.toLowerCase().includes("left")) side = "left";
          else if (handle.toLowerCase().includes("right")) side = "right";
          else if (handle.toLowerCase().includes("top")) side = "top";
          else if (handle.toLowerCase().includes("bottom")) side = "bottom";
        } else if (otherNode) {
          const parentNode = parentViewFlowData.nodes.find(
            (node) => node.id === parentNodeId,
          );
          if (parentNode) {
            const dx = otherNode.position.x - parentNode.position.x;
            const dy = otherNode.position.y - parentNode.position.y;
            if (Math.abs(dx) > Math.abs(dy)) {
              side = dx > 0 ? "right" : "left";
            } else {
              side = dy > 0 ? "bottom" : "top";
            }
          }
        }

        return {
          id: edge.id,
          label: (edge.data as { label?: string } | undefined)?.label,
          type: isInput ? "input" : "output",
          side,
          otherNodeName:
            ((otherNode?.data as { label?: string } | undefined)?.label ??
              "External Node"),
        };
      });
  }, [parentNodeId, parentViewFlowData]);

  const externalRender = useMemo(() => {
    if (!parentNodeId || externalEdges.length === 0) {
      return { nodes: [] as Node[], edges: [] as DiagramEdge[] };
    }

    const parentNode = nodes.find((node) => node.id === parentNodeId);
    if (!parentNode) {
      return { nodes: [] as Node[], edges: [] as DiagramEdge[] };
    }

    const parentData = parentNode.data as Record<string, unknown> | undefined;
    const parentStyle = parentNode.style as
      | { width?: number; height?: number }
      | undefined;
    const savedStyle = parentData?._nodeStyle as
      | { width?: number; height?: number }
      | undefined;

    const width = Number(parentStyle?.width ?? savedStyle?.width ?? 700);
    const height = Number(parentStyle?.height ?? savedStyle?.height ?? 500);
    const accentColor =
      typeof parentData?.color === "string" ? parentData.color : undefined;

    const groups: Record<ExternalCanvasEdge["side"], ExternalCanvasEdge[]> = {
      left: [],
      right: [],
      top: [],
      bottom: [],
    };

    externalEdges.forEach((edge) => {
      groups[edge.side].push(edge);
    });

    const stubWidth = 150;
    const stubHeight = 30;
    const offset = 24;

    const oppositeSide = (side: ExternalCanvasEdge["side"]) => {
      switch (side) {
        case "left":
          return "right";
        case "right":
          return "left";
        case "top":
          return "bottom";
        default:
          return "top";
      }
    };

    const externalNodes: Node[] = [];
    const externalEdgesToRender: DiagramEdge[] = [];

    (["left", "right", "top", "bottom"] as const).forEach((side) => {
      const list = groups[side];
      if (list.length === 0) return;

      list.forEach((edge, index) => {
        const t = (index + 1) / (list.length + 1);
        const position =
          side === "left" || side === "right"
            ? {
                x:
                  parentNode.position.x +
                  (side === "left" ? -offset - stubWidth : width + offset),
                y: parentNode.position.y + height * t - stubHeight / 2,
              }
            : {
                x: parentNode.position.x + width * t - stubWidth / 2,
                y:
                  parentNode.position.y +
                  (side === "top" ? -offset - stubHeight : height + offset),
              };

        const stubId = `external-stub-${edge.id}`;
        externalNodes.push({
          id: stubId,
          type: "externalStub",
          position,
          data: {
            label: edge.label || edge.otherNodeName,
            direction: edge.type,
            accentColor,
            side,
          },
          style: { width: stubWidth, height: stubHeight },
          draggable: false,
          selectable: false,
          connectable: false,
          deletable: false,
          focusable: false,
        });

        const isInput = edge.type === "input";
        externalEdgesToRender.push({
          id: `external-edge-${edge.id}`,
          source: isInput ? stubId : parentNodeId,
          target: isInput ? parentNodeId : stubId,
          type: "association",
          selectable: false,
          focusable: false,
          deletable: false,
          data: {
            edgeType: "association",
            lineStyle: "dashed",
            strokeColor: accentColor,
            sourceAnchor: {
              side: isInput ? oppositeSide(side) : side,
              offset: 0.5,
            },
            targetAnchor: {
              side: isInput ? side : oppositeSide(side),
              offset: 0.5,
            },
          },
        });
      });
    });

    return { nodes: externalNodes, edges: externalEdgesToRender };
  }, [externalEdges, nodes, parentNodeId]);

  return { externalEdges, externalRender };
}
