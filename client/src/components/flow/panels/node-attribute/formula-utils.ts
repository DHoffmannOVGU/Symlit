import { sanitizeAttributeOptions } from "./style-presets";
import { getDisplayFormula } from "@/components/flow/utils/attribute-formula";
import type { NodeAttribute } from "../../types";

/**
 * Re-shape an attribute into a canonical form: ensure list options are
 * sanitized, derived attributes carry a string formula, and number/derived
 * attributes track a unit. Used when adding or editing attributes so the
 * downstream form fields always see well-formed data.
 */
export const normalizeAttribute = (
  attribute: NodeAttribute,
): NodeAttribute => {
  const options =
    attribute.type === "list"
      ? sanitizeAttributeOptions(attribute.options)
      : undefined;
  const nextValue = String(attribute.value ?? "");
  const formula =
    attribute.type === "derived" ? String(attribute.formula ?? "") : undefined;

  return {
    ...attribute,
    value:
      attribute.type === "list" && options?.length
        ? options.includes(nextValue)
          ? nextValue
          : options[0]
        : nextValue,
    unit:
      attribute.type === "number" || attribute.type === "derived"
        ? String(attribute.unit ?? "")
        : "",
    formula,
    options,
  };
};

/**
 * Build the editor-friendly draft strings for every derived attribute. The
 * runtime formula uses opaque `[id]` references; the draft swaps these for the
 * referenced attribute's display label so the user sees something readable.
 */
export const buildFormulaDrafts = (attributes: NodeAttribute[]) =>
  Object.fromEntries(
    attributes
      .filter((attribute) => attribute.type === "derived")
      .map((attribute) => [
        attribute.id,
        getDisplayFormula(attribute.formula ?? "", attributes, attribute.id),
      ]),
  );

/**
 * Recompute formula drafts after the attribute list changes, but preserve any
 * in-flight draft text the user is currently typing for `preserveAttributeId`
 * so we don't clobber unfinished input.
 */
export const syncFormulaDrafts = (
  previousDrafts: Record<string, string>,
  attributes: NodeAttribute[],
  preserveAttributeId?: string,
) => {
  const nextDrafts = buildFormulaDrafts(attributes);
  if (
    preserveAttributeId &&
    previousDrafts[preserveAttributeId] !== undefined &&
    nextDrafts[preserveAttributeId] !== undefined
  ) {
    nextDrafts[preserveAttributeId] = previousDrafts[preserveAttributeId];
  }
  return nextDrafts;
};

export interface FormulaAutocompleteState {
  attrId: string;
  query: string;
  start: number;
  end: number;
  selectedIndex: number;
}

/**
 * Inspect the formula text around the caret. If the caret is inside a
 * `[ ... ]` reference token, returns the open-bracket index, the caret index
 * and the partial query so the autocomplete popover can suggest matches.
 */
export const getFormulaAutocompleteContext = (
  formula: string,
  cursor: number,
) => {
  const safeCursor = Math.max(0, Math.min(cursor, formula.length));
  const beforeCursor = formula.slice(0, safeCursor);
  const openIndex = beforeCursor.lastIndexOf("[");
  if (openIndex === -1) return null;

  const closeIndex = beforeCursor.lastIndexOf("]");
  if (closeIndex > openIndex) return null;

  const query = formula.slice(openIndex + 1, safeCursor);
  if (query.includes("[") || query.includes("]")) return null;

  return {
    query,
    start: openIndex,
    end: safeCursor,
  };
};
