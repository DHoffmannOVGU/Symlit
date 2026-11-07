import type { NodeAttribute } from "../types";

const ATTRIBUTE_REFERENCE_PREFIX = "attr:";

export interface FormulaReference {
  id?: string;
  name: string;
  start: number;
  end: number;
  missing?: boolean;
}

type Token =
  | { type: "number"; value: number }
  | { type: "operator"; value: "+" | "-" | "*" | "/" }
  | { type: "paren"; value: "(" | ")" }
  | { type: "reference"; value: string };

export interface EvaluatedAttributeResult {
  value: number;
  references: string[];
}

interface ResolvedReference {
  attribute: NodeAttribute;
  displayName: string;
}

const WHITESPACE = /\s/;
type OperatorToken = Extract<Token, { type: "operator" }>;

const isStoredAttributeReference = (value: string) =>
  value.startsWith(ATTRIBUTE_REFERENCE_PREFIX);

const getStoredReferenceValue = (attributeId: string) =>
  `${ATTRIBUTE_REFERENCE_PREFIX}${attributeId}`;

export const formatStoredAttributeReference = (attributeId: string) =>
  `[${getStoredReferenceValue(attributeId)}]`;

export const remapStoredFormulaReferences = (
  formula: string,
  attributeIdMap: Map<string, string>,
) =>
  formula.replace(/\[(attr:[^\]]+)\]/g, (match, rawReference) => {
    if (!isStoredAttributeReference(rawReference)) {
      return match;
    }

    const sourceAttributeId = rawReference.slice(ATTRIBUTE_REFERENCE_PREFIX.length);
    const nextAttributeId = attributeIdMap.get(sourceAttributeId);
    return nextAttributeId ? formatStoredAttributeReference(nextAttributeId) : match;
  });

const tokenizeFormula = (formula: string): Token[] => {
  const tokens: Token[] = [];
  let index = 0;

  while (index < formula.length) {
    const char = formula[index];

    if (WHITESPACE.test(char)) {
      index += 1;
      continue;
    }

    if (char === "[") {
      const closeIndex = formula.indexOf("]", index + 1);
      if (closeIndex === -1) {
        throw new Error("Missing closing ] for attribute reference.");
      }

      const name = formula.slice(index + 1, closeIndex).trim();
      if (!name) {
        throw new Error("Attribute references cannot be empty.");
      }

      tokens.push({ type: "reference", value: name });
      index = closeIndex + 1;
      continue;
    }

    if (char === "+" || char === "-" || char === "*" || char === "/") {
      tokens.push({ type: "operator", value: char });
      index += 1;
      continue;
    }

    if (char === "(" || char === ")") {
      tokens.push({ type: "paren", value: char });
      index += 1;
      continue;
    }

    if (/[0-9.]/.test(char)) {
      let end = index + 1;
      while (end < formula.length && /[0-9.]/.test(formula[end])) {
        end += 1;
      }

      const raw = formula.slice(index, end);
      if (!/^\d+(\.\d+)?$|^\.\d+$/.test(raw)) {
        throw new Error(`Invalid number "${raw}".`);
      }

      tokens.push({ type: "number", value: Number(raw) });
      index = end;
      continue;
    }

    throw new Error(`Unexpected token "${char}".`);
  }

  return tokens;
};

const precedence = (operator: OperatorToken["value"]) =>
  operator === "+" || operator === "-" ? 1 : 2;

const toRpn = (tokens: Token[]) => {
  const output: Token[] = [];
  const operators: Token[] = [];

  tokens.forEach((token, index) => {
    if (token.type === "number" || token.type === "reference") {
      output.push(token);
      return;
    }

    if (token.type === "operator") {
      const prev = tokens[index - 1];
      const isUnaryMinus =
        token.value === "-" &&
        (!prev ||
          prev.type === "operator" ||
          (prev.type === "paren" && prev.value === "("));

      if (isUnaryMinus) {
        output.push({ type: "number", value: 0 });
      }

      while (operators.length > 0) {
        const top = operators[operators.length - 1];
        if (
          top.type === "operator" &&
          precedence(top.value) >= precedence(token.value)
        ) {
          output.push(operators.pop() as Token);
          continue;
        }
        break;
      }
      operators.push(token);
      return;
    }

    if (token.type === "paren" && token.value === "(") {
      operators.push(token);
      return;
    }

    if (token.type === "paren" && token.value === ")") {
      let matched = false;
      while (operators.length > 0) {
        const top = operators.pop() as Token;
        if (top.type === "paren" && top.value === "(") {
          matched = true;
          break;
        }
        output.push(top);
      }

      if (!matched) {
        throw new Error("Mismatched parentheses.");
      }
    }
  });

  while (operators.length > 0) {
    const top = operators.pop() as Token;
    if (top.type === "paren") {
      throw new Error("Mismatched parentheses.");
    }
    output.push(top);
  }

  return output;
};

const buildAttributeNameIndex = (
  attributes: NodeAttribute[],
  currentAttributeId?: string,
) => {
  const attributesByName = new Map<string, NodeAttribute>();
  const duplicateNames = new Set<string>();

  attributes
    .filter((candidate) => candidate.id !== currentAttributeId)
    .forEach((candidate) => {
      const key = candidate.name.trim().toLowerCase();
      if (!key) return;
      if (attributesByName.has(key)) {
        duplicateNames.add(key);
        return;
      }
      attributesByName.set(key, candidate);
    });

  return {
    attributesByName,
    duplicateNames,
  };
};

const resolveReference = (
  rawValue: string,
  attributes: NodeAttribute[],
  currentAttributeId?: string,
): ResolvedReference => {
  const trimmed = rawValue.trim();
  const attributesById = new Map(
    attributes
      .filter((candidate) => candidate.id !== currentAttributeId)
      .map((candidate) => [candidate.id, candidate] as const),
  );

  if (isStoredAttributeReference(trimmed)) {
    const attributeId = trimmed.slice(ATTRIBUTE_REFERENCE_PREFIX.length);
    const attribute = attributesById.get(attributeId);
    if (!attribute) {
      throw new Error("Referenced attribute no longer exists.");
    }

    return {
      attribute,
      displayName: attribute.name || "Untitled",
    };
  }

  const { attributesByName, duplicateNames } = buildAttributeNameIndex(
    attributes,
    currentAttributeId,
  );
  const referenceKey = trimmed.toLowerCase();

  if (duplicateNames.has(referenceKey)) {
    throw new Error(`Attribute reference "${trimmed}" is ambiguous.`);
  }

  const attribute = attributesByName.get(referenceKey);
  if (!attribute) {
    throw new Error(`Unknown attribute "${trimmed}".`);
  }

  return {
    attribute,
    displayName: attribute.name || "Untitled",
  };
};

export const getStoredFormulaFromDisplay = (
  formula: string,
  attributes: NodeAttribute[],
  currentAttributeId?: string,
) => {
  const references = extractFormulaReferences(formula, attributes, currentAttributeId);
  let cursor = 0;
  let nextFormula = "";

  references.forEach((reference) => {
    nextFormula += formula.slice(cursor, reference.start);
    if (reference.id) {
      nextFormula += formatStoredAttributeReference(reference.id);
    } else {
      nextFormula += formula.slice(reference.start, reference.end);
    }
    cursor = reference.end;
  });

  nextFormula += formula.slice(cursor);
  return nextFormula;
};

export const getDisplayFormula = (
  formula: string,
  attributes: NodeAttribute[],
  currentAttributeId?: string,
) => {
  const references = extractFormulaReferences(formula, attributes, currentAttributeId);
  let cursor = 0;
  let nextFormula = "";

  references.forEach((reference) => {
    nextFormula += formula.slice(cursor, reference.start);
    nextFormula += `[${reference.name}]`;
    cursor = reference.end;
  });

  nextFormula += formula.slice(cursor);
  return nextFormula;
};

export const extractFormulaReferences = (
  formula: string,
  attributes: NodeAttribute[] = [],
  currentAttributeId?: string,
): FormulaReference[] => {
  const references: FormulaReference[] = [];
  const matcher = /\[([^\]]+)\]/g;

  let match: RegExpExecArray | null;
  while ((match = matcher.exec(formula)) !== null) {
    const full = match[0];
    const raw = match[1]?.trim();
    const start = match.index ?? -1;
    if (!raw || start < 0) continue;

    if (attributes.length === 0) {
      references.push({
        name: raw,
        start,
        end: start + full.length,
      });
      continue;
    }

    try {
      const resolved = resolveReference(raw, attributes, currentAttributeId);
      references.push({
        id: resolved.attribute.id,
        name: resolved.displayName,
        start,
        end: start + full.length,
      });
    } catch {
      references.push({
        name: isStoredAttributeReference(raw) ? "Missing attribute" : raw,
        start,
        end: start + full.length,
        missing: true,
      });
    }
  }

  return references;
};

export const evaluateDerivedAttribute = (
  attribute: NodeAttribute,
  attributes: NodeAttribute[],
  stack: string[] = [],
): EvaluatedAttributeResult => {
  const formula = attribute.formula?.trim();
  if (!formula) {
    throw new Error("Formula is required.");
  }

  if (stack.includes(attribute.id)) {
    throw new Error("Circular formula reference detected.");
  }

  const tokens = tokenizeFormula(formula);
  if (tokens.length === 0) {
    throw new Error("Formula is required.");
  }

  const rpn = toRpn(tokens);
  const stackValues: number[] = [];
  const references = new Set<string>();

  rpn.forEach((token) => {
    if (token.type === "number") {
      stackValues.push(token.value);
      return;
    }

    if (token.type === "reference") {
      const resolved = resolveReference(token.value, attributes, attribute.id);
      const referenced = resolved.attribute;

      let nextValue: number;
      if (referenced.type === "derived") {
        nextValue = evaluateDerivedAttribute(referenced, attributes, [
          ...stack,
          attribute.id,
        ]).value;
      } else {
        nextValue = Number(referenced.value);
      }

      if (!Number.isFinite(nextValue)) {
        throw new Error(`Attribute "${resolved.displayName}" is not numeric.`);
      }

      stackValues.push(nextValue);
      references.add(resolved.displayName);
      return;
    }

    if (token.type === "operator") {
      const right = stackValues.pop();
      const left = stackValues.pop();
      if (left === undefined || right === undefined) {
        throw new Error("Formula is incomplete.");
      }

      if (token.value === "+") stackValues.push(left + right);
      if (token.value === "-") stackValues.push(left - right);
      if (token.value === "*") stackValues.push(left * right);
      if (token.value === "/") {
        if (right === 0) {
          throw new Error("Division by zero is not allowed.");
        }
        stackValues.push(left / right);
      }
    }
  });

  if (stackValues.length !== 1) {
    throw new Error("Formula is incomplete.");
  }

  return {
    value: stackValues[0],
    references: Array.from(references),
  };
};

export const formatDerivedValue = (value: number) => {
  if (!Number.isFinite(value)) return "";
  if (Number.isInteger(value)) return String(value);
  return Number(value.toFixed(6)).toString();
};
