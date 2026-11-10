/*
 * Multiplicities of metamodel relationships.
 *
 * A relationship type "Drone —powered by→ Battery" has one at each end:
 *
 * - `multiplicity` (target end): how many Batteries each Drone needs.
 *   `1..2` = every Drone in a model has one or two "powered by"
 *   relationships to a Battery.
 * - `sourceMultiplicity` (source end): how many Drones each Battery needs.
 *   `0..1` = a Battery powers at most one Drone.
 *
 * Both are counted over the whole project, not one diagram, and a
 * relationship drawn in several diagrams counts once.
 *
 * Accepted forms: `1` (exactly), `0..1`, `1..*`, `2..5`, and `*` (any number,
 * the same as leaving it empty).
 */

export interface Multiplicity {
  min: number;
  /** null means unbounded (`*`). */
  max: number | null;
}

export const MULTIPLICITY_PRESETS = ["0..1", "1", "1..*"] as const;

/** Reads a multiplicity; null when the text is not one. Empty text is "any number". */
export function parseMultiplicity(text: string | null | undefined): Multiplicity | null {
  const value = (text ?? "").replace(/\s+/g, "");
  if (value === "" || value === "*") return { min: 0, max: null };
  const match = /^(\d{1,6})(?:\.\.(\d{1,6}|\*))?$/.exec(value);
  if (!match) return null;
  const min = Number(match[1]);
  const max = match[2] === undefined ? min : match[2] === "*" ? null : Number(match[2]);
  // "0" and "0..0" would forbid the relationship the metamodel just defined.
  if (max !== null && (max < min || max === 0)) return null;
  return { min, max };
}

/** True when the multiplicity restricts nothing (so there is nothing to check). */
export const isUnrestricted = (multiplicity: Multiplicity) =>
  multiplicity.min === 0 && multiplicity.max === null;

/** Canonical spelling: `1`, `0..1`, `1..*`, `*`. */
export function formatMultiplicity({ min, max }: Multiplicity): string {
  if (max === null) return min === 0 ? "*" : `${min}..*`;
  return min === max ? String(min) : `${min}..${max}`;
}

/** In words, for people who do not read UML: "exactly 1", "at least 1", "at most 2", "1 to 2". */
export function describeMultiplicity({ min, max }: Multiplicity): string {
  if (max === null) return min === 0 ? "any number" : `at least ${min}`;
  if (min === max) return `exactly ${min}`;
  if (min === 0) return `at most ${max}`;
  return `${min} to ${max}`;
}

/** Why a text is not a multiplicity, for the input field. */
export const MULTIPLICITY_HELP = "Use a number (1), a range (0..1, 2..5) or an open range (1..*).";

/** The canonical spelling of a multiplicity, or undefined when it is empty, unrestricted or unreadable. */
export function canonicalMultiplicity(text: unknown): string | undefined {
  if (typeof text !== "string") return undefined;
  const parsed = parseMultiplicity(text);
  return parsed && !isUnrestricted(parsed) ? formatMultiplicity(parsed) : undefined;
}
