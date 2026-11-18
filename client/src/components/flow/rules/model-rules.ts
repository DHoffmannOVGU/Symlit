import type { Edge, Node } from "@xyflow/react";
import { graphElementOf, graphRelationshipOf, isOfTargetType, RelatedCalculator, type RelatedGraph } from "@shared/related-formula";
import { ruleConditionOf, ruleHolds } from "@shared/rule-evaluation";
import { remapRuleIds, type RuleCondition } from "@shared/rule-text";
import type {
  ModelRule,
  ModelRuleCondition,
  ModelRuleOutcome,
  ProjectType,
} from "@shared/schema";
import type { NodeData } from "../types";

export type ModelRuleResult = {
  ruleId: string;
  ruleName: string;
  nodeId: string;
  nodeLabel: string;
  outcome: ModelRuleOutcome;
  message: string;
};

export type ModelRuleViolation = ModelRuleResult & {
  severity: "warning" | "error";
};

export type ModelRuleTargetOption = { value: string; label: string };

export const supportsModelRules = (projectType: ProjectType | undefined) =>
  projectType === "metamodel" || projectType === "instance";

const NODE_TARGET_PREFIX = "node:";

export const getModelRuleNodeTarget = (nodeId: string) =>
  `${NODE_TARGET_PREFIX}${nodeId}`;

const canonicalRuleTarget = (target: string | undefined, projectId: number) =>
  target?.startsWith(NODE_TARGET_PREFIX)
    ? `${NODE_TARGET_PREFIX}mm:${projectId}:${target.slice(NODE_TARGET_PREFIX.length)}`
    : target;

const canonicalizeCondition = (condition: ModelRuleCondition, projectId: number): ModelRuleCondition =>
  condition.kind === "group"
    ? { ...condition, conditions: condition.conditions.map((child) => canonicalizeCondition(child, projectId)) } as ModelRuleCondition
    : { ...condition, targetType: canonicalRuleTarget(condition.targetType, projectId) };

export const canonicalizeReferencedModelRule = (
  rule: ModelRule,
  projectId: number,
  viewId: number,
): ModelRule => ({
  ...rule,
  id: `mm:${projectId}:${viewId}:${rule.id}`,
  targetType: canonicalRuleTarget(rule.targetType, projectId) ?? "all",
  condition: rule.condition ? canonicalizeCondition(rule.condition, projectId) : undefined,
  // The types its text names are the metamodel's: as a model refers to them.
  ...(rule.expression !== undefined
    ? { expression: remapRuleIds(rule.expression, { type: (target) => canonicalRuleTarget(target, projectId) ?? target }) }
    : {}),
});

export const getModelRuleTargetOptions = (nodes: Node[]) => {
  const builtInTypes = Array.from(
    new Map(
      nodes.flatMap((node) => {
        const data = node.data as NodeData | undefined;
        if (data?.typeId?.trim()) return [[data.typeId.trim(), data.type?.trim() || data.typeId.trim()] as [string, string]];
        if (data?.type?.trim()) return [[data.type.trim(), data.type.trim()] as [string, string]];
        return [];
      }),
    ).entries(),
  )
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const viewTypes = nodes
    .map((node) => {
      const data = node.data as NodeData | undefined;
      return {
        value: getModelRuleNodeTarget(node.id),
        label: data?.label?.trim() || "Unnamed type",
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));

  return { builtInTypes, viewTypes };
};

/** Whether an element of the diagram is of the type a rule looks at (exactly that type). */
export const nodeMatchesTarget = (node: Node, targetType?: string) => {
  const data = node.data as NodeData | undefined;
  return isOfTargetType({ id: node.id, type: data?.type ?? "", typeId: data?.typeId }, targetType ?? "all");
};

const evaluateLegacyRule = (rule: ModelRule, nodes: Node[], edges: Edge[]): ModelRuleResult[] => {
  if (!rule.check) return [];
  const targets = nodes.filter((node) => nodeMatchesTarget(node, rule.targetType));
  const connectedIds = new Set(edges.flatMap((edge) => [edge.source, edge.target]));
  const duplicateNames = new Set<string>();
  if (rule.check === "duplicate-name") {
    const counts = new Map<string, number>();
    targets.forEach((node) => {
      const name = String((node.data as NodeData | undefined)?.label ?? "").trim().toLocaleLowerCase();
      if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
    });
    counts.forEach((count, name) => { if (count > 1) duplicateNames.add(name); });
  }
  return targets.flatMap((node) => {
    const data = node.data as NodeData | undefined;
    const nodeLabel = data?.label?.trim() || "Unnamed node";
    const failed = rule.check === "missing-name"
      ? !data?.label?.trim()
      : rule.check === "missing-description"
        ? !data?.description?.trim()
        : rule.check === "duplicate-name"
          ? duplicateNames.has(nodeLabel.toLocaleLowerCase())
          : !connectedIds.has(node.id);
    if (!failed) return [];
    const reason = rule.check === "missing-name" ? "has no name"
      : rule.check === "missing-description" ? "has no description"
        : rule.check === "duplicate-name" ? "uses a duplicate name" : "has no connections";
    const outcome: ModelRuleOutcome = { kind: "issue", severity: rule.severity ?? "warning" };
    return [{ ruleId: rule.id, ruleName: rule.name, nodeId: node.id, nodeLabel, outcome, message: `${nodeLabel} ${reason}.` }];
  });
};

/** The graph of the open diagram alone, for when the project's is not known. */
export const diagramGraph = (nodes: Node[], edges: Edge[]): RelatedGraph => ({
  elements: nodes.map(graphElementOf),
  relationships: edges.map((edge) => graphRelationshipOf({ ...edge, edgeType: edge.type })),
});

// One calculator per graph: the views that show rule results evaluate the same graph.
const calculators = new WeakMap<RelatedGraph, RelatedCalculator>();
const calculatorFor = (graph: RelatedGraph) => {
  let calculator = calculators.get(graph);
  if (!calculator) {
    calculator = new RelatedCalculator(graph);
    calculators.set(graph, calculator);
  }
  return calculator;
};

/** A rule's condition, or an Error when its text cannot be read. */
const readRuleCondition = (rule: ModelRule): RuleCondition | null | Error => {
  try {
    return ruleConditionOf(rule);
  } catch (error) {
    return error as Error;
  }
};

/**
 * What the rules give for the open diagram's elements. Their relationships
 * are the project's (`graph`: the saved project with the open diagram as it
 * is now), as Related Formulas see them; without it, the open diagram's.
 */
export function evaluateModelRuleResults(
  rules: ModelRule[],
  nodes: Node[],
  edges: Edge[],
  graph?: RelatedGraph | null,
): ModelRuleResult[] {
  let calculator: RelatedCalculator | null = null;
  const calculate = () => (calculator ??= calculatorFor(graph ?? diagramGraph(nodes, edges)));
  return rules.filter((rule) => rule.enabled).flatMap((rule) => {
    if (rule.check || !rule.outcome) return evaluateLegacyRule(rule, nodes, edges);
    const condition = readRuleCondition(rule);
    // A rule whose text cannot be read gives nothing (the panel says why).
    if (condition instanceof Error) return [];
    return nodes.filter((node) => nodeMatchesTarget(node, rule.targetType)).flatMap((node) => {
      const element = calculate().element(node.id) ?? graphElementOf(node);
      if (!ruleHolds(condition, element, calculate())) return [];
      const data = node.data as NodeData | undefined;
      const nodeLabel = data?.label?.trim() || "Unnamed node";
      const message = rule.outcome!.kind === "tag"
        ? `${nodeLabel} is classified as ${rule.outcome!.label}.`
        : rule.outcome!.message?.trim()
          ? `${nodeLabel}: ${rule.outcome!.message.trim()}`
          : `${nodeLabel} matches this condition.`;
      return [{ ruleId: rule.id, ruleName: rule.name, nodeId: node.id, nodeLabel, outcome: rule.outcome!, message }];
    });
  });
}

export function evaluateModelRules(
  rules: ModelRule[],
  nodes: Node[],
  edges: Edge[],
  graph?: RelatedGraph | null,
): ModelRuleViolation[] {
  return evaluateModelRuleResults(rules, nodes, edges, graph).flatMap((result) =>
    result.outcome.kind === "issue"
      ? [{ ...result, severity: result.outcome.severity }]
      : [],
  );
}

export const MODEL_RULE_CHECK_LABELS: Record<NonNullable<ModelRule["check"]>, string> = {
  "missing-name": "Name is missing",
  "missing-description": "Description is missing",
  "duplicate-name": "Name is duplicated",
  "no-connections": "Element has no relationships",
};

export const MODEL_RULE_OPERATOR_LABELS: Record<Extract<ModelRuleCondition, { kind: "comparison" }>["operator"], string> = {
  exists: "is set",
  missing: "is not set",
  equals: "equals",
  "not-equals": "does not equal",
  contains: "contains",
  "greater-than": "is greater than",
  "greater-than-or-equal": "is at least",
  "less-than": "is less than",
  "less-than-or-equal": "is at most",
  "is-true": "is true",
  "is-false": "is false",
};
