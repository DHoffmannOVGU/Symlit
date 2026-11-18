/**
 * The formula language of calculated attributes: numbers (with a point:
 * 0.5), references to other attributes in square brackets, + - * /,
 * parentheses, a leading minus, and the functions below. Parsing and
 * evaluating live here, apart from where the referenced values come from, so
 * the editor and the tutorial checks calculate the same way.
 */

/**
 * A formula that is written correctly but cannot give a number yet: one of
 * its inputs has no value, or it would divide by zero. Unlike a mistake in
 * the formula, this is a normal state (a type without default values, an
 * element not filled in yet) and must not stop anyone from saving.
 */
export class FormulaPendingError extends Error {
  readonly pending = true;
}

export const isFormulaPending = (error: unknown): error is FormulaPendingError =>
  error instanceof FormulaPendingError;

export type FormulaNode =
  | { kind: "number"; value: number }
  /** `start`/`end`: where the reference, brackets included, stands in the formula's text. */
  | { kind: "reference"; name: string; start?: number; end?: number }
  | { kind: "negate"; operand: FormulaNode }
  | { kind: "binary"; operator: "+" | "-" | "*" | "/"; left: FormulaNode; right: FormulaNode }
  | { kind: "call"; name: string; args: FormulaNode[] }
  | AggregateNode;

/** The functions that also aggregate over related elements. */
export const AGGREGATE_FUNCTIONS = ["count", "sum", "avg", "min", "max"] as const;
export type AggregateFunction = (typeof AGGREGATE_FUNCTIONS)[number];

/**
 * Which related elements: those a relationship of that name leads to
 * (`of "consists of"`), those it comes from (`of incoming "feeds"`), or all
 * related elements (`of all`, `of all outgoing`, `of all incoming`).
 */
export interface RelatedSelector {
  direction: "outgoing" | "incoming" | "both";
  /** The relationship's name; null for any relationship. */
  relationship: string | null;
  /** Where the relationship's name, quotes included, stands in the formula's text. */
  start?: number;
  end?: number;
}

/** What a `where` compares: an attribute of the related element, its type, name or description. */
export type ConditionField =
  | { kind: "attribute"; name: string; start?: number; end?: number }
  | { kind: "type" }
  | { kind: "name" }
  | { kind: "description" };

/** One of the model rules' operators (shared/value-comparison.ts). */
export type ConditionOperator =
  | "exists"
  | "missing"
  | "equals"
  | "not-equals"
  | "contains"
  | "greater-than"
  | "greater-than-or-equal"
  | "less-than"
  | "less-than-or-equal"
  | "is-true"
  | "is-false";

export type ConditionNode =
  | { kind: "and" | "or"; left: ConditionNode; right: ConditionNode }
  | {
      kind: "compare";
      field: ConditionField;
      operator: ConditionOperator;
      value: string;
      /** Where the value stands in the text, when it is a text in quotes. */
      valueStart?: number;
      valueEnd?: number;
    };

/**
 * `sum([mass] of "consists of" where [status] = "released")`: a value
 * calculated over related elements. In `value` and `where`, attributes are
 * those of each related element.
 */
export interface AggregateNode {
  kind: "aggregate";
  fn: AggregateFunction;
  /** What is added up (not for count), in the related element's terms. */
  value: FormulaNode | null;
  selector: RelatedSelector;
  where: ConditionNode | null;
}

export interface ParseOptions {
  /**
   * Allows values of related elements (`… of "relationship" …`). Only a
   * Related Formula may use them; a Derived Formula sees its own element.
   */
  aggregates?: boolean;
}

export const RELATED_ONLY_MESSAGE =
  'Values of related elements ("… of …") need an attribute of the type Related Formula; a Derived Formula sees only its own element.';

interface FormulaFunction {
  /** How it is written, for the help: `min(a, b, …)`. */
  signature: string;
  description: string;
  minArgs: number;
  maxArgs: number;
  apply: (args: number[]) => number;
}

const ROUNDING_DIGITS_LIMIT = 10;

const roundTo = (value: number, digits: number) => {
  if (!Number.isInteger(digits) || digits < 0 || digits > ROUNDING_DIGITS_LIMIT) {
    throw new Error(`round: the number of decimals must be a whole number from 0 to ${ROUNDING_DIGITS_LIMIT}.`);
  }
  // Half away from zero, as people round by hand (Math.round rounds -2.5 to -2).
  // The decimal point is moved in the number's written form, so that 1.005
  // rounds to 1.01 as written, not to 1.00 as 1.005 * 100 = 100.49999… would.
  const magnitude = Math.abs(value);
  const shifted = Number(`${magnitude}e${digits}`);
  const rounded = Number.isFinite(shifted)
    ? Number(`${Math.round(shifted)}e-${digits}`)
    : Math.round(magnitude * 10 ** digits) / 10 ** digits;
  return Math.sign(value) * rounded;
};

/** The functions a formula can use, by their name in lower case. */
export const FORMULA_FUNCTIONS: Record<string, FormulaFunction> = {
  min: {
    signature: "min(a, b, …)",
    description: "the smallest of the values",
    minArgs: 1,
    maxArgs: Infinity,
    apply: (args) => Math.min(...args),
  },
  max: {
    signature: "max(a, b, …)",
    description: "the largest of the values",
    minArgs: 1,
    maxArgs: Infinity,
    apply: (args) => Math.max(...args),
  },
  sum: {
    signature: "sum(a, b, …)",
    description: "the values added up",
    minArgs: 1,
    maxArgs: Infinity,
    apply: (args) => args.reduce((total, value) => total + value, 0),
  },
  avg: {
    signature: "avg(a, b, …)",
    description: "the average of the values",
    minArgs: 1,
    maxArgs: Infinity,
    apply: (args) => args.reduce((total, value) => total + value, 0) / args.length,
  },
  round: {
    signature: "round(x) or round(x, decimals)",
    description: "rounded to a whole number, or to that many decimals",
    minArgs: 1,
    maxArgs: 2,
    apply: ([value, digits = 0]) => roundTo(value, digits),
  },
  floor: {
    signature: "floor(x)",
    description: "rounded down to a whole number",
    minArgs: 1,
    maxArgs: 1,
    apply: ([value]) => Math.floor(value),
  },
  ceil: {
    signature: "ceil(x)",
    description: "rounded up to a whole number",
    minArgs: 1,
    maxArgs: 1,
    apply: ([value]) => Math.ceil(value),
  },
  abs: {
    signature: "abs(x)",
    description: "the value without its sign",
    minArgs: 1,
    maxArgs: 1,
    apply: ([value]) => Math.abs(value),
  },
  sqrt: {
    signature: "sqrt(x)",
    description: "the square root",
    minArgs: 1,
    maxArgs: 1,
    apply: ([value]) => {
      if (value < 0) throw new Error("sqrt: the value must not be negative.");
      return Math.sqrt(value);
    },
  },
};

/** `average` is accepted for `avg`. */
const FUNCTION_ALIASES: Record<string, string> = { average: "avg" };

const functionNamed = (name: string) => {
  const key = name.toLowerCase();
  return FORMULA_FUNCTIONS[FUNCTION_ALIASES[key] ?? key];
};

type Symbol = "+" | "-" | "*" | "/" | "(" | ")" | "," | "=" | "!=" | "<" | ">" | "<=" | ">=";
/** A word, number, reference, quoted text or symbol of a formula, with where it stands in the text. */
export type FormulaToken = { start: number; end: number } & (
  | { type: "number"; value: number; raw: string }
  | { type: "reference"; value: string }
  | { type: "string"; value: string }
  | { type: "name"; value: string }
  | { type: "symbol"; value: Symbol }
);
type Token = FormulaToken;

const QUOTES: Record<string, string> = { '"': '"', "\u201c": "\u201d", "\u201e": "\u201c" };

/** Splits a formula into its tokens. Throws an Error that says what is wrong. */
export const tokenizeFormula = (formula: string): Token[] => {
  const tokens: Token[] = [];
  let index = 0;
  while (index < formula.length) {
    const char = formula[index];
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }
    if (char === "[") {
      const close = formula.indexOf("]", index + 1);
      if (close === -1) throw new Error("Missing closing ] for attribute reference.");
      const name = formula.slice(index + 1, close).trim();
      if (!name) throw new Error("Attribute references cannot be empty.");
      tokens.push({ type: "reference", value: name, start: index, end: close + 1 });
      index = close + 1;
      continue;
    }
    if (char in QUOTES) {
      // Text in quotes: a relationship's name, or a value to compare with. Typographic quotes count too.
      const close = formula.indexOf(QUOTES[char], index + 1);
      if (close === -1) throw new Error("Missing closing quote.");
      tokens.push({ type: "string", value: formula.slice(index + 1, close), start: index, end: close + 1 });
      index = close + 1;
      continue;
    }
    const two = formula.slice(index, index + 2);
    if (two === "!=" || two === "<=" || two === ">=") {
      tokens.push({ type: "symbol", value: two, start: index, end: index + 2 });
      index += 2;
      continue;
    }
    if ("+-*/(),=<>".includes(char)) {
      tokens.push({ type: "symbol", value: char as Symbol, start: index, end: index + 1 });
      index += 1;
      continue;
    }
    if (/[0-9.]/.test(char)) {
      let end = index + 1;
      while (end < formula.length && /[0-9.]/.test(formula[end])) end += 1;
      const raw = formula.slice(index, end);
      if (!/^\d+(\.\d+)?$|^\.\d+$/.test(raw)) throw new Error(`Invalid number "${raw}".`);
      tokens.push({ type: "number", value: Number(raw), raw, start: index, end });
      index = end;
      continue;
    }
    if (/[A-Za-z_]/.test(char)) {
      let end = index + 1;
      while (end < formula.length && /[A-Za-z0-9_]/.test(formula[end])) end += 1;
      tokens.push({ type: "name", value: formula.slice(index, end), start: index, end });
      index = end;
      continue;
    }
    throw new Error(`Unexpected token "${char}".`);
  }
  return tokens;
};

/** The symbols a condition compares with, and the operator each stands for. */
export const COMPARISON_SYMBOLS: Record<string, ConditionOperator> = {
  "=": "equals",
  "!=": "not-equals",
  "<": "less-than",
  ">": "greater-than",
  "<=": "less-than-or-equal",
  ">=": "greater-than-or-equal",
};

/**
 * Reads formula tokens from a position on. A formula is read whole with
 * parseFormula; a model rule's text reads its values and its conditions
 * over related elements with the same reader, so the two cannot drift apart.
 */
export interface FormulaReader {
  readonly tokens: FormulaToken[];
  /** The next token to read. */
  position: number;
  peek(offset?: number): FormulaToken | undefined;
  isSymbol(token: FormulaToken | undefined, value: string): boolean;
  isWord(token: FormulaToken | undefined, word: string): boolean;
  /** A value: numbers, references, + - * /, functions and (when allowed) aggregates. */
  expression(): FormulaNode;
  /** A condition on an element: what follows `where`. */
  condition(): ConditionNode;
  /** One comparison, or a condition in parentheses. */
  conditionPart(): ConditionNode;
  /** Which related elements: what follows `of`. */
  selector(): RelatedSelector;
}

export function formulaReader(tokens: FormulaToken[], options: ParseOptions = {}): FormulaReader {
  let position = 0;
  const peek = (offset = 0) => tokens[position + offset];
  const isSymbol = (token: Token | undefined, value: string) => token?.type === "symbol" && token.value === value;
  const isWord = (token: Token | undefined, word: string) =>
    token?.type === "name" && token.value.toLowerCase() === word;
  const expectClose = () => {
    if (!isSymbol(tokens[position++], ")")) throw new Error("Mismatched parentheses.");
  };

  const selector = (): RelatedSelector => {
    // "of" was read.
    if (isWord(peek(), "all")) {
      position += 1;
      if (isWord(peek(), "outgoing") || isWord(peek(), "incoming")) {
        const direction = (tokens[position++] as { value: string }).value.toLowerCase() as "outgoing" | "incoming";
        return { direction, relationship: null };
      }
      return { direction: "both", relationship: null };
    }
    let direction: RelatedSelector["direction"] = "outgoing";
    if (isWord(peek(), "incoming") || isWord(peek(), "outgoing")) {
      direction = (tokens[position++] as { value: string }).value.toLowerCase() as "outgoing" | "incoming";
    }
    const name = tokens[position++];
    if (name?.type !== "string" || !name.value.trim()) {
      throw new Error('After "of" comes a relationship\'s name in quotes, for example of "consists of", or all.');
    }
    return { direction, relationship: name.value.trim(), start: name.start, end: name.end };
  };

  const conditionValue = (): { value: string; valueStart?: number; valueEnd?: number } => {
    const token = tokens[position++];
    if (token?.type === "string") return { value: token.value, valueStart: token.start, valueEnd: token.end };
    if (token?.type === "number") return { value: String(token.value) };
    if (isSymbol(token, "-") && peek()?.type === "number") return { value: String(-(tokens[position++] as { value: number }).value) };
    if (token?.type === "name" && ["yes", "no", "true", "false"].includes(token.value.toLowerCase())) {
      return { value: token.value.toLowerCase() };
    }
    throw new Error("A condition compares with a number, a text in quotes, or yes/no.");
  };

  const comparison = (): ConditionNode => {
    const token = tokens[position++];
    let field: ConditionField;
    if (token?.type === "reference") field = { kind: "attribute", name: token.value, start: token.start, end: token.end };
    else if (isWord(token, "type")) field = { kind: "type" };
    else if (isWord(token, "name")) field = { kind: "name" };
    else if (isWord(token, "description")) field = { kind: "description" };
    else throw new Error("A condition starts with an attribute in square brackets, type, name or description.");
    if (isWord(peek(), "is")) {
      position += 1;
      const negated = isWord(peek(), "not");
      if (negated) position += 1;
      const word = tokens[position++];
      if (isWord(word, "set")) return { kind: "compare", field, operator: negated ? "missing" : "exists", value: "" };
      if (!negated && (isWord(word, "true") || isWord(word, "false"))) {
        return { kind: "compare", field, operator: isWord(word, "true") ? "is-true" : "is-false", value: "" };
      }
      throw new Error('Write "is set", "is not set", "is true" or "is false".');
    }
    if (isWord(peek(), "contains")) {
      position += 1;
      return { kind: "compare", field, operator: "contains", ...conditionValue() };
    }
    const symbol = tokens[position++];
    const operator = symbol?.type === "symbol" ? COMPARISON_SYMBOLS[symbol.value] : undefined;
    if (!operator) throw new Error("A condition compares with =, !=, <, >, <=, >=, contains, is set or is true.");
    return { kind: "compare", field, operator, ...conditionValue() };
  };
  const conditionAtom = (): ConditionNode => {
    if (isSymbol(peek(), "(")) {
      position += 1;
      const inner = condition();
      expectClose();
      return inner;
    }
    return comparison();
  };
  const conditionAnd = (): ConditionNode => {
    let node = conditionAtom();
    while (isWord(peek(), "and")) {
      position += 1;
      node = { kind: "and", left: node, right: conditionAtom() };
    }
    return node;
  };
  const condition = (): ConditionNode => {
    let node = conditionAnd();
    while (isWord(peek(), "or")) {
      position += 1;
      node = { kind: "or", left: node, right: conditionAnd() };
    }
    return node;
  };

  /** The rest of an aggregate, from its value (or "of" for count) to the closing parenthesis. */
  const aggregate = (fn: AggregateFunction, value: FormulaNode | null): AggregateNode => {
    if (!options.aggregates) throw new Error(RELATED_ONLY_MESSAGE);
    if (!isWord(tokens[position++], "of")) {
      throw new Error(fn === "count" ? 'count reads count(of "relationship").' : `${fn} over related elements reads ${fn}([attribute] of "relationship").`);
    }
    // One step only: what is added up comes from the related element itself.
    if (value && formulaAggregates(value).length > 0) {
      throw new Error("Inside an aggregate, values come from the related element itself: one step only.");
    }
    const node: AggregateNode = { kind: "aggregate", fn, value, selector: selector(), where: null };
    if (isWord(peek(), "where")) {
      position += 1;
      node.where = condition();
    }
    if (!isSymbol(peek(), ")")) {
      throw new Error(isSymbol(peek(), ",") ? "An aggregate takes one value: sum([attribute] of …)." : "Mismatched parentheses.");
    }
    position += 1;
    return node;
  };

  const primary = (): FormulaNode => {
    const token = tokens[position++];
    if (!token) throw new Error("Formula is incomplete.");
    if (token.type === "number") return { kind: "number", value: token.value };
    if (token.type === "reference") return { kind: "reference", name: token.value, start: token.start, end: token.end };
    if (token.type === "string") throw new Error("Text in quotes only names a relationship or a value in a condition.");
    if (token.type === "name") {
      const lower = token.value.toLowerCase();
      const fnName = FUNCTION_ALIASES[lower] ?? lower;
      const isAggregate = (AGGREGATE_FUNCTIONS as readonly string[]).includes(fnName);
      if (isAggregate && isSymbol(peek(), "(")) {
        const startsWithOf = isWord(peek(1), "of");
        if (fnName === "count" || startsWithOf) {
          position += 1;
          if (fnName !== "count" && startsWithOf) throw new Error(`${fnName} needs a value before "of": ${fnName}([attribute] of …).`);
          return aggregate("count", null);
        }
      }
      const fn = functionNamed(token.value);
      if (!fn && !isAggregate) {
        if (["of", "where", "and", "or", "all", "incoming", "outgoing"].includes(lower)) {
          throw new Error(options.aggregates ? `"${token.value}" belongs inside an aggregate such as sum([attribute] of "relationship").` : RELATED_ONLY_MESSAGE);
        }
        throw new Error(
          `Unknown function "${token.value}". Functions: ${Object.keys(FORMULA_FUNCTIONS).join(", ")}${options.aggregates ? ", count" : ""}. Attributes go in square brackets.`,
        );
      }
      if (!isSymbol(peek(), "(")) {
        throw new Error(`"${token.value}" needs its values in parentheses: ${fn ? fn.signature : `${fnName}([attribute] of "relationship")`}.`);
      }
      position += 1;
      const args: FormulaNode[] = [];
      if (!isSymbol(peek(), ")")) {
        args.push(sum());
        // sum([mass] of "consists of"): the value is followed by "of".
        if (isAggregate && isWord(peek(), "of")) {
          return aggregate(fnName as AggregateFunction, args[0]);
        }
        while (isSymbol(peek(), ",")) {
          position += 1;
          args.push(sum());
        }
      }
      expectClose();
      if (!fn) throw new Error(`${fnName} over related elements reads ${fnName}([attribute] of "relationship").`);
      if (args.length < fn.minArgs || args.length > fn.maxArgs) {
        throw new Error(`${token.value} takes ${fn.signature}.`);
      }
      return { kind: "call", name: fnName, args };
    }
    if (isSymbol(token, "(")) {
      const inner = sum();
      expectClose();
      return inner;
    }
    if (isSymbol(token, ")")) throw new Error(position === 1 ? "Mismatched parentheses." : "Formula is incomplete.");
    if (isSymbol(token, ",")) throw new Error("A comma only separates the values of a function.");
    if (token.value in COMPARISON_SYMBOLS) throw new Error(`"${token.value}" compares values only in a condition after where.`);
    throw new Error("Formula is incomplete.");
  };
  // A minus in front of a value: "-3", "2 * -3", "-[mass]".
  const unary = (): FormulaNode => {
    if (isSymbol(peek(), "-")) {
      position += 1;
      return { kind: "negate", operand: unary() };
    }
    return primary();
  };
  const product = (): FormulaNode => {
    let node = unary();
    while (isSymbol(peek(), "*") || isSymbol(peek(), "/")) {
      const operator = (tokens[position++] as { value: "*" | "/" }).value;
      node = { kind: "binary", operator, left: node, right: unary() };
    }
    return node;
  };
  const sum = (): FormulaNode => {
    let node = product();
    while (isSymbol(peek(), "+") || isSymbol(peek(), "-")) {
      const operator = (tokens[position++] as { value: "+" | "-" }).value;
      node = { kind: "binary", operator, left: node, right: product() };
    }
    return node;
  };

  return {
    tokens,
    get position() {
      return position;
    },
    set position(value: number) {
      position = value;
    },
    peek,
    isSymbol,
    isWord,
    expression: sum,
    condition,
    conditionPart: conditionAtom,
    selector,
  };
}

/** Reads a formula into its structure. Throws an Error that says what is wrong. */
export function parseFormula(formula: string, options: ParseOptions = {}): FormulaNode {
  const tokens = tokenizeFormula(formula);
  if (tokens.length === 0) throw new Error("Formula is required.");
  const reader = formulaReader(tokens, options);
  const node = reader.expression();
  const rest = reader.peek();
  if (rest) {
    if (reader.isSymbol(rest, ")")) throw new Error("Mismatched parentheses.");
    if (reader.isSymbol(rest, ",")) throw new Error("A comma only separates the values of a function.");
    if (rest.type === "symbol" && rest.value in COMPARISON_SYMBOLS) {
      throw new Error(`"${rest.value}" compares values only in a condition after where.`);
    }
    if (reader.isWord(rest, "of") || reader.isWord(rest, "where")) {
      throw new Error(options.aggregates ? `"${rest.value}" belongs inside an aggregate such as sum([attribute] of "relationship").` : RELATED_ONLY_MESSAGE);
    }
    throw new Error("Formula is incomplete.");
  }
  return node;
}

/**
 * The references of a formula to its own element's attributes, in the order
 * they are written. References inside an aggregate are to the related
 * elements' attributes and are not listed.
 */
export function formulaReferenceNames(node: FormulaNode): string[] {
  switch (node.kind) {
    case "number":
    case "aggregate":
      return [];
    case "reference":
      return [node.name];
    case "negate":
      return formulaReferenceNames(node.operand);
    case "binary":
      return [...formulaReferenceNames(node.left), ...formulaReferenceNames(node.right)];
    case "call":
      return node.args.flatMap(formulaReferenceNames);
  }
}

/** The aggregates of a formula, in the order they are written. */
export function formulaAggregates(node: FormulaNode): AggregateNode[] {
  switch (node.kind) {
    case "aggregate":
      return [node];
    case "negate":
      return formulaAggregates(node.operand);
    case "binary":
      return [...formulaAggregates(node.left), ...formulaAggregates(node.right)];
    case "call":
      return node.args.flatMap(formulaAggregates);
    default:
      return [];
  }
}

/**
 * Calculates a parsed formula. `valueOf` gives the number for a reference,
 * or throws (an unknown attribute, or a FormulaPendingError for one without
 * a value). `aggregateOf` calculates an aggregate over related elements; a
 * formula without one never calls it. Dividing by zero is pending, not an error.
 */
export function evaluateFormula(
  node: FormulaNode,
  valueOf: (name: string) => number,
  aggregateOf?: (node: AggregateNode) => number,
): number {
  const evaluate = (current: FormulaNode): number => {
    switch (current.kind) {
      case "number":
        return current.value;
      case "reference":
        return valueOf(current.name);
      case "negate":
        return -evaluate(current.operand);
      case "binary": {
        const left = evaluate(current.left);
        const right = evaluate(current.right);
        if (current.operator === "+") return left + right;
        if (current.operator === "-") return left - right;
        if (current.operator === "*") return left * right;
        if (right === 0) throw new FormulaPendingError("Cannot divide by zero.");
        return left / right;
      }
      case "call":
        return functionNamed(current.name)!.apply(current.args.map(evaluate));
      case "aggregate":
        if (!aggregateOf) throw new Error(RELATED_ONLY_MESSAGE);
        return aggregateOf(current);
    }
  };
  return evaluate(node);
}

/** A reference in a formula's text, and whose attribute it names. */
export interface ScopedReference {
  name: string;
  start: number;
  end: number;
  /** null: this element's attribute; an aggregate: the attribute of the elements it relates to. */
  aggregate: AggregateNode | null;
}

/** Every reference of a parsed formula with where it stands, in the order they are written. */
export function scopedReferences(node: FormulaNode): ScopedReference[] {
  const found: ScopedReference[] = [];
  const visit = (current: FormulaNode, aggregate: AggregateNode | null) => {
    switch (current.kind) {
      case "reference":
        if (current.start !== undefined && current.end !== undefined) {
          found.push({ name: current.name, start: current.start, end: current.end, aggregate });
        }
        return;
      case "negate":
        visit(current.operand, aggregate);
        return;
      case "binary":
        visit(current.left, aggregate);
        visit(current.right, aggregate);
        return;
      case "call":
        current.args.forEach((arg) => visit(arg, aggregate));
        return;
      case "aggregate": {
        if (current.value) visit(current.value, current);
        const conditions = (condition: ConditionNode | null) => {
          if (!condition) return;
          if (condition.kind !== "compare") {
            conditions(condition.left);
            conditions(condition.right);
          } else if (condition.field.kind === "attribute" && condition.field.start !== undefined && condition.field.end !== undefined) {
            found.push({ name: condition.field.name, start: condition.field.start, end: condition.field.end, aggregate: current });
          }
        };
        conditions(current.where);
        return;
      }
      default:
        return;
    }
  };
  visit(node, null);
  return found.sort((a, b) => a.start - b.start);
}

/** The aggregates of a parsed formula that name a relationship, with where its name stands. */
export function namedSelectors(node: FormulaNode): Array<RelatedSelector & { relationship: string; start: number; end: number }> {
  return formulaAggregates(node)
    .map((aggregate) => aggregate.selector)
    .filter(
      (selector): selector is RelatedSelector & { relationship: string; start: number; end: number } =>
        selector.relationship !== null && selector.start !== undefined && selector.end !== undefined,
    )
    .sort((a, b) => a.start - b.start);
}

/** A text in quotes, as a formula writes it: typographic quotes when it holds a straight one. */
export const quoteText = (text: string) => (text.includes('"') ? `“${text}”` : `"${text}"`);

const OPERATOR_TEXT: Record<ConditionOperator, string> = {
  exists: "is set",
  missing: "is not set",
  equals: "=",
  "not-equals": "!=",
  contains: "contains",
  "greater-than": ">",
  "greater-than-or-equal": ">=",
  "less-than": "<",
  "less-than-or-equal": "<=",
  "is-true": "is true",
  "is-false": "is false",
};

/** How an operator is written in a condition. */
export const conditionOperatorText = (operator: ConditionOperator) => OPERATOR_TEXT[operator];

/** Whether a comparison's operator needs no value: is set, is not set, is true, is false. */
export const operatorTakesNoValue = (operator: ConditionOperator) =>
  operator === "exists" || operator === "missing" || operator === "is-true" || operator === "is-false";

/** A value to compare with, as written: a number or yes/no bare, anything else in quotes. */
export function printConditionValue(value: string): string {
  const trimmed = value.trim();
  // Bare only when it reads back as the same text: 0.50 and .5 stay in quotes.
  if (/^-?\d+(\.\d+)?$/.test(trimmed) && String(Number(trimmed)) === trimmed) return trimmed;
  if (["yes", "no", "true", "false"].includes(trimmed.toLowerCase())) return trimmed.toLowerCase();
  return quoteText(value);
}

/** Which related elements, as written after "of". */
export function printSelector(selector: RelatedSelector): string {
  if (selector.relationship === null) return selector.direction === "both" ? "all" : `all ${selector.direction}`;
  const name = quoteText(selector.relationship);
  return selector.direction === "incoming" ? `incoming ${name}` : name;
}

const printField = (field: ConditionField) => (field.kind === "attribute" ? `[${field.name}]` : field.kind);

/** A condition as written; `nested` puts an "or" in parentheses inside an "and". */
export function printCondition(condition: ConditionNode, nested = false): string {
  if (condition.kind === "compare") {
    const operator = OPERATOR_TEXT[condition.operator];
    return operatorTakesNoValue(condition.operator)
      ? `${printField(condition.field)} ${operator}`
      : `${printField(condition.field)} ${operator} ${printConditionValue(condition.value)}`;
  }
  if (condition.kind === "and") return `${printCondition(condition.left, true)} and ${printCondition(condition.right, true)}`;
  const text = `${printCondition(condition.left)} or ${printCondition(condition.right)}`;
  return nested ? `(${text})` : text;
}

const PRECEDENCE: Record<string, number> = { "+": 1, "-": 1, "*": 2, "/": 2 };

/** A formula as written, from its structure. */
export function printFormula(node: FormulaNode): string {
  const print = (current: FormulaNode, context = 0, right = false): string => {
    switch (current.kind) {
      case "number":
        return String(current.value);
      case "reference":
        return `[${current.name}]`;
      case "negate":
        return `-${print(current.operand, 3)}`;
      case "binary": {
        const own = PRECEDENCE[current.operator];
        const text = `${print(current.left, own)} ${current.operator} ${print(current.right, own, true)}`;
        // a - (b - c) and a / (b * c) keep their parentheses.
        return own < context || (right && own === context) ? `(${text})` : text;
      }
      case "call":
        return `${current.name}(${current.args.map((arg) => print(arg)).join(", ")})`;
      case "aggregate": {
        const value = current.value ? `${print(current.value)} ` : "";
        const where = current.where ? ` where ${printCondition(current.where)}` : "";
        return `${current.fn}(${value}of ${printSelector(current.selector)}${where})`;
      }
    }
  };
  return print(node);
}
