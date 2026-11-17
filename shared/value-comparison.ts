/**
 * Comparing an attribute's value with a fixed value: what a model rule's
 * condition does, and what the `where` of a Related Formula does. Kept in one
 * place so that the two always agree.
 */
import { parseMultiselectValue } from "./attribute-values";
import type { modelRuleOperatorEnum } from "./contracts";

export type ComparisonOperator = (typeof modelRuleOperatorEnum)[number];

/** Operators that need no value to compare with. */
export const OPERATORS_WITHOUT_VALUE: readonly ComparisonOperator[] = ["exists", "missing", "is-true", "is-false"];

const TRUE_WORDS = ["true", "yes", "1"];
const FALSE_WORDS = ["false", "no", "0"];

/**
 * A multiselect value is compared option by option: equals means "one of
 * them is", contains "one of them contains", is set "at least one is chosen".
 * Numbers compare with no option.
 */
function compareChosen(chosen: string[], operator: ComparisonOperator, expected: string): boolean {
  const options = chosen.map((option) => option.toLocaleLowerCase());
  const wanted = expected.toLocaleLowerCase();
  switch (operator) {
    case "exists":
      return options.length > 0;
    case "missing":
      return options.length === 0;
    case "equals":
      return !!wanted && options.includes(wanted);
    case "not-equals":
      return !!wanted && !options.includes(wanted);
    case "contains":
      return !!wanted && options.some((option) => option.includes(wanted));
    default:
      return false;
  }
}

/**
 * Whether a value satisfies a comparison. `type` is the attribute's kind when
 * the value is an attribute's: a multiselect compares its chosen options, and
 * a Yes/No value equals yes, no, true or false alike.
 */
export function compareValue(
  rawValue: unknown,
  operator: ComparisonOperator,
  rawExpected: string | undefined,
  type?: string,
): boolean {
  const expected = rawExpected?.trim() ?? "";
  if (!OPERATORS_WITHOUT_VALUE.includes(operator) && !expected) return false;
  if (type === "multiselect") return compareChosen(parseMultiselectValue(rawValue), operator, expected);
  const value = rawValue == null ? "" : String(rawValue).trim();
  const lowerValue = value.toLocaleLowerCase();
  const lowerExpected = expected.toLocaleLowerCase();
  // Yes/No: "= yes" and "= true" mean the same.
  const sameTruth =
    type === "boolean" &&
    ((TRUE_WORDS.includes(lowerValue) && TRUE_WORDS.includes(lowerExpected)) ||
      (FALSE_WORDS.includes(lowerValue) && FALSE_WORDS.includes(lowerExpected)));
  switch (operator) {
    case "exists":
      return value.length > 0;
    case "missing":
      return value.length === 0;
    case "equals":
      return sameTruth || lowerValue === lowerExpected;
    case "not-equals":
      return !sameTruth && lowerValue !== lowerExpected;
    case "contains":
      return lowerValue.includes(lowerExpected);
    case "is-true":
      return TRUE_WORDS.includes(lowerValue);
    case "is-false":
      return FALSE_WORDS.includes(lowerValue);
    default: {
      const numericValue = Number(value);
      const numericExpected = Number(expected);
      // An empty value reads as 0 here, as it always has in model rules; the
      // Related Formula treats an empty value as "not calculated yet" before it gets here.
      if (!Number.isFinite(numericValue) || !Number.isFinite(numericExpected)) return false;
      if (operator === "greater-than") return numericValue > numericExpected;
      if (operator === "greater-than-or-equal") return numericValue >= numericExpected;
      if (operator === "less-than") return numericValue < numericExpected;
      return numericValue <= numericExpected;
    }
  }
}
