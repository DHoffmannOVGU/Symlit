/**
 * Whether a model rule's condition holds for an element. Rules look at the
 * whole project, as Related Formulas do: an element's relationships are
 * those of all diagrams (each once), and calculated attributes are
 * calculated with the same calculator.
 */
import type { ModelRule } from "./contracts";
import { formatCalculatedValue, resolveAttributeReference, typeMatches, type GraphAttribute, type GraphElement, RelatedCalculator } from "./related-formula";
import { literalValue, parseRuleCondition, ruleFromModelCondition, type RuleCondition, type RuleOperand } from "./rule-text";
import { compareValue, type ComparisonOperator } from "./value-comparison";

/**
 * A rule's condition: its text, or (for a rule stored before rules had
 * text) its lists. Null: no condition, the rule applies to every element it
 * looks at. Throws when the text cannot be read.
 */
export function ruleConditionOf(rule: Pick<ModelRule, "expression" | "condition">): RuleCondition | null {
  if (rule.expression !== undefined) return parseRuleCondition(rule.expression);
  return rule.condition ? ruleFromModelCondition(rule.condition) : null;
}

const MIRRORED: Partial<Record<ComparisonOperator, ComparisonOperator>> = {
  "less-than": "greater-than",
  "greater-than": "less-than",
  "less-than-or-equal": "greater-than-or-equal",
  "greater-than-or-equal": "less-than-or-equal",
};

/** A side of a comparison that is a value as entered, not a calculation. */
type Plain =
  | { kind: "literal"; value: string }
  | { kind: "field"; field: "name" | "description" | "type" }
  | { kind: "attribute"; name: string };

const plainOf = (operand: RuleOperand): Plain | null => {
  const literal = literalValue(operand);
  if (literal !== null) return { kind: "literal", value: literal };
  if (operand.kind === "field") return { kind: "field", field: operand.field };
  if (operand.kind === "value" && operand.node.kind === "reference") return { kind: "attribute", name: operand.node.name };
  return null;
};

const attributeOf = (element: GraphElement, name: string): GraphAttribute | null => {
  try {
    return resolveAttributeReference(name, element.attributes);
  } catch {
    return null;
  }
};

/** Compares numbers that come out of calculations. */
function compareNumbers(left: number, operator: ComparisonOperator, right: number): boolean {
  // Calculated values are compared as they are shown: 0.1 + 0.2 = 0.3.
  const a = Number(formatCalculatedValue(left));
  const b = Number(formatCalculatedValue(right));
  switch (operator) {
    case "equals":
      return a === b;
    case "not-equals":
      return a !== b;
    case "less-than":
      return a < b;
    case "less-than-or-equal":
      return a <= b;
    case "greater-than":
      return a > b;
    case "greater-than-or-equal":
      return a >= b;
    default:
      return false;
  }
}

function holdsComparison(
  condition: Extract<RuleCondition, { kind: "compare" }>,
  element: GraphElement,
  calculator: RelatedCalculator,
): boolean {
  const { operator } = condition;
  const left = plainOf(condition.left);
  const right = condition.right ? plainOf(condition.right) : null;
  if (left && (right || !condition.right)) {
    // As entered: compared the way model rules always have (text, numbers, yes/no, lists).
    const flipped = left.kind === "literal" && right && right.kind !== "literal";
    const [subject, other] = flipped ? [right!, left] : [left, right];
    const effective = flipped ? (MIRRORED[operator] ?? operator) : operator;
    const otherValue = (() => {
      if (!other) return undefined;
      if (other.kind === "literal") return other.value;
      if (other.kind === "field") {
        return other.field === "name" ? element.name : other.field === "description" ? (element.description ?? "") : element.type;
      }
      const attribute = attributeOf(element, other.name);
      return attribute ? String(calculator.currentValue(element, attribute) ?? "") : undefined;
    })();
    if (other && otherValue === undefined) return false;
    if (subject.kind === "literal") return compareValue(subject.value, effective, otherValue);
    if (subject.kind === "field") {
      if (subject.field === "type") return typeMatches(element, effective, otherValue ?? "");
      return compareValue(subject.field === "name" ? element.name : (element.description ?? ""), effective, otherValue);
    }
    const attribute = attributeOf(element, subject.name);
    // Without the attribute, only "is not set" holds.
    if (!attribute) return effective === "missing";
    return compareValue(calculator.currentValue(element, attribute), effective, otherValue, attribute.type);
  }
  // A calculation on at least one side: numbers, or a text in quotes.
  const valueOf = (operand: RuleOperand): number | string => {
    if (operand.kind === "value") return calculator.evaluateFor(element, operand.node);
    const literal = literalValue(operand);
    if (literal !== null) return literal;
    const { field } = operand as Extract<RuleOperand, { kind: "field" }>;
    return field === "name" ? element.name : field === "description" ? (element.description ?? "") : element.type;
  };
  let a: number | string;
  try {
    a = valueOf(condition.left);
  } catch {
    // Not calculable: "is not set" holds, nothing else does.
    return operator === "missing";
  }
  if (!condition.right) return operator === "exists";
  let b: number | string;
  try {
    b = valueOf(condition.right);
  } catch {
    return false;
  }
  if (typeof a === "number" && typeof b === "number") return compareNumbers(a, operator, b);
  return compareValue(typeof a === "number" ? formatCalculatedValue(a) : a, operator, typeof b === "number" ? formatCalculatedValue(b) : b);
}

/** Whether a rule's condition holds for an element of the calculator's graph. */
export function ruleHolds(condition: RuleCondition | null, element: GraphElement, calculator: RelatedCalculator): boolean {
  if (!condition) return true;
  switch (condition.kind) {
    case "and":
      return ruleHolds(condition.left, element, calculator) && ruleHolds(condition.right, element, calculator);
    case "or":
      return ruleHolds(condition.left, element, calculator) || ruleHolds(condition.right, element, calculator);
    case "not":
      return !ruleHolds(condition.operand, element, calculator);
    case "compare":
      return holdsComparison(condition, element, calculator);
    case "related": {
      const candidates = calculator.related(element.id, condition.selector);
      const kept = condition.where ? candidates.filter((candidate) => calculator.meets(candidate, condition.where!)) : candidates;
      const matching = condition.has ? kept.filter((candidate) => calculator.meets(candidate, condition.has!)) : kept;
      if (condition.quantifier === "none") return matching.length === 0;
      if (condition.quantifier === "all") return kept.length > 0 && matching.length === kept.length;
      return matching.length > 0;
    }
  }
}
