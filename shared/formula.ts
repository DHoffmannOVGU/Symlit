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
  | { kind: "reference"; name: string }
  | { kind: "negate"; operand: FormulaNode }
  | { kind: "binary"; operator: "+" | "-" | "*" | "/"; left: FormulaNode; right: FormulaNode }
  | { kind: "call"; name: string; args: FormulaNode[] };

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

type Token =
  | { type: "number"; value: number }
  | { type: "reference"; value: string }
  | { type: "name"; value: string }
  | { type: "symbol"; value: "+" | "-" | "*" | "/" | "(" | ")" | "," };

const tokenize = (formula: string): Token[] => {
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
      tokens.push({ type: "reference", value: name });
      index = close + 1;
      continue;
    }
    if ("+-*/(),".includes(char)) {
      tokens.push({ type: "symbol", value: char as "+" });
      index += 1;
      continue;
    }
    if (/[0-9.]/.test(char)) {
      let end = index + 1;
      while (end < formula.length && /[0-9.]/.test(formula[end])) end += 1;
      const raw = formula.slice(index, end);
      if (!/^\d+(\.\d+)?$|^\.\d+$/.test(raw)) throw new Error(`Invalid number "${raw}".`);
      tokens.push({ type: "number", value: Number(raw) });
      index = end;
      continue;
    }
    if (/[A-Za-z_]/.test(char)) {
      let end = index + 1;
      while (end < formula.length && /[A-Za-z0-9_]/.test(formula[end])) end += 1;
      tokens.push({ type: "name", value: formula.slice(index, end) });
      index = end;
      continue;
    }
    throw new Error(`Unexpected token "${char}".`);
  }
  return tokens;
};

/** Reads a formula into its structure. Throws an Error that says what is wrong. */
export function parseFormula(formula: string): FormulaNode {
  const tokens = tokenize(formula);
  if (tokens.length === 0) throw new Error("Formula is required.");
  let position = 0;
  const peek = () => tokens[position];
  const isSymbol = (token: Token | undefined, value: string) => token?.type === "symbol" && token.value === value;

  const primary = (): FormulaNode => {
    const token = tokens[position++];
    if (!token) throw new Error("Formula is incomplete.");
    if (token.type === "number") return { kind: "number", value: token.value };
    if (token.type === "reference") return { kind: "reference", name: token.value };
    if (token.type === "name") {
      const fn = functionNamed(token.value);
      if (!fn) {
        throw new Error(
          `Unknown function "${token.value}". Functions: ${Object.keys(FORMULA_FUNCTIONS).join(", ")}. Attributes go in square brackets.`,
        );
      }
      if (!isSymbol(peek(), "(")) throw new Error(`"${token.value}" needs its values in parentheses: ${fn.signature}.`);
      position += 1;
      const args: FormulaNode[] = [];
      if (!isSymbol(peek(), ")")) {
        args.push(sum());
        while (isSymbol(peek(), ",")) {
          position += 1;
          args.push(sum());
        }
      }
      if (!isSymbol(tokens[position++], ")")) throw new Error("Mismatched parentheses.");
      if (args.length < fn.minArgs || args.length > fn.maxArgs) {
        throw new Error(`${token.value} takes ${fn.signature}.`);
      }
      return { kind: "call", name: token.value.toLowerCase(), args };
    }
    if (isSymbol(token, "(")) {
      const inner = sum();
      if (!isSymbol(tokens[position++], ")")) throw new Error("Mismatched parentheses.");
      return inner;
    }
    if (isSymbol(token, ")")) throw new Error(position === 1 ? "Mismatched parentheses." : "Formula is incomplete.");
    if (isSymbol(token, ",")) throw new Error("A comma only separates the values of a function.");
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

  const node = sum();
  const rest = peek();
  if (rest) {
    if (isSymbol(rest, ")")) throw new Error("Mismatched parentheses.");
    if (isSymbol(rest, ",")) throw new Error("A comma only separates the values of a function.");
    throw new Error("Formula is incomplete.");
  }
  return node;
}

/** The references of a formula, in the order they are written. */
export function formulaReferenceNames(node: FormulaNode): string[] {
  switch (node.kind) {
    case "number":
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

/**
 * Calculates a parsed formula. `valueOf` gives the number for a reference,
 * or throws (an unknown attribute, or a FormulaPendingError for one without
 * a value). Dividing by zero is pending, not an error.
 */
export function evaluateFormula(node: FormulaNode, valueOf: (name: string) => number): number {
  switch (node.kind) {
    case "number":
      return node.value;
    case "reference":
      return valueOf(node.name);
    case "negate":
      return -evaluateFormula(node.operand, valueOf);
    case "binary": {
      const left = evaluateFormula(node.left, valueOf);
      const right = evaluateFormula(node.right, valueOf);
      if (node.operator === "+") return left + right;
      if (node.operator === "-") return left - right;
      if (node.operator === "*") return left * right;
      if (right === 0) throw new FormulaPendingError("Cannot divide by zero.");
      return left / right;
    }
    case "call":
      return functionNamed(node.name)!.apply(node.args.map((arg) => evaluateFormula(arg, valueOf)));
  }
}
