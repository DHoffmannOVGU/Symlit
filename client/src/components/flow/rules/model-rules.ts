import type { Edge, Node } from "@xyflow/react";
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
});

const getTargetNodeId = (targetType: string) =>
  targetType.startsWith(NODE_TARGET_PREFIX)
    ? targetType.slice(NODE_TARGET_PREFIX.length)
    : null;

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

export const getModelRuleAttributeOptions = (nodes: Node[]) =>
  Array.from(
    new Set(
      nodes.flatMap((node) =>
        ((node.data as NodeData | undefined)?.attributes ?? [])
          .map((attribute) => attribute.name.trim())
          .filter(Boolean),
      ),
    ),
  ).sort((a, b) => a.localeCompare(b));

const nodeMatchesTarget = (node: Node, targetType?: string) => {
  if (!targetType || targetType === "all") return true;
  const targetNodeId = getTargetNodeId(targetType);
  if (targetNodeId !== null) {
    const data = node.data as NodeData | undefined;
    return node.id === targetNodeId || data?.typeId === targetNodeId;
  }
  const data = node.data as NodeData | undefined;
  return data?.type === targetType || data?.typeId === targetType;
};

const getAttribute = (data: NodeData | undefined, name?: string) => {
  const key = name?.trim().toLocaleLowerCase();
  if (!key) return undefined;
  return (data?.attributes ?? []).find(
    (attribute) =>
      attribute.id.toLocaleLowerCase() === key ||
      attribute.name.trim().toLocaleLowerCase() === key,
  );
};

const getFieldValue = (node: Node, condition: Extract<ModelRuleCondition, { kind: "comparison" }>) => {
  const data = node.data as NodeData | undefined;
  if (condition.field === "name") return data?.label;
  if (condition.field === "description") return data?.description;
  if (condition.field === "type") return data?.typeId || data?.type || node.type;
  return getAttribute(data, condition.attribute)?.value;
};

const compare = (rawValue: unknown, condition: Extract<ModelRuleCondition, { kind: "comparison" }>) => {
  const value = rawValue == null ? "" : String(rawValue).trim();
  const expected = condition.value?.trim() ?? "";
  if (condition.field === "attribute" && !condition.attribute?.trim()) return false;
  if (!["exists", "missing", "is-true", "is-false"].includes(condition.operator) && !expected) return false;
  switch (condition.operator) {
    case "exists": return value.length > 0;
    case "missing": return value.length === 0;
    case "equals": return value.toLocaleLowerCase() === expected.toLocaleLowerCase();
    case "not-equals": return value.toLocaleLowerCase() !== expected.toLocaleLowerCase();
    case "contains": return value.toLocaleLowerCase().includes(expected.toLocaleLowerCase());
    case "is-true": return ["true", "yes", "1"].includes(value.toLocaleLowerCase());
    case "is-false": return ["false", "no", "0"].includes(value.toLocaleLowerCase());
    default: {
      const numericValue = Number(value);
      const numericExpected = Number(expected);
      if (!Number.isFinite(numericValue) || !Number.isFinite(numericExpected)) return false;
      if (condition.operator === "greater-than") return numericValue > numericExpected;
      if (condition.operator === "greater-than-or-equal") return numericValue >= numericExpected;
      if (condition.operator === "less-than") return numericValue < numericExpected;
      return numericValue <= numericExpected;
    }
  }
};

type EvaluationContext = { nodes: Node[]; edges: Edge[]; nodeById: Map<string, Node> };

const connectedNodes = (
  node: Node,
  condition: Extract<ModelRuleCondition, { kind: "comparison" }>,
  context: EvaluationContext,
) => {
  const ids = new Set<string>();
  context.edges.forEach((edge) => {
    if ((condition.direction ?? "any") !== "incoming" && edge.source === node.id) ids.add(edge.target);
    if ((condition.direction ?? "any") !== "outgoing" && edge.target === node.id) ids.add(edge.source);
  });
  return Array.from(ids)
    .map((id) => context.nodeById.get(id))
    .filter((candidate): candidate is Node => !!candidate && nodeMatchesTarget(candidate, condition.targetType));
};

const evaluateCondition = (condition: ModelRuleCondition, node: Node, context: EvaluationContext): boolean => {
  if (condition.kind === "group") {
    if (condition.conditions.length === 0) return false;
    return condition.combinator === "all"
      ? condition.conditions.every((child) => evaluateCondition(child, node, context))
      : condition.conditions.some((child) => evaluateCondition(child, node, context));
  }
  if (condition.source === "self") return compare(getFieldValue(node, condition), condition);
  const candidates = connectedNodes(node, condition, context);
  const matches = candidates.filter((candidate) => compare(getFieldValue(candidate, condition), condition));
  if ((condition.quantifier ?? "any") === "none") return matches.length === 0;
  if (condition.quantifier === "all") return candidates.length > 0 && matches.length === candidates.length;
  return matches.length > 0;
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

export function evaluateModelRuleResults(rules: ModelRule[], nodes: Node[], edges: Edge[]): ModelRuleResult[] {
  const context: EvaluationContext = { nodes, edges, nodeById: new Map(nodes.map((node) => [node.id, node])) };
  return rules.filter((rule) => rule.enabled).flatMap((rule) => {
    if (!rule.condition || !rule.outcome) return evaluateLegacyRule(rule, nodes, edges);
    return nodes.filter((node) => nodeMatchesTarget(node, rule.targetType)).flatMap((node) => {
      if (!evaluateCondition(rule.condition!, node, context)) return [];
      const data = node.data as NodeData | undefined;
      const nodeLabel = data?.label?.trim() || "Unnamed node";
      const message = rule.outcome!.kind === "tag"
        ? `${nodeLabel} is classified as ${rule.outcome!.label}.`
        : rule.outcome!.message?.trim() || `${nodeLabel} matches this condition.`;
      return [{ ruleId: rule.id, ruleName: rule.name, nodeId: node.id, nodeLabel, outcome: rule.outcome!, message }];
    });
  });
}

export function evaluateModelRules(rules: ModelRule[], nodes: Node[], edges: Edge[]): ModelRuleViolation[] {
  return evaluateModelRuleResults(rules, nodes, edges).flatMap((result) =>
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

const describeComparison = (condition: Extract<ModelRuleCondition, { kind: "comparison" }>) => {
  const field = condition.field === "attribute" ? condition.attribute || "an attribute" : condition.field;
  const comparison = `${field} ${MODEL_RULE_OPERATOR_LABELS[condition.operator]}${condition.value?.trim() ? ` “${condition.value.trim()}”` : ""}`;
  if (condition.source === "self") return `this object's ${comparison}`;
  const quantifier = condition.quantifier === "all" ? "every" : condition.quantifier === "none" ? "no" : "at least one";
  const direction = condition.direction === "incoming" ? "incoming" : condition.direction === "outgoing" ? "outgoing" : "connected";
  return `${quantifier} ${direction} object has ${comparison}`;
};

export const describeModelRuleCondition = (condition: ModelRuleCondition): string => {
  if (condition.kind === "comparison") return describeComparison(condition);
  const joiner = condition.combinator === "all" ? " and " : " or ";
  return condition.conditions.map((child) => `(${describeModelRuleCondition(child)})`).join(joiner);
};

export const describeModelRule = (rule: ModelRule) => {
  if (rule.condition) return describeModelRuleCondition(rule.condition);
  return rule.check ? MODEL_RULE_CHECK_LABELS[rule.check] : "Incomplete rule";
};
