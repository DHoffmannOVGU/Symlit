import { useInternalViews } from "@/hooks/use-internal-views";
import type { ModelRule } from "@shared/schema";
import type { ExternalCanvasEdge } from "../hooks/useExternalCanvasElements";
import type { DiagramEdge } from "../types";
import { useMemo } from "react";
import type { DiagramNode as Node, NodeData } from "../types";
import { type CustomEdgeData } from "../edges/CustomEdges";
import { evaluateModelRuleResults, supportsModelRules } from "../rules/model-rules";

export interface UseCanvasDisplayGraphParams {
  isFlowMode: boolean;
  nodes: Node[];
  internalViewsQuery: ReturnType<typeof useInternalViews>;
  connectingFromNodeId: string | null;
  isExternalNode: (nodeId: string) => boolean;
  draggingNodeId: string | null;
  externalEdges: ExternalCanvasEdge[];
  handleOpenInternalViewForNode: (nodeId: string) => Promise<void>;
  alwaysShowAccent: boolean;
  showNodeDescriptions: boolean;
  flowCurrentTick: number;
  flowSchedule: Map<string, number[]> | null;
  isFlowRunning: boolean;
  flowCompleted: boolean;
  parentNodeId: string | null | undefined;
  projectType: "metamodel" | "instance" | "method";
  activeModelRules: ModelRule[];
  edges: DiagramEdge[];
  inheritedModelRuleIds: Set<string>;
  dragPreviewNode: Node | null;
  externalRender: { nodes: Node[]; edges: DiagramEdge[]; };
}

export function useCanvasDisplayGraph({
  isFlowMode,
  nodes,
  internalViewsQuery,
  connectingFromNodeId,
  isExternalNode,
  draggingNodeId,
  externalEdges,
  handleOpenInternalViewForNode,
  alwaysShowAccent,
  showNodeDescriptions,
  flowCurrentTick,
  flowSchedule,
  isFlowRunning,
  flowCompleted,
  parentNodeId,
  projectType,
  activeModelRules,
  edges,
  inheritedModelRuleIds,
  dragPreviewNode,
  externalRender,
}: UseCanvasDisplayGraphParams) {
  const baseDisplayNodes = useMemo(() => {
    const stripFlowTags = !isFlowMode;
    const selectedNodeCount = nodes.filter((node) => node.selected).length;
    const internalNodeIds = new Set(
      (internalViewsQuery.data ?? [])
        .map((view) => view.parentNodeId)
        .filter((id): id is string => !!id),
    );
    return nodes.map((node) => {
      const nextNode =
        node.id === connectingFromNodeId
          ? {
              ...node,
              className: `${node.className ?? ""} is-connection-source`.trim(),
            }
          : node;
      const rawData = nextNode.data as unknown as NodeData | undefined;
      const data = rawData;
      const hasInternalView = internalNodeIds.has(node.id);
      const isGroupContainer = data?.isGroupContainer === true;
      const isEditableNode = !isExternalNode(node.id);
      const isConnectableNode = isEditableNode && !isGroupContainer;
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
              hasInternalView,
              isGroupContainer,
              showActionToolbar:
                nextNode.selected &&
                selectedNodeCount === 1 &&
                !isGroupContainer,
              suppressActionToolbar:
                connectingFromNodeId === node.id || draggingNodeId === node.id,
              isReadOnly: isExternalNode(node.id),
              canOpenInternalViewAction:
                !isFlowMode &&
                !isGroupContainer &&
                !isExternalNode(node.id),
              externalEdges: isGroupContainer ? externalEdges : undefined,
              onOpenInternalView: handleOpenInternalViewForNode,
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
            hasInternalView,
            isGroupContainer,
            showActionToolbar:
              nextNode.selected && selectedNodeCount === 1 && !isGroupContainer,
            suppressActionToolbar:
              connectingFromNodeId === node.id || draggingNodeId === node.id,
            isReadOnly: isExternalNode(node.id),
            canOpenInternalViewAction:
              !isFlowMode &&
              !isGroupContainer &&
              !isExternalNode(node.id),
            externalEdges: isGroupContainer ? externalEdges : undefined,
            flowStart: false,
            flowEnd: false,
            flowTick: undefined,
            flowActive: false,
            onOpenInternalView: handleOpenInternalViewForNode,
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
          hasInternalView,
          isGroupContainer,
          showActionToolbar:
            nextNode.selected && selectedNodeCount === 1 && !isGroupContainer,
          suppressActionToolbar:
            connectingFromNodeId === node.id || draggingNodeId === node.id,
          isReadOnly: isExternalNode(node.id),
          canOpenInternalViewAction: false,
          externalEdges: isGroupContainer ? externalEdges : undefined,
          flowTick: shouldShowTick ? visibleTicks : undefined,
          flowActive: isFlowActive,
          onOpenInternalView: handleOpenInternalViewForNode,
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
    handleOpenInternalViewForNode,
    isFlowMode,
    isFlowRunning,
    nodes,
    internalViewsQuery.data,
    isExternalNode,
    parentNodeId,
    externalEdges,
    alwaysShowAccent,
    showNodeDescriptions,
    draggingNodeId,
    projectType,
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
        ...externalRender.nodes,
      ];
    },
    [
      baseDisplayNodes,
      modelRuleViolationByNodeId,
      modelRuleTagsByNodeId,
      dragPreviewNode,
      externalRender.nodes,
    ],
  );

  const displayEdges = useMemo(
    () =>
      (externalRender.edges.length > 0
        ? edges.concat(externalRender.edges)
        : edges
      ).map((edge) => {
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
    [edges, externalRender.edges],
  );

  return {
    displayNodes,
    displayEdges,
  };
}
