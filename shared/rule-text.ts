/**
 * The text of a model rule: which elements it looks at, and the condition
 * under which its outcome (a tag or an issue) applies.
 *
 *   for Drone where [range] < 15
 *   for Process where none of incoming "executes"
 *   for Assembly where all of "consists of" have [status] = "released"
 *   for Print job where [price] < [total cost]
 *   for Machine where count(of "consists of") < 2
 *
 * It is the formula language (shared/formula.ts) with conditions on top:
 * both sides of a comparison are values (attributes, numbers, calculations,
 * aggregates over related elements), and a phrase over related elements
 * (`any of`, `all of`, `none of`) checks them with a Related Formula's
 * `where`. The rules panel builds the common cases with lists; both edit the
 * same text, which is what is stored (with attributes, relationships and
 * types by id where a name stands for one of them, so renames are followed).
 */
import type { ModelRuleCondition } from "./contracts";
import {
  AGGREGATE_FUNCTIONS,
  COMPARISON_SYMBOLS,
  FORMULA_FUNCTIONS,
  conditionOperatorText,
  formulaAggregates,
  formulaReader,
  namedSelectors,
  operatorTakesNoValue,
  printCondition,
  printConditionValue,
  printFormula,
  printSelector,
  quoteText,
  scopedReferences,
  tokenizeFormula,
  type ConditionField,
  type ConditionNode,
  type ConditionOperator,
  type FormulaNode,
  type FormulaToken,
  type RelatedSelector,
} from "./formula";

export type RuleQuantifier = "any" | "all" | "none";
export type RuleField = "name" | "description" | "type";

/** One side of a comparison. */
export type RuleOperand =
  /** The element's name, description or type. */
  | { kind: "field"; field: RuleField }
  /** A text in quotes; `start`/`end`: where it stands, quotes included. */
  | { kind: "text"; value: string; start?: number; end?: number }
  | { kind: "truth"; value: string }
  /** A value of the formula language: a number, an attribute, a calculation. */
  | { kind: "value"; node: FormulaNode };

export type RuleCondition =
  | { kind: "and" | "or"; left: RuleCondition; right: RuleCondition }
  | { kind: "not"; operand: RuleCondition }
  /** `right` is null for is set, is not set, is true and is false. */
  | { kind: "compare"; left: RuleOperand; operator: ConditionOperator; right: RuleOperand | null }
  /**
   * `any of "consists of" where type = "Battery" has [capacity] < 100`: of
   * the related elements the selector reaches and `where` keeps, any (all,
   * none) meets `has`. Without `has`, it is about whether there are any.
   * `where` and `has` take one comparison, or several in parentheses: an
   * `and` after them is about the element itself again.
   */
  | {
      kind: "related";
      quantifier: RuleQuantifier;
      selector: RelatedSelector;
      where: ConditionNode | null;
      has: ConditionNode | null;
    };

/** What the rules panel writes for something not chosen yet. */
export const RULE_PLACEHOLDER = "…";

const ATTRIBUTE_PREFIX = "attr:";
const RELATIONSHIP_PREFIX = "rel:";
const TYPE_PREFIX = "type:";

const QUANTIFIER_WORDS: Record<string, RuleQuantifier> = {
  any: "any",
  some: "any",
  all: "all",
  every: "all",
  none: "none",
  no: "none",
};
const FIELD_WORDS = new Set<string>(["name", "description", "type"]);
const TRUTH_WORDS = new Set(["yes", "no", "true", "false"]);
const KNOWN_FUNCTIONS = new Set([...Object.keys(FORMULA_FUNCTIONS), ...AGGREGATE_FUNCTIONS, "average"]);

/**
 * Reads a rule's condition (what follows `where`) into its structure. Empty
 * text is no condition: the rule applies to every element it looks at.
 * Throws an Error that says what is wrong.
 */
export function parseRuleCondition(text: string, options: { placeholders?: boolean } = {}): RuleCondition | null {
  // What the lists have not chosen yet reads only for the lists themselves.
  if (!options.placeholders && text.includes(RULE_PLACEHOLDER)) {
    throw new Error(`The condition is not finished: choose what ${RULE_PLACEHOLDER} stands for.`);
  }
  const tokens = tokenizeFormula(text);
  if (tokens.length === 0) return null;
  const reader = formulaReader(tokens, { aggregates: true });
  const { peek, isWord, isSymbol } = reader;
  const next = () => tokens[reader.position++];
  const written = (token: FormulaToken) => text.slice(token.start, token.end);
  const lower = (token: FormulaToken | undefined) => (token?.type === "name" ? token.value.toLowerCase() : "");
  const startsRelated = () => !!QUANTIFIER_WORDS[lower(peek())] && isWord(peek(1), "of");

  const operand = (): RuleOperand => {
    const token = peek();
    if (!token) throw new Error("The condition is incomplete.");
    const word = lower(token);
    if (FIELD_WORDS.has(word) && !isSymbol(peek(1), "(")) {
      reader.position += 1;
      return { kind: "field", field: word as RuleField };
    }
    if (token.type === "string") {
      reader.position += 1;
      return { kind: "text", value: token.value, start: token.start, end: token.end };
    }
    if (TRUTH_WORDS.has(word)) {
      reader.position += 1;
      return { kind: "truth", value: word };
    }
    if (startsRelated()) throw new Error(`"${token.value} of …" is a condition of its own and cannot be compared.`);
    if (["and", "or", "not", "where", "has", "have", "of"].includes(word)) {
      throw new Error(`Something is missing before "${token.value}".`);
    }
    if (token.type === "name" && !KNOWN_FUNCTIONS.has(word)) {
      throw new Error(`"${token.value}": attributes go in square brackets ([${token.value}]), texts in quotes ("${token.value}").`);
    }
    return { kind: "value", node: reader.expression() };
  };

  const comparison = (): RuleCondition => {
    const left = operand();
    if (isWord(peek(), "is")) {
      reader.position += 1;
      const negated = isWord(peek(), "not");
      if (negated) reader.position += 1;
      const word = next();
      if (isWord(word, "set")) return { kind: "compare", left, operator: negated ? "missing" : "exists", right: null };
      if (!negated && (isWord(word, "true") || isWord(word, "false"))) {
        return { kind: "compare", left, operator: isWord(word, "true") ? "is-true" : "is-false", right: null };
      }
      throw new Error('Write "is set", "is not set", "is true" or "is false".');
    }
    if (isWord(peek(), "contains")) {
      reader.position += 1;
      return { kind: "compare", left, operator: "contains", right: operand() };
    }
    const symbol = peek();
    const operator = symbol?.type === "symbol" ? COMPARISON_SYMBOLS[symbol.value] : undefined;
    if (!operator) {
      throw new Error(
        symbol
          ? `Unexpected "${written(symbol)}": compare with =, !=, <, >, <=, >=, contains, or write is set / is true.`
          : "A condition compares (for example [mass] > 5) or checks (for example [mass] is set).",
      );
    }
    reader.position += 1;
    return { kind: "compare", left, operator, right: operand() };
  };

  const related = (): RuleCondition => {
    const quantifier = QUANTIFIER_WORDS[lower(next())];
    reader.position += 1; // "of"
    const selector = reader.selector();
    let where: ConditionNode | null = null;
    let has: ConditionNode | null = null;
    if (isWord(peek(), "where")) {
      reader.position += 1;
      where = reader.conditionPart();
    }
    if (isWord(peek(), "has") || isWord(peek(), "have")) {
      reader.position += 1;
      has = reader.conditionPart();
    }
    return { kind: "related", quantifier, selector, where, has };
  };

  // After a condition in parentheses: does a comparison go on (then it was a value)?
  const continuesAsValue = (token: FormulaToken | undefined) =>
    !!token &&
    ((token.type === "symbol" && (token.value in COMPARISON_SYMBOLS || "+-*/".includes(token.value))) ||
      isWord(token, "is") ||
      isWord(token, "contains"));

  const atom = (): RuleCondition => {
    if (isSymbol(peek(), "(")) {
      // A condition in parentheses, or a value in parentheses: ([a] + [b]) > 3.
      const start = reader.position;
      let conditionError: unknown = null;
      try {
        reader.position += 1;
        const inner = or();
        if (isSymbol(peek(), ")")) {
          reader.position += 1;
          if (!continuesAsValue(peek())) return inner;
        } else {
          conditionError = new Error("Mismatched parentheses.");
        }
      } catch (error) {
        conditionError = error;
      }
      reader.position = start;
      try {
        return comparison();
      } catch (error) {
        throw conditionError ?? error;
      }
    }
    return startsRelated() ? related() : comparison();
  };
  const unary = (): RuleCondition => {
    if (isWord(peek(), "not")) {
      reader.position += 1;
      return { kind: "not", operand: unary() };
    }
    return atom();
  };
  const and = (): RuleCondition => {
    let node = unary();
    while (isWord(peek(), "and")) {
      reader.position += 1;
      node = { kind: "and", left: node, right: unary() };
    }
    return node;
  };
  const or = (): RuleCondition => {
    let node = and();
    while (isWord(peek(), "or")) {
      reader.position += 1;
      node = { kind: "or", left: node, right: and() };
    }
    return node;
  };

  const condition = or();
  const rest = peek();
  if (rest) {
    if (isSymbol(rest, ")")) throw new Error("Mismatched parentheses.");
    if (isWord(rest, "has") || isWord(rest, "have") || isWord(rest, "where")) {
      throw new Error(
        `"${rest.value}" belongs to a phrase over related elements, such as any of "consists of" ${rest.value} …; several conditions after where or has go in parentheses: where (… and …).`,
      );
    }
    throw new Error(`Unexpected "${written(rest)}": combine conditions with and / or.`);
  }
  return condition;
}

/** One side of a comparison, as written. */
export const printOperand = (operand: RuleOperand) => {
  switch (operand.kind) {
    case "field":
      return operand.field;
    case "text":
      return quoteText(operand.value);
    case "truth":
      return operand.value;
    case "value":
      return printFormula(operand.node);
  }
};

const chainOf = (node: RuleCondition, kind: "and" | "or"): RuleCondition[] =>
  node.kind === kind ? [...chainOf(node.left, kind), ...chainOf(node.right, kind)] : [node];

/** A rule's condition as written (what follows `where`). */
export function printRuleCondition(condition: RuleCondition | null): string {
  if (!condition) return "";
  const part = (condition: ConditionNode) =>
    condition.kind === "compare" ? printCondition(condition) : `(${printCondition(condition)})`;
  const print = (node: RuleCondition, parent: "top" | "and" | "or" | "not"): string => {
    switch (node.kind) {
      case "compare": {
        const operator = conditionOperatorText(node.operator);
        return node.right
          ? `${printOperand(node.left)} ${operator} ${printOperand(node.right)}`
          : `${printOperand(node.left)} ${operator}`;
      }
      case "related": {
        const parts = [`${node.quantifier} of ${printSelector(node.selector)}`];
        if (node.where) parts.push(`where ${part(node.where)}`);
        if (node.has) parts.push(`${node.quantifier === "all" ? "have" : "has"} ${part(node.has)}`);
        return parts.join(" ");
      }
      case "not":
        return `not ${print(node.operand, "not")}`;
      default: {
        const wrap = parent === "not" || (parent === "and" && node.kind === "or");
        const text = chainOf(node, node.kind)
          .map((item) => print(item, node.kind as "and" | "or"))
          .join(` ${node.kind} `);
        return wrap ? `(${text})` : text;
      }
    }
  };
  return print(condition, "top");
}

/** The value a literal operand stands for, as text; null for anything else. */
export function literalValue(operand: RuleOperand | null): string | null {
  if (!operand) return null;
  if (operand.kind === "text" || operand.kind === "truth") return operand.value;
  if (operand.kind !== "value") return null;
  const { node } = operand;
  if (node.kind === "number") return String(node.value);
  if (node.kind === "negate" && node.operand.kind === "number") return String(-node.operand.value);
  return null;
}

/** A value to compare with, from what the lists hold: a number, yes/no, or a text. */
function literalOperand(value: string | undefined): RuleOperand {
  const text = value ?? "";
  if (!text.trim()) return { kind: "text", value: RULE_PLACEHOLDER };
  const printed = printConditionValue(text);
  if (TRUTH_WORDS.has(printed)) return { kind: "truth", value: printed };
  if (printed === text.trim() && /^-?\d/.test(printed)) {
    const number = Number(printed);
    return {
      kind: "value",
      node: number < 0 ? { kind: "negate", operand: { kind: "number", value: -number } } : { kind: "number", value: number },
    };
  }
  return { kind: "text", value: text };
}

// --- The rules panel ----------------------------------------------------

/**
 * One row of the rules panel: about the element itself, or about the
 * elements related to it. The lists can show any condition made of these;
 * anything else is edited as text.
 */
export interface RuleBuilderComparison {
  kind: "comparison";
  source: "self" | "connected";
  /** Related elements: in which direction (any: both). */
  direction?: "any" | "incoming" | "outgoing";
  /** Related elements: by this relationship (its name, or "rel:<id>"); absent: any relationship. */
  relationship?: string;
  quantifier?: RuleQuantifier;
  /** Related elements: only those of this type (a rule target); "all" or absent: any. */
  targetType?: string;
  /** "exists": related elements only need to be there. */
  field: "name" | "description" | "type" | "attribute" | "exists";
  attribute?: string;
  operator: ConditionOperator;
  value?: string;
}

export interface RuleBuilderGroup {
  kind: "group";
  combinator: "all" | "any";
  conditions: Array<RuleBuilderComparison | RuleBuilderGroup>;
}

const fieldOf = (field: RuleBuilderComparison["field"], attribute: string | undefined): ConditionField =>
  field === "attribute"
    ? { kind: "attribute", name: attribute?.trim() || RULE_PLACEHOLDER }
    : { kind: field === "exists" ? "name" : field };

function conditionFromComparison(comparison: RuleBuilderComparison): RuleCondition {
  const right = operatorTakesNoValue(comparison.operator) ? null : literalOperand(comparison.value);
  if (comparison.source === "self") {
    const left: RuleOperand =
      comparison.field === "attribute"
        ? { kind: "value", node: { kind: "reference", name: comparison.attribute?.trim() || RULE_PLACEHOLDER } }
        : { kind: "field", field: comparison.field === "exists" ? "name" : comparison.field };
    return { kind: "compare", left, operator: comparison.operator, right };
  }
  const direction = comparison.direction ?? "any";
  const relationship = comparison.relationship?.trim() || null;
  const selector: RelatedSelector = relationship
    ? { direction: direction === "incoming" ? "incoming" : "outgoing", relationship }
    : { direction: direction === "any" ? "both" : direction, relationship: null };
  const type = comparison.targetType && comparison.targetType !== "all" ? comparison.targetType : null;
  const where: ConditionNode | null = type
    ? { kind: "compare", field: { kind: "type" }, operator: "equals", value: `${TYPE_PREFIX}${type}` }
    : null;
  const has: ConditionNode | null =
    comparison.field === "exists"
      ? null
      : {
          kind: "compare",
          field: fieldOf(comparison.field, comparison.attribute),
          operator: comparison.operator,
          value: operatorTakesNoValue(comparison.operator) ? "" : comparison.value?.trim() ? comparison.value : RULE_PLACEHOLDER,
        };
  return { kind: "related", quantifier: comparison.quantifier ?? "any", selector, where, has };
}

/** The condition the lists of the rules panel show. */
export function ruleFromBuilder(group: RuleBuilderGroup): RuleCondition | null {
  const items = group.conditions
    .map((item) => (item.kind === "group" ? ruleFromBuilder(item) : conditionFromComparison(item)))
    .filter((item): item is RuleCondition => item !== null);
  if (items.length === 0) return null;
  const kind = group.combinator === "all" ? "and" : "or";
  return items.reduce((left, right) => ({ kind, left, right }));
}

/** A condition stored the old way, as the lists' structure. */
export const ruleFromModelCondition = (condition: ModelRuleCondition): RuleCondition | null =>
  condition.kind === "group"
    ? ruleFromBuilder(condition as RuleBuilderGroup)
    : conditionFromComparison(condition as RuleBuilderComparison);

/** What the lists hold for a placeholder: nothing chosen. */
const chosen = (text: string) => (text === RULE_PLACEHOLDER ? "" : text);

function comparisonOf(node: RuleCondition): RuleBuilderComparison | null {
  if (node.kind === "compare") {
    let field: RuleBuilderComparison["field"];
    let attribute: string | undefined;
    if (node.left.kind === "field") field = node.left.field;
    else if (node.left.kind === "value" && node.left.node.kind === "reference") {
      field = "attribute";
      attribute = chosen(node.left.node.name);
    } else return null;
    const literal = node.right ? literalValue(node.right) : "";
    if (literal === null) return null;
    const value = chosen(literal);
    return {
      kind: "comparison",
      source: "self",
      field,
      ...(attribute !== undefined ? { attribute } : {}),
      operator: node.operator,
      ...(node.right ? { value } : {}),
    };
  }
  if (node.kind !== "related") return null;
  const { selector } = node;
  const direction: RuleBuilderComparison["direction"] = selector.direction === "both" ? "any" : selector.direction;
  let targetType = "all";
  if (node.where) {
    const where = node.where;
    if (
      where.kind !== "compare" ||
      where.field.kind !== "type" ||
      where.operator !== "equals" ||
      !where.value.startsWith(TYPE_PREFIX)
    ) {
      return null;
    }
    targetType = where.value.slice(TYPE_PREFIX.length);
  }
  const base: RuleBuilderComparison = {
    kind: "comparison",
    source: "connected",
    direction,
    ...(selector.relationship !== null ? { relationship: selector.relationship } : {}),
    quantifier: node.quantifier,
    targetType,
    field: "exists",
    operator: "exists",
  };
  if (!node.has) return base;
  if (node.has.kind !== "compare") return null;
  const { field, operator, value } = node.has;
  return {
    ...base,
    field: field.kind,
    ...(field.kind === "attribute" ? { attribute: chosen(field.name) } : {}),
    operator,
    ...(operatorTakesNoValue(operator) ? {} : { value: chosen(value) }),
  };
}

/**
 * The lists of the rules panel for a condition, or null when they cannot
 * show it (it is then edited as text): comparisons with a fixed value and
 * phrases over related elements, combined with all or any, one group deep.
 */
export function builderFromRule(condition: RuleCondition | null): RuleBuilderGroup | null {
  if (!condition) return { kind: "group", combinator: "all", conditions: [] };
  const top = condition.kind === "or" ? "or" : "and";
  const inner = top === "and" ? "or" : "and";
  const conditions: RuleBuilderGroup["conditions"] = [];
  for (const item of chainOf(condition, top)) {
    if (item.kind === inner) {
      const children = chainOf(item, inner).map(comparisonOf);
      if (children.some((child) => child === null)) return null;
      conditions.push({ kind: "group", combinator: inner === "and" ? "all" : "any", conditions: children as RuleBuilderComparison[] });
      continue;
    }
    const comparison = comparisonOf(item);
    if (!comparison) return null;
    conditions.push(comparison);
  }
  return { kind: "group", combinator: top === "and" ? "all" : "any", conditions };
}

// --- The whole text: for <type> where <condition> -----------------------

export const ALL_ELEMENTS = "all elements";
const ALL_WORDS = new Set(["all", "all elements", "every element", "everything", "elements", "anything"]);

/** A rule as text: `for <type> where <condition>`; `target` null: all elements. */
export function printRuleText(target: string | null, condition: string): string {
  let name = target === null ? ALL_ELEMENTS : target;
  if (target !== null && (ALL_WORDS.has(target.trim().toLowerCase()) || /\swhere(\s|$)/i.test(target) || /^["“]/.test(target))) {
    name = quoteText(target);
  }
  return condition.trim() ? `for ${name} where ${condition.trim()}` : `for ${name}`;
}

export interface RuleTextParts {
  /** The type's name as written; null: all elements. */
  target: string | null;
  /** What follows `where`. */
  condition: string;
}

/** Splits a rule's text into the type it names and its condition. Throws when the type is missing. */
export function splitRuleText(text: string): RuleTextParts {
  const header = /^\s*for\b\s*/i.exec(text);
  if (!header) {
    // Only a condition: about all elements.
    return { target: null, condition: text.replace(/^\s*where\b\s*/i, "") };
  }
  const rest = text.slice(header[0].length);
  const quoted = /^(["“])([^"”]*)["”]/.exec(rest);
  if (quoted) {
    const after = rest.slice(quoted[0].length);
    const where = /^\s*where\b\s*/i.exec(after);
    if (!where && after.trim()) throw new Error('After the type comes "where" and the condition.');
    return { target: quoted[2].trim(), condition: where ? after.slice(where[0].length) : "" };
  }
  const where = /(^|\s)where\b\s*/i.exec(rest);
  const name = (where ? rest.slice(0, where.index) : rest).trim();
  if (!name) throw new Error("After for comes a type, or all elements.");
  return {
    target: ALL_WORDS.has(name.toLowerCase()) ? null : name,
    condition: where ? rest.slice(where.index + where[0].length) : "",
  };
}

// --- Names and ids --------------------------------------------------------

/** What linking a rule's names to ids needs, and showing them by name again. */
export interface RuleTextContext {
  /**
   * The types a rule can name: their value as a rule's target, and their
   * name. A name stands for a `preferred` one (a type, not an element used
   * as one) before any other.
   */
  types: Array<{ value: string; label: string; preferred?: boolean }>;
  /** The attributes of the elements the rule looks at. */
  ownAttributes: Array<{ id: string; name: string }>;
  /** The attributes of elements they can be related to. */
  relatedAttributes: Array<{ id: string; name: string }>;
  /** The metamodel relationships a name may stand for, in that direction (their ids). */
  relationCandidates: (name: string, direction: RelatedSelector["direction"]) => string[];
  /** A metamodel relationship's name now; undefined when it cannot be found. */
  relationName: (id: string) => string | undefined;
}

interface RuleSpans {
  references: Array<{ name: string; start: number; end: number; scoped: boolean }>;
  selectors: Array<{ relationship: string; direction: RelatedSelector["direction"]; start: number; end: number }>;
  types: Array<{ value: string; start: number; end: number }>;
}

function conditionSpans(condition: ConditionNode | null, spans: RuleSpans) {
  if (!condition) return;
  if (condition.kind !== "compare") {
    conditionSpans(condition.left, spans);
    conditionSpans(condition.right, spans);
    return;
  }
  const { field } = condition;
  if (field.kind === "attribute" && field.start !== undefined && field.end !== undefined) {
    spans.references.push({ name: field.name, start: field.start, end: field.end, scoped: true });
  }
  if (field.kind === "type" && condition.valueStart !== undefined && condition.valueEnd !== undefined) {
    spans.types.push({ value: condition.value, start: condition.valueStart, end: condition.valueEnd });
  }
}

function valueSpans(node: FormulaNode, spans: RuleSpans) {
  for (const reference of scopedReferences(node)) {
    spans.references.push({ name: reference.name, start: reference.start, end: reference.end, scoped: reference.aggregate !== null });
  }
  for (const selector of namedSelectors(node)) spans.selectors.push(selector);
  for (const aggregate of formulaAggregates(node)) {
    const where: RuleSpans = { references: [], selectors: [], types: [] };
    conditionSpans(aggregate.where, where);
    spans.types.push(...where.types);
  }
}

function ruleSpans(condition: RuleCondition | null): RuleSpans {
  const spans: RuleSpans = { references: [], selectors: [], types: [] };
  const visit = (node: RuleCondition) => {
    switch (node.kind) {
      case "and":
      case "or":
        visit(node.left);
        visit(node.right);
        return;
      case "not":
        visit(node.operand);
        return;
      case "related": {
        const { selector } = node;
        if (selector.relationship !== null && selector.start !== undefined && selector.end !== undefined) {
          spans.selectors.push({ relationship: selector.relationship, direction: selector.direction, start: selector.start, end: selector.end });
        }
        conditionSpans(node.where, spans);
        conditionSpans(node.has, spans);
        return;
      }
      case "compare": {
        for (const side of [node.left, node.right]) if (side?.kind === "value") valueSpans(side.node, spans);
        const [field, other] =
          node.left.kind === "field" ? [node.left, node.right] : [node.right, node.left] as const;
        if (field?.kind === "field" && field.field === "type" && other?.kind === "text" && other.start !== undefined && other.end !== undefined) {
          spans.types.push({ value: other.value, start: other.start, end: other.end });
        }
        return;
      }
    }
  };
  if (condition) visit(condition);
  return spans;
}

/** Replaces spans of the text from the last to the first, so earlier positions stay valid. */
function rewrite(text: string, spans: Array<{ start: number; end: number; replacement: string | null }>) {
  let next = text;
  for (const span of [...spans].sort((a, b) => b.start - a.start)) {
    if (span.replacement !== null) next = `${next.slice(0, span.start)}${span.replacement}${next.slice(span.end)}`;
  }
  return next;
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** The one id a name stands for among attributes; null when none or several. */
function linkedAttribute(name: string, attributes: Array<{ id: string; name: string }>): string | null {
  const ids = new Set(attributes.filter((attribute) => sameName(attribute.name, name)).map((attribute) => attribute.id));
  return ids.size === 1 ? Array.from(ids)[0] : null;
}

/** The one type a name stands for; null when none or several. */
export function linkedType(name: string, types: RuleTextContext["types"]): string | null {
  const named = types.filter((type) => sameName(type.label, name));
  const preferred = named.filter((type) => type.preferred);
  const values = new Set((preferred.length > 0 ? preferred : named).map((type) => type.value));
  return values.size === 1 ? Array.from(values)[0] : null;
}

/** A type's name, for a type as a rule names it. */
function ruleTypeName(target: string, types: RuleTextContext["types"]): string | undefined {
  const plain = target.startsWith("node:") ? target.slice("node:".length) : target;
  return (
    types.find((type) => type.value === target) ??
    types.find((type) => type.value === plain || type.value === `node:${plain}`)
  )?.label;
}

/**
 * A rule's condition as written (by names) in the form it is stored: by ids
 * where a name stands for one attribute, relationship or type, so that it
 * follows renames. Text that cannot be read yet is stored as it is.
 */
export function storeRuleCondition(text: string, context: RuleTextContext): string {
  let condition: RuleCondition | null;
  try {
    condition = parseRuleCondition(text);
  } catch {
    return text;
  }
  const spans = ruleSpans(condition);
  return rewrite(text, [
    ...spans.references.map((reference) => {
      if (reference.name.startsWith(ATTRIBUTE_PREFIX)) return { ...reference, replacement: null };
      const id = linkedAttribute(reference.name, reference.scoped ? context.relatedAttributes : context.ownAttributes);
      return { ...reference, replacement: id ? `[${ATTRIBUTE_PREFIX}${id}]` : null };
    }),
    ...spans.selectors.map((selector) => {
      if (selector.relationship.startsWith(RELATIONSHIP_PREFIX)) return { ...selector, replacement: null };
      const ids = new Set(context.relationCandidates(selector.relationship, selector.direction));
      return { ...selector, replacement: ids.size === 1 ? `"${RELATIONSHIP_PREFIX}${Array.from(ids)[0]}"` : null };
    }),
    ...spans.types.map((type) => {
      if (type.value.startsWith(TYPE_PREFIX)) return { ...type, replacement: null };
      const value = linkedType(type.value, context.types);
      return { ...type, replacement: value ? `"${TYPE_PREFIX}${value}"` : null };
    }),
  ]);
}

/**
 * A stored condition as it is shown: attributes, relationships and types by
 * their names now. One that cannot be found is shown as stored, so that
 * nothing is lost.
 */
export function displayRuleCondition(
  stored: string,
  context: RuleTextContext,
  options: { keepTypes?: boolean } = {},
): string {
  const attributeName = (id: string, scoped: boolean | null) => {
    const first = scoped === true ? context.relatedAttributes : context.ownAttributes;
    const second = scoped === true ? context.ownAttributes : context.relatedAttributes;
    return (first.find((attribute) => attribute.id === id) ?? second.find((attribute) => attribute.id === id))?.name;
  };
  const relationship = (id: string) => {
    const name = context.relationName(id);
    return name ? quoteText(name) : null;
  };
  const type = (value: string) => {
    // The rules panel's lists choose types by id: they keep them.
    if (options.keepTypes) return null;
    const name = ruleTypeName(value, context.types);
    return name ? quoteText(name) : null;
  };
  let condition: RuleCondition | null;
  try {
    condition = parseRuleCondition(stored);
  } catch {
    // Not readable: show what can be shown.
    return stored
      .replace(/\[attr:([^\]]+)\]/g, (match, id: string) => {
        const name = attributeName(id, null);
        return name ? `[${name}]` : match;
      })
      .replace(/"rel:([^"]+)"/g, (match, id: string) => relationship(id) ?? match)
      .replace(/"type:([^"]+)"/g, (match, value: string) => type(value) ?? match);
  }
  const spans = ruleSpans(condition);
  return rewrite(stored, [
    ...spans.references.map((reference) => {
      const id = reference.name.startsWith(ATTRIBUTE_PREFIX) ? reference.name.slice(ATTRIBUTE_PREFIX.length) : null;
      const name = id ? attributeName(id, reference.scoped) : undefined;
      return { ...reference, replacement: name ? `[${name}]` : null };
    }),
    ...spans.selectors.map((selector) => ({
      ...selector,
      replacement: selector.relationship.startsWith(RELATIONSHIP_PREFIX)
        ? relationship(selector.relationship.slice(RELATIONSHIP_PREFIX.length))
        : null,
    })),
    ...spans.types.map((span) => ({
      ...span,
      replacement: span.value.startsWith(TYPE_PREFIX) ? type(span.value.slice(TYPE_PREFIX.length)) : null,
    })),
  ]);
}

/**
 * Rewrites the ids a stored condition holds (types, relationships), for a
 * rule that is copied or read from another project.
 */
export function remapRuleIds(
  stored: string,
  map: { type?: (target: string) => string; relationship?: (id: string) => string },
): string {
  let next = stored;
  if (map.type) next = next.replace(/"type:([^"]+)"/g, (_match, value: string) => `"${TYPE_PREFIX}${map.type!(value)}"`);
  if (map.relationship) {
    next = next.replace(/"rel:([^"]+)"/g, (_match, id: string) => `"${RELATIONSHIP_PREFIX}${map.relationship!(id)}"`);
  }
  return next;
}

/** Whether a condition looks at related elements (and so needs the project's relationships). */
export function ruleUsesRelationships(condition: RuleCondition | null): boolean {
  if (!condition) return false;
  switch (condition.kind) {
    case "and":
    case "or":
      return ruleUsesRelationships(condition.left) || ruleUsesRelationships(condition.right);
    case "not":
      return ruleUsesRelationships(condition.operand);
    case "related":
      return true;
    case "compare":
      return [condition.left, condition.right].some((side) => side?.kind === "value" && formulaAggregates(side.node).length > 0);
  }
}
