import { useEffect, useMemo } from "react";
import type { ModelRule, ModelRuleCondition } from "@shared/schema";
import type { TutorialModelState } from "@shared/tutorial";
import { dispatchDiagramEvent } from "@/lib/diagram-events";
import { useDiagramModel } from "@/components/flow/state/DiagramModelProvider";
import { useDiagramStore } from "@/components/flow/state/DiagramStoreProvider";
import type { NodeData } from "@/components/flow/types";

const ruleAttributes = (condition: ModelRuleCondition | undefined): string[] =>
  !condition
    ? []
    : condition.kind === "group"
      ? condition.conditions.flatMap((child) => ruleAttributes(child as ModelRuleCondition))
      : condition.field === "attribute" && condition.attribute
        ? [condition.attribute]
        : [];

const describeRule = (rule: ModelRule) => ({
  reportsIssue: rule.enabled !== false && (rule.outcome ? rule.outcome.kind === "issue" : !!rule.check),
  attributes: ruleAttributes(rule.condition),
});

/**
 * Tells the guided tutorial what the open diagram contains, so its steps can
 * check results instead of clicks. Only active for tutorial projects.
 */
export function useTutorialModelReporter(enabled: boolean, isDirty: boolean) {
  const nodes = useDiagramStore((state) => state.nodes);
  const edges = useDiagramStore((state) => state.edges);
  const selectedNodeId = useDiagramStore((state) => state.selectedNodeId);
  const nodePanelOpen = useDiagramStore((state) => state.nodePanelOpen);
  const { viewId, projectType, localModelRules, typeMetaById } = useDiagramModel();

  const state = useMemo<TutorialModelState | null>(() => {
    if (!enabled || (projectType !== "metamodel" && projectType !== "instance")) return null;
    return {
      scope: projectType,
      elements: nodes.map((node) => {
        const data = node.data as NodeData | undefined;
        const typeName =
          projectType === "instance" && data?.typeId
            ? typeMetaById.get(data.typeId)?.label ?? data.type
            : data?.type;
        return {
          id: node.id,
          name: data?.label ?? "",
          type: typeName ?? "",
          attributes: (data?.attributes ?? []).map((attribute) => ({
            name: attribute.name ?? "",
            value: attribute.value == null ? "" : String(attribute.value),
          })),
        };
      }),
      relationships: edges.map((edge) => ({ from: edge.source, to: edge.target })),
      editingId: nodePanelOpen ? selectedNodeId : null,
      rules: localModelRules.map(describeRule),
      dirty: isDirty,
    };
  }, [edges, enabled, isDirty, localModelRules, nodePanelOpen, nodes, projectType, selectedNodeId, typeMetaById]);

  useEffect(() => {
    if (state) dispatchDiagramEvent("tutorial-model-state", { viewId, state });
  }, [state, viewId]);
}
