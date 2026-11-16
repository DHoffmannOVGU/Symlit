import { useEffect, useMemo } from "react";
import type { ModelRule, ModelRuleCondition } from "@shared/schema";
import type {
  TutorialAttribute,
  TutorialModelState,
  TutorialRule,
  TutorialRuleCondition,
} from "@shared/tutorial";
import { dispatchDiagramEvent } from "@/lib/diagram-events";
import { useView, useViews } from "@/hooks/use-views";
import { useDiagramModel } from "@/components/flow/state/DiagramModelProvider";
import { useDiagramStore } from "@/components/flow/state/DiagramStoreProvider";
import { evaluateModelRuleResults } from "@/components/flow/rules/model-rules";
import type { NodeAttribute, NodeData } from "@/components/flow/types";
import {
  evaluateDerivedAttribute,
  extractFormulaReferences,
  getDisplayFormula,
  recalculateDerivedAttributes,
} from "@/components/flow/utils/attribute-formula";

type TypeName = (typeId: string | undefined) => string;

const flattenConditions = (condition: ModelRuleCondition | undefined, typeName: TypeName): TutorialRuleCondition[] => {
  if (!condition) return [];
  if (condition.kind === "group") {
    return condition.conditions.flatMap((child) => flattenConditions(child as ModelRuleCondition, typeName));
  }
  const connected = condition.source === "connected";
  return [
    {
      about: connected ? "connected" : "self",
      direction: connected ? (condition.direction ?? "any") : "",
      quantifier: connected ? (condition.quantifier ?? "any") : "",
      type: connected ? typeName(condition.targetType) : "",
      field: condition.field,
      attribute: condition.field === "attribute" ? (condition.attribute ?? "") : "",
      operator: condition.operator,
      value: condition.value ?? "",
    },
  ];
};

const describeRule = (rule: ModelRule, typeName: TypeName): TutorialRule => {
  const conditions = flattenConditions(rule.condition, typeName);
  const active = rule.enabled !== false;
  return {
    reportsIssue: active && (rule.outcome ? rule.outcome.kind === "issue" : !!rule.check),
    tag: active && rule.outcome?.kind === "tag" ? rule.outcome.label : "",
    target: typeName(rule.targetType),
    attributes: conditions.map((condition) => condition.attribute).filter(Boolean),
    connected: conditions.some((condition) => condition.about === "connected"),
    conditions,
    combinator: rule.condition?.kind === "group" ? rule.condition.combinator : "all",
  };
};

/** An element's attributes as the tutorial sees them, with calculated values worked out now. */
const describeAttributes = (stored: NodeAttribute[]): TutorialAttribute[] => {
  // The stored result of a formula can lag behind (it is written when the
  // editor is applied or an input changes); steps must see the current one.
  const attributes = recalculateDerivedAttributes(stored);
  return attributes.map((attribute) => {
    const derived = attribute.type === "derived";
    let references: string[] = [];
    if (derived) {
      try {
        references = evaluateDerivedAttribute(attribute, attributes).references;
      } catch {
        // Not calculable: still say what the formula refers to.
        references = extractFormulaReferences(attribute.formula ?? "", attributes, attribute.id)
          .filter((reference) => !reference.missing)
          .map((reference) => reference.name);
      }
    }
    return {
      name: attribute.name ?? "",
      value: attribute.value == null ? "" : String(attribute.value),
      type: attribute.type ?? "string",
      unit: attribute.unit ?? "",
      formula: derived ? getDisplayFormula(attribute.formula ?? "", attributes, attribute.id) : "",
      references,
      options: attribute.options ?? [],
    };
  });
};

/**
 * Tells the guided tutorial what the open diagram contains, so its steps can
 * check results instead of clicks. Only active for tutorial projects.
 */
export function useTutorialModelReporter(enabled: boolean, isDirty: boolean) {
  const nodes = useDiagramStore((state) => state.nodes);
  const edges = useDiagramStore((state) => state.edges);
  const selectedNodeId = useDiagramStore((state) => state.selectedNodeId);
  const nodePanelOpen = useDiagramStore((state) => state.nodePanelOpen);
  const { viewId, projectId, projectType, localModelRules, activeModelRules, typeMetaById, referencedMetamodels } =
    useDiagramModel();
  const { data: view } = useView(enabled ? viewId : 0);
  const { data: views } = useViews(enabled ? projectId : 0);
  // As text, so that the state below only changes when the names do: the list
  // itself is a new array on every render of the page, and a new state makes
  // the page render again.
  const metamodelNames = referencedMetamodels.map((metamodel) => metamodel.name).join("\n");
  const diagramNames = (views ?? [])
    .filter((candidate) => candidate.viewType !== "pattern")
    .map((candidate) => candidate.name)
    .join("\n");

  const state = useMemo<TutorialModelState | null>(() => {
    if (!enabled || (projectType !== "metamodel" && projectType !== "instance")) return null;
    const typeName: TypeName = (typeId) =>
      !typeId || typeId === "all" ? "" : typeMetaById.get(typeId)?.label ?? typeId;
    // The tags rules give right now, as the cards show them.
    const tagsByElement = new Map<string, string[]>();
    for (const result of evaluateModelRuleResults(activeModelRules, nodes, edges)) {
      if (result.outcome.kind !== "tag") continue;
      const tags = tagsByElement.get(result.nodeId) ?? [];
      if (!tags.includes(result.outcome.label)) tags.push(result.outcome.label);
      tagsByElement.set(result.nodeId, tags);
    }
    return {
      scope: projectType,
      diagram: view?.name ?? "",
      diagrams: diagramNames ? diagramNames.split("\n") : [],
      metamodels: projectType === "instance" && metamodelNames ? metamodelNames.split("\n") : [],
      elements: nodes.map((node) => {
        const data = node.data as NodeData | undefined;
        const elementType =
          projectType === "instance" && data?.typeId
            ? typeMetaById.get(data.typeId)?.label ?? data.type
            : data?.type;
        return {
          id: node.id,
          name: data?.label ?? "",
          type: elementType ?? "",
          attributes: describeAttributes(data?.attributes ?? []),
          tags: tagsByElement.get(node.id) ?? [],
          color: typeof data?.color === "string" ? data.color : "",
        };
      }),
      relationships: edges.map((edge) => {
        const data = edge.data as { edgeType?: string; label?: string } | undefined;
        return {
          from: edge.source,
          to: edge.target,
          kind: String(edge.type ?? data?.edgeType ?? "association"),
          name: typeof data?.label === "string" ? data.label.trim() : "",
        };
      }),
      editingId: nodePanelOpen ? selectedNodeId : null,
      rules: localModelRules.map((rule) => describeRule(rule, typeName)),
      dirty: isDirty,
    };
  }, [
    activeModelRules,
    edges,
    enabled,
    isDirty,
    localModelRules,
    nodePanelOpen,
    nodes,
    diagramNames,
    metamodelNames,
    projectType,
    selectedNodeId,
    typeMetaById,
    view?.name,
  ]);

  useEffect(() => {
    if (state) dispatchDiagramEvent("tutorial-model-state", { viewId, state });
  }, [state, viewId]);
}
