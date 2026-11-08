import { useDiagramModel } from "../state/DiagramModelProvider";
import { useDiagramStore } from "../state/DiagramStoreProvider";
import { useMemo } from "react";
import type { DiagramNode as Node } from "../types";
import { type CustomEdgeData } from "../edges/CustomEdges";
import { evaluateModelRuleResults, supportsModelRules } from "../rules/model-rules";

export interface UseCanvasDisplayGraphParams {
  connectingFromNodeId: string | null;
  draggingNodeId: string | null;
  alwaysShowAccent: boolean;
  showNodeDescriptions: boolean;
  flowCurrentTick: number;
  flowSchedule: Map<string, number[]> | null;
  isFlowRunning: boolean;
  flowCompleted: boolean;
  dragPreviewNode: Node | null;
}

export function useCanvasDisplayGraph({
  connectingFromNodeId,
  draggingNodeId,
  alwaysShowAccent,
  showNodeDescriptions,
  flowCurrentTick,
  flowSchedule,
  isFlowRunning,
  flowCompleted,
  dragPreviewNode,
}: UseCanvasDisplayGraphParams) {
  const nodes = useDiagramStore((state) => state.nodes);
  const edges = useDiagramStore((state) => state.edges);
  const { isFlowMode, isExternalNode, projectType, activeModelRules, inheritedModelRuleIds } = useDiagramModel();
  const baseDisplayNodes = useMemo(() => {
    const stripFlowTags = !isFlowMode;
    const selectedNodeCount = nodes.filter((node) => node.selected).length;
    return nodes.map((node) => {
      const nextNode =
        node.id === connectingFromNodeId
          ? {
              ...node,
              className: `${node.className ?? ""} is-connection-source`.trim(),
            }
          : node;
      const rawData = nextNode.data;
      const data = rawData;
      const isEditableNode = !isExternalNode(node.id);
      const isConnectableNode = isEditableNode;
      if (stripFlowTags) {
        if (
          !data?.flowStart &&
          !data?.flowEnd &&
          data?.flowTick === undefined &&
          data?.flowActive === undefined
        ) {
          return {
            ...nextNode,
            connectable: isConnectableNode,
            data: {
              ...data,
              showActionToolbar: nextNode.selected && selectedNodeCount === 1,
              suppressActionToolbar:
                connectingFromNodeId === node.id || draggingNodeId === node.id,
              isReadOnly: isExternalNode(node.id),
              alwaysShowAccent,
              showDescription: showNodeDescriptions,
            },
          };
        }
        return {
          ...nextNode,
          connectable: isConnectableNode,
          data: {
            ...data,
            showActionToolbar: nextNode.selected && selectedNodeCount === 1,
            suppressActionToolbar:
              connectingFromNodeId === node.id || draggingNodeId === node.id,
            isReadOnly: isExternalNode(node.id),
            flowStart: false,
            flowEnd: false,
            flowTick: undefined,
            flowActive: false,
            alwaysShowAccent,
            showDescription: showNodeDescriptions,
          },
        };
      }

      const hasFlowProgress = flowCurrentTick > 0;
      const scheduledTicks = flowSchedule?.get(nextNode.id) ?? [];
      const visibleTicks =
        (isFlowRunning || flowCompleted || hasFlowProgress) &&
        scheduledTicks.length > 0
          ? scheduledTicks.filter((tick) => tick <= flowCurrentTick)
          : [];
      const shouldShowTick = visibleTicks.length > 0;
      const isFlowActive =
        (isFlowRunning || flowCompleted || hasFlowProgress) &&
        scheduledTicks.includes(flowCurrentTick);
      if (!data && !shouldShowTick) {
        return {
          ...nextNode,
          connectable: isConnectableNode,
        };
      }
      return {
        ...nextNode,
        connectable: isConnectableNode,
        data: {
          ...data,
          showActionToolbar: nextNode.selected && selectedNodeCount === 1,
          suppressActionToolbar:
            connectingFromNodeId === node.id || draggingNodeId === node.id,
          isReadOnly: isExternalNode(node.id),
          flowTick: shouldShowTick ? visibleTicks : undefined,
          flowActive: isFlowActive,
          alwaysShowAccent,
          showDescription: showNodeDescriptions,
        },
      };
    });
  }, [
    connectingFromNodeId,
    flowCompleted,
    flowCurrentTick,
    flowSchedule,
    isFlowMode,
    isFlowRunning,
    nodes,
    isExternalNode,
    alwaysShowAccent,
    showNodeDescriptions,
    draggingNodeId,
  ]);

  const modelRuleResults = useMemo(
    () =>
      supportsModelRules(projectType)
        ? evaluateModelRuleResults(activeModelRules, nodes, edges)
        : [],
    [activeModelRules, edges, nodes, projectType],
  );
  const modelRuleViolations = useMemo(
    () => modelRuleResults.flatMap((result) => result.outcome.kind === "issue" ? [{ ...result, severity: result.outcome.severity }] : []),
    [modelRuleResults],
  );
  const modelRuleViolationByNodeId = useMemo(() => {
    const result = new Map<string, (typeof modelRuleViolations)[number]>();
    modelRuleViolations.forEach((violation) => {
      const existing = result.get(violation.nodeId);
      if (!existing || violation.severity === "error") result.set(violation.nodeId, violation);
    });
    return result;
  }, [modelRuleViolations]);
  const modelRuleTagsByNodeId = useMemo(() => {
    const result = new Map<string, Array<{ label: string; color?: string; ruleName: string; origin?: "meta" | "instance" | "model" }>>();
    modelRuleResults.forEach((match) => {
      if (match.outcome.kind !== "tag") return;
      const outcome = match.outcome;
      const tags = result.get(match.nodeId) ?? [];
      if (!tags.some((tag) => tag.label === outcome.label)) {
        tags.push({
          label: outcome.label,
          color: outcome.color,
          ruleName: match.ruleName,
          origin: inheritedModelRuleIds.has(match.ruleId) ? "meta" : projectType === "instance" ? "instance" : "model",
        });
      }
      result.set(match.nodeId, tags);
    });
    return result;
  }, [inheritedModelRuleIds, modelRuleResults, projectType]);

  const displayNodes = useMemo<Node[]>(
    () => {
      const ruleDecoratedNodes: Node[] = baseDisplayNodes.map(
        (node): Node => {
          const violation = modelRuleViolationByNodeId.get(node.id);
          const tags = modelRuleTagsByNodeId.get(node.id);
          if (!violation && !tags?.length) return node;
          const data = node.data;
          return {
            ...node,
            data: {
              ...data,
              modelRuleTags: tags,
              ...(violation ? {
                ruleAccentColor: violation.severity === "error" ? "#ef4444" : "#f59e0b",
                ruleEmphasis:
                  violation.severity === "error"
                    ? ("strong" as const)
                    : ("soft" as const),
                ruleStateLabel: violation.ruleName,
              } : {}),
            },
          };
        },
      );
      return [
        ...ruleDecoratedNodes,
        ...(dragPreviewNode ? [dragPreviewNode] : []),
      ];
    },
    [
      baseDisplayNodes,
      modelRuleViolationByNodeId,
      modelRuleTagsByNodeId,
      dragPreviewNode,
    ],
  );

  const displayEdges = useMemo(
    () =>
      edges.map((edge) => {
        const edgeData = (edge.data as CustomEdgeData | undefined) ?? {
          edgeType:
            (edge.type as CustomEdgeData["edgeType"] | undefined) ||
            "association",
        };
        const baseEdge =
          edgeData.edgeType === "aggregation"
            ? { ...edge, zIndex: Math.max(edge.zIndex ?? 0, 10) }
            : edge;
        return baseEdge;
      }),
    [edges],
  );

  return {
    displayNodes,
    displayEdges,
  };
}
