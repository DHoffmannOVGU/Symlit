import { useEffect, useMemo, useRef } from "react";
import { displayRelatedFormula, relatedFormulaContext } from "@shared/related-formula";
import type { ModelRule } from "@shared/schema";
import type { ConditionField, ConditionNode } from "@shared/formula";
import {
  displayRuleCondition,
  literalValue,
  parseRuleCondition,
  printOperand,
  printRuleCondition,
  ruleFromModelCondition,
  type RuleCondition,
  type RuleTextContext,
} from "@shared/rule-text";
import type {
  TutorialAttribute,
  TutorialModelState,
  TutorialRelationship,
  TutorialRule,
  TutorialRuleCondition,
} from "@shared/tutorial";
import { dispatchDiagramEvent, subscribeDiagramEvent } from "@/lib/diagram-events";
import { matchesTypeStyle } from "@/lib/element-style";
import { useView, useViews } from "@/hooks/use-views";
import { useDiagramModel } from "@/components/flow/state/DiagramModelProvider";
import { useDiagramStore } from "@/components/flow/state/DiagramStoreProvider";
import { evaluateModelRuleResults } from "@/components/flow/rules/model-rules";
import { useRuleTextContext } from "@/components/flow/rules/useRuleTextContext";
import type { NodeAttribute, NodeData } from "@/components/flow/types";
import {
  evaluateDerivedAttribute,
  extractFormulaReferences,
  getDisplayFormula,
  recalculateDerivedAttributes,
} from "@/components/flow/utils/attribute-formula";
import { useRelatedCalculation } from "@/components/flow/related/RelatedCalculationProvider";

type TypeName = (typeId: string | undefined) => string;

const fieldOf = (field: ConditionField) => ({
  field: field.kind,
  attribute: field.kind === "attribute" ? field.name : "",
});

/** A rule's comparisons, as the tutorial checks them: groups flattened, by names. */
const describeConditions = (condition: RuleCondition | null, typeName: TypeName): TutorialRuleCondition[] => {
  if (!condition) return [];
  switch (condition.kind) {
    case "and":
    case "or":
      return [...describeConditions(condition.left, typeName), ...describeConditions(condition.right, typeName)];
    case "not":
      return describeConditions(condition.operand, typeName);
    case "compare": {
      const { left, right } = condition;
      // A calculation on the left is reported as its text, with the field "value".
      const field =
        left.kind === "field"
          ? { field: left.field, attribute: "" }
          : left.kind === "value" && left.node.kind === "reference"
            ? { field: "attribute", attribute: left.node.name }
            : { field: "value", attribute: printOperand(left) };
      const value = right ? (literalValue(right) ?? printOperand(right)) : "";
      return [{ about: "self", direction: "", quantifier: "", type: "", ...field, operator: condition.operator, value }];
    }
    case "related": {
      const { selector, where, has } = condition;
      const type =
        where?.kind === "compare" && where.field.kind === "type" && where.operator === "equals"
          ? typeName(where.value.startsWith("type:") ? where.value.slice("type:".length) : where.value)
          : "";
      const base = {
        about: "connected" as const,
        direction: selector.direction === "both" ? "any" : selector.direction,
        quantifier: condition.quantifier,
        type,
      };
      if (!has) return [{ ...base, field: "", attribute: "", operator: "exists", value: "" }];
      const comparisons: Extract<ConditionNode, { kind: "compare" }>[] = [];
      const collect = (node: ConditionNode) => {
        if (node.kind === "compare") comparisons.push(node);
        else {
          collect(node.left);
          collect(node.right);
        }
      };
      collect(has);
      return comparisons.map((comparison) => ({ ...base, ...fieldOf(comparison.field), operator: comparison.operator, value: comparison.value }));
    }
  }
};

const describeRule = (rule: ModelRule, typeName: TypeName, context: RuleTextContext): TutorialRule => {
  let condition: RuleCondition | null = null;
  try {
    // By names, as the steps name attributes.
    condition = parseRuleCondition(displayRuleCondition(ruleConditionText(rule), context, { keepTypes: true }));
  } catch {
    condition = null;
  }
  const conditions = describeConditions(condition, typeName);
  const active = rule.enabled !== false;
  return {
    reportsIssue: active && (rule.outcome ? rule.outcome.kind === "issue" : !!rule.check),
    tag: active && rule.outcome?.kind === "tag" ? rule.outcome.label : "",
    target: typeName(rule.targetType),
    attributes: conditions.map((item) => item.attribute).filter(Boolean),
    connected: conditions.some((item) => item.about === "connected"),
    conditions,
    combinator: condition?.kind === "or" ? "any" : "all",
  };
};

/** A rule's condition as stored text: its text, or its lists for a rule saved before rules had text. */
const ruleConditionText = (rule: ModelRule) =>
  rule.expression ?? (rule.condition ? printRuleCondition(ruleFromModelCondition(rule.condition)) : "");

const describeRelationship = (edge: {
  source: string;
  target: string;
  type?: string;
  data?: unknown;
}): TutorialRelationship => {
  const data = edge.data as { edgeType?: string; label?: string } | undefined;
  return {
    from: edge.source,
    to: edge.target,
    kind: String(edge.type ?? data?.edgeType ?? "association"),
    name: typeof data?.label === "string" ? data.label.trim() : "",
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
      formula: derived
        ? getDisplayFormula(attribute.formula ?? "", attributes, attribute.id)
        : attribute.type === "related"
          ? displayRelatedFormula(attribute.formula ?? "", relatedFormulaContext(null, "", attributes, attribute.id))
          : "",
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
  const nodeTableFilter = useDiagramStore((state) => state.nodeTableFilter);
  const selectedEdgeId = useDiagramStore((state) => state.selectedEdgeId);
  const edgePanelOpen = useDiagramStore((state) => state.edgePanelOpen);
  const { viewId, projectId, projectType, localModelRules, activeModelRules, typeMetaById, referencedMetamodels } =
    useDiagramModel();
  const { ruleGraph } = useRelatedCalculation();
  const ruleContextFor = useRuleTextContext();
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
    // Not before the diagram itself is loaded: its name and its rules come
    // with it, and a step must not be judged on a diagram without its rules.
    if (!view) return null;
    // Nor before the types of the model's metamodels are known: until then
    // elements and rules cannot be told what they are. (When some types
    // resolve and others do not, a type is really missing, and that is reported.)
    const typeIds = nodes
      .map((node) => (node.data as NodeData | undefined)?.typeId)
      .filter((typeId): typeId is string => typeof typeId === "string" && typeId.startsWith("mm:"));
    if (projectType === "instance" && typeIds.length > 0 && !typeIds.some((typeId) => typeMetaById.has(typeId))) {
      return null;
    }
    const typeName: TypeName = (typeId) => {
      if (!typeId || typeId === "all") return "";
      // A rule in a metamodel names one of its types as "node:<element id>".
      const elementId = typeId.startsWith("node:") ? typeId.slice("node:".length) : typeId;
      const label = (nodes.find((node) => node.id === elementId)?.data as NodeData | undefined)?.label;
      return typeMetaById.get(elementId)?.label ?? label ?? typeId;
    };
    // The tags rules give right now, as the cards show them.
    const tagsByElement = new Map<string, string[]>();
    for (const result of evaluateModelRuleResults(activeModelRules, nodes, edges, ruleGraph)) {
      if (result.outcome.kind !== "tag") continue;
      const tags = tagsByElement.get(result.nodeId) ?? [];
      if (!tags.includes(result.outcome.label)) tags.push(result.outcome.label);
      tagsByElement.set(result.nodeId, tags);
    }
    return {
      scope: projectType,
      diagram: view.name ?? "",
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
          ownStyle: projectType === "instance" && !!data?.typeId && !matchesTypeStyle(data as Record<string, unknown>),
        };
      }),
      relationships: edges.map(describeRelationship),
      editingId: nodePanelOpen ? selectedNodeId : null,
      editingRelationship:
        (edgePanelOpen && edges.filter((edge) => edge.id === selectedEdgeId).map(describeRelationship)[0]) || null,
      tableFilter: nodeTableFilter.trim(),
      rules: localModelRules.map((rule) => describeRule(rule, typeName, ruleContextFor(rule.targetType))),
      dirty: isDirty,
    };
  }, [
    activeModelRules,
    edgePanelOpen,
    edges,
    enabled,
    isDirty,
    localModelRules,
    nodePanelOpen,
    nodeTableFilter,
    nodes,
    diagramNames,
    metamodelNames,
    projectType,
    ruleContextFor,
    ruleGraph,
    selectedEdgeId,
    selectedNodeId,
    typeMetaById,
    view,
  ]);

  // Reported when its content changes, not on every render: the page that
  // listens renders again on each report, which would in turn make a new
  // state here. The coach asks for the state when it starts listening.
  const latest = useRef<TutorialModelState | null>(null);
  const reported = useRef("");
  latest.current = state;
  useEffect(() => {
    if (!state) {
      reported.current = "";
      return;
    }
    const content = `${viewId}:${JSON.stringify(state)}`;
    if (content === reported.current) return;
    reported.current = content;
    dispatchDiagramEvent("tutorial-model-state", { viewId, state });
  }, [state, viewId]);
  useEffect(() => {
    if (!enabled) return;
    return subscribeDiagramEvent("tutorial-model-state-request", () => {
      if (latest.current) dispatchDiagramEvent("tutorial-model-state", { viewId, state: latest.current });
    });
  }, [enabled, viewId]);
}
