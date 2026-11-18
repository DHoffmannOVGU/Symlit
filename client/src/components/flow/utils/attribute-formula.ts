import {
  evaluateFormula,
  FormulaPendingError,
  formulaReferenceNames,
  parseFormula,
} from "@shared/formula";
import type { NodeAttribute } from "../types";

const ATTRIBUTE_REFERENCE_PREFIX = "attr:";

export interface FormulaReference {
  id?: string;
  name: string;
  start: number;
  end: number;
  missing?: boolean;
}

export interface EvaluatedAttributeResult {
  value: number;
  references: string[];
}

export { FormulaPendingError, isFormulaPending } from "@shared/formula";

interface ResolvedReference {
  attribute: NodeAttribute;
  displayName: string;
}


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

  const parsed = parseFormula(formula);
  // Every reference is resolved before anything is calculated, so a mistake
  // (an unknown attribute) is reported even when another input is still empty.
  const resolved = new Map(
    formulaReferenceNames(parsed).map((name) => [name, resolveReference(name, attributes, attribute.id)] as const),
  );
  const value = evaluateFormula(parsed, (name) => {
    const { attribute: referenced, displayName } = resolved.get(name)!;
    let nextValue: number;
    if (referenced.type === "derived") {
      nextValue = evaluateDerivedAttribute(referenced, attributes, [...stack, attribute.id]).value;
    } else {
      const raw = String(referenced.value ?? "").trim();
      // An empty input is "not known yet", not zero.
      if (raw === "") {
        throw new FormulaPendingError(`"${displayName}" has no value yet.`);
      }
      nextValue = Number(raw);
    }
    if (!Number.isFinite(nextValue)) {
      throw new Error(`Attribute "${displayName}" is not numeric.`);
    }
    return nextValue;
  });

  return {
    value,
    references: Array.from(new Set(Array.from(resolved.values(), (entry) => entry.displayName))),
  };
};

export const formatDerivedValue = (value: number) => {
  if (!Number.isFinite(value)) return "";
  if (Number.isInteger(value)) return String(value);
  return Number(value.toFixed(6)).toString();
};

/**
 * The attributes with every calculated value brought up to date. A formula
 * that cannot give a number (an input is empty, or the formula is broken)
 * leaves its value empty. Returns the same array when nothing changed.
 *
 * The editor does this while it is open; everything that changes an input
 * elsewhere (the table, a new element from a type) has to call it, because
 * the table, model rules and exports read the stored value.
 */
export const recalculateDerivedAttributes = (attributes: NodeAttribute[]): NodeAttribute[] => {
  let changed = false;
  const next = attributes.map((attribute) => {
    if (attribute.type !== "derived") return attribute;
    let value = "";
    try {
      value = formatDerivedValue(evaluateDerivedAttribute(attribute, attributes).value);
    } catch {
      value = "";
    }
    if (value === String(attribute.value ?? "")) return attribute;
    changed = true;
    return { ...attribute, value };
  });
  return changed ? next : attributes;
};
