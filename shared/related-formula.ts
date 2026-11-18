/**
 * Related Formulas: attributes calculated over the elements an element is
 * related to, such as `sum([mass] of "consists of")`. Each formula looks one
 * step along its element's relationships. A roll-up over several levels comes
 * from formulas that read the related elements' own calculated attributes.
 *
 * Everything here works on a plain graph of elements and relationships, so
 * the editor (with unsaved changes) and the server (exports) calculate alike.
 */
import { compareValue } from "./value-comparison";
import {
  evaluateFormula,
  FormulaPendingError,
  formulaReferenceNames,
  parseFormula,
  type AggregateNode,
  type ConditionNode,
  type FormulaNode,
  type RelatedSelector,
  scopedReferences,
  type ScopedReference,
} from "./formula";

export interface GraphAttribute {
  id: string;
  name: string;
  type?: string;
  value?: unknown;
  formula?: string;
}

export interface GraphElement {
  id: string;
  name: string;
  /** The name of the element's type, as a `where type = "…"` compares it. */
  type: string;
  attributes: GraphAttribute[];
}

export interface GraphRelationship {
  source: string;
  target: string;
  /** The relationship's name (its label); empty when it has none. */
  name: string;
}

/** A project's elements and the relationships of all its diagrams. */
export interface RelatedGraph {
  elements: GraphElement[];
  relationships: GraphRelationship[];
}

/** The kinds of attribute whose value is calculated, not entered. */
export const isCalculatedAttribute = (attribute: { type?: string }) =>
  attribute.type === "derived" || attribute.type === "related";

const ATTRIBUTE_REFERENCE_PREFIX = "attr:";

/**
 * The attribute a formula's reference names: by its stored id
 * (`attr:<id>`) or by its name, never the attribute the formula belongs to.
 */
export function resolveAttributeReference<A extends GraphAttribute>(
  reference: string,
  attributes: A[],
  currentAttributeId?: string,
): A {
  const trimmed = reference.trim();
  const candidates = attributes.filter((candidate) => candidate.id !== currentAttributeId);
  if (trimmed.startsWith(ATTRIBUTE_REFERENCE_PREFIX)) {
    const found = candidates.find((candidate) => candidate.id === trimmed.slice(ATTRIBUTE_REFERENCE_PREFIX.length));
    if (!found) throw new Error("Referenced attribute no longer exists.");
    return found;
  }
  const key = trimmed.toLowerCase();
  const named = candidates.filter((candidate) => candidate.name.trim().toLowerCase() === key);
  if (named.length > 1) throw new Error(`Attribute reference "${trimmed}" is ambiguous.`);
  if (named.length === 0) throw new Error(`Unknown attribute "${trimmed}".`);
  return named[0];
}

/** A calculated number as it is shown and stored: no trailing float noise. */
export const formatCalculatedValue = (value: number) => {
  if (!Number.isFinite(value)) return "";
  if (Number.isInteger(value)) return String(value);
  return Number(value.toFixed(6)).toString();
};

/** What one aggregate of a formula looked at, for the editor to show. */
export interface AggregateExplanation {
  /** The related elements it counted or took values from. */
  used: string[];
  /** Related elements a `where` left out. */
  leftOut: number;
  /** Related elements without the attribute it adds up. */
  without: number;
}

export interface CalculationResult {
  value: number | null;
  /** Why there is no value: a mistake (error) or something still missing (pending). */
  problem: { message: string; pending: boolean } | null;
  explanations: AggregateExplanation[];
}

type Memo = { value: number } | { error: unknown };

/** Calculates the Derived and Related Formulas of a graph's elements. */
export class RelatedCalculator {
  private readonly elements = new Map<string, GraphElement>();
  private readonly outgoing = new Map<string, GraphRelationship[]>();
  private readonly incoming = new Map<string, GraphRelationship[]>();
  private readonly memo = new Map<string, Memo>();
  private readonly inProgress = new Set<string>();
  private readonly parsed = new Map<string, FormulaNode | Error>();
  /** Set while the attribute being explained is calculated. */
  private explaining: AggregateExplanation[] | null = null;

  constructor(graph: RelatedGraph) {
    for (const element of graph.elements) this.elements.set(element.id, element);
    // The same relationship drawn in several diagrams counts once.
    const seen = new Set<string>();
    for (const relationship of graph.relationships) {
      const key = `${relationship.source}\u0000${relationship.target}\u0000${relationship.name.trim().toLowerCase()}`;
      if (seen.has(key) || relationship.source === relationship.target) continue;
      seen.add(key);
      const out = this.outgoing.get(relationship.source) ?? [];
      out.push(relationship);
      this.outgoing.set(relationship.source, out);
      const into = this.incoming.get(relationship.target) ?? [];
      into.push(relationship);
      this.incoming.set(relationship.target, into);
    }
  }

  /** The elements a selector reaches from an element, each once. */
  related(elementId: string, selector: RelatedSelector): GraphElement[] {
    const wanted = selector.relationship?.trim().toLowerCase() ?? null;
    const matches = (relationship: GraphRelationship) =>
      wanted === null || relationship.name.trim().toLowerCase() === wanted;
    const ids = new Set<string>();
    if (selector.direction !== "incoming") {
      for (const relationship of this.outgoing.get(elementId) ?? []) if (matches(relationship)) ids.add(relationship.target);
    }
    if (selector.direction !== "outgoing") {
      for (const relationship of this.incoming.get(elementId) ?? []) if (matches(relationship)) ids.add(relationship.source);
    }
    return Array.from(ids, (id) => this.elements.get(id)).filter((element): element is GraphElement => !!element);
  }

  /** The value of an attribute of an element: entered, or calculated. Throws when there is none. */
  value(elementId: string, attributeId: string): number {
    const element = this.elements.get(elementId);
    const attribute = element?.attributes.find((candidate) => candidate.id === attributeId);
    if (!element || !attribute) throw new Error("Referenced attribute no longer exists.");
    return this.attributeValue(element, attribute);
  }

  /** The calculated attributes of an element, as stored values ("" where none can be calculated). */
  calculatedValues(elementId: string): Map<string, string> {
    const values = new Map<string, string>();
    const element = this.elements.get(elementId);
    for (const attribute of element?.attributes ?? []) {
      if (!isCalculatedAttribute(attribute)) continue;
      try {
        values.set(attribute.id, formatCalculatedValue(this.attributeValue(element!, attribute)));
      } catch {
        values.set(attribute.id, "");
      }
    }
    return values;
  }

  /** Calculates one attribute and says what its aggregates looked at (for the editor). */
  explain(elementId: string, attributeId: string): CalculationResult {
    const explanations: AggregateExplanation[] = [];
    this.explaining = explanations;
    try {
      // Calculated afresh, so that its aggregates are seen.
      this.memo.delete(this.key(elementId, attributeId));
      return { value: this.value(elementId, attributeId), problem: null, explanations };
    } catch (error) {
      const pending = error instanceof FormulaPendingError;
      return { value: null, problem: { message: (error as Error).message, pending }, explanations };
    } finally {
      this.explaining = null;
    }
  }

  private key(elementId: string, attributeId: string) {
    return `${elementId}\u0000${attributeId}`;
  }

  private parse(formula: string, related: boolean): FormulaNode {
    const cacheKey = `${related ? "r" : "d"}\u0000${formula}`;
    let parsed = this.parsed.get(cacheKey);
    if (!parsed) {
      try {
        parsed = parseFormula(formula, { aggregates: related });
      } catch (error) {
        parsed = error as Error;
      }
      this.parsed.set(cacheKey, parsed);
    }
    if (parsed instanceof Error) throw parsed;
    return parsed;
  }

  private attributeValue(element: GraphElement, attribute: GraphAttribute): number {
    if (!isCalculatedAttribute(attribute)) {
      const raw = attribute.value == null ? "" : String(attribute.value).trim();
      // An empty input is "not known yet", not zero.
      if (raw === "") throw new FormulaPendingError(`"${attribute.name}" of ${element.name || "an element"} has no value yet.`);
      const number = Number(raw);
      if (!Number.isFinite(number)) throw new Error(`Attribute "${attribute.name}" is not numeric.`);
      return number;
    }
    const key = this.key(element.id, attribute.id);
    const known = this.memo.get(key);
    if (known && !this.explaining) {
      if ("value" in known) return known.value;
      throw known.error;
    }
    if (this.inProgress.has(key)) {
      throw new Error(`Circular formula: "${attribute.name}" of ${element.name || "an element"} depends on itself.`);
    }
    // Only the attribute being explained records what its aggregates saw.
    const explaining = this.explaining;
    this.inProgress.add(key);
    try {
      const formula = attribute.formula?.trim();
      if (!formula) throw new Error("Formula is required.");
      const node = this.parse(formula, attribute.type === "related");
      const references = new Map(
        formulaReferenceNames(node).map((name) => [name, resolveAttributeReference(name, element.attributes, attribute.id)]),
      );
      this.explaining = null;
      const value = evaluateFormula(
        node,
        (name) => this.attributeValue(element, references.get(name)!),
        (aggregate) => {
          const result = this.aggregate(element, aggregate);
          explaining?.push(result.explanation);
          return result.value;
        },
      );
      this.memo.set(key, { value });
      return value;
    } catch (error) {
      this.memo.set(key, { error });
      throw error;
    } finally {
      this.inProgress.delete(key);
      this.explaining = explaining;
    }
  }

  private aggregate(element: GraphElement, node: AggregateNode): { value: number; explanation: AggregateExplanation } {
    const related = this.related(element.id, node.selector);
    const matching = node.where ? related.filter((candidate) => this.holds(candidate, node.where!)) : related;
    const explanation: AggregateExplanation = { used: [], leftOut: related.length - matching.length, without: 0 };
    if (node.fn === "count") {
      explanation.used = matching.map((candidate) => candidate.name);
      return { value: matching.length, explanation };
    }
    const values: number[] = [];
    for (const candidate of matching) {
      // A related element without the attribute added up does not take part.
      let references: Map<string, GraphAttribute>;
      try {
        references = new Map(
          formulaReferenceNames(node.value!).map((name) => [name, resolveAttributeReference(name, candidate.attributes)]),
        );
      } catch {
        explanation.without += 1;
        continue;
      }
      values.push(evaluateFormula(node.value!, (name) => this.attributeValue(candidate, references.get(name)!)));
      explanation.used.push(candidate.name);
    }
    if (node.fn === "sum") return { value: values.reduce((total, value) => total + value, 0), explanation };
    if (values.length === 0) {
      throw new FormulaPendingError(
        related.length === 0 ? "There are no related elements yet." : "None of the related elements has a value to take.",
      );
    }
    if (node.fn === "avg") return { value: values.reduce((total, value) => total + value, 0) / values.length, explanation };
    return { value: node.fn === "min" ? Math.min(...values) : Math.max(...values), explanation };
  }

  /** Whether a related element meets a `where`. */
  private holds(candidate: GraphElement, condition: ConditionNode): boolean {
    if (condition.kind !== "compare") {
      return condition.kind === "and"
        ? this.holds(candidate, condition.left) && this.holds(candidate, condition.right)
        : this.holds(candidate, condition.left) || this.holds(candidate, condition.right);
    }
    const { field, operator, value } = condition;
    if (field.kind === "type") return compareValue(candidate.type, operator, value);
    if (field.kind === "name") return compareValue(candidate.name, operator, value);
    let attribute: GraphAttribute;
    try {
      attribute = resolveAttributeReference(field.name, candidate.attributes);
    } catch {
      // Without the attribute, only "is not set" holds, as in model rules.
      return operator === "missing";
    }
    let current: unknown = attribute.value;
    if (isCalculatedAttribute(attribute)) {
      current = formatCalculatedValue(this.attributeValue(candidate, attribute));
    } else if (
      ["less-than", "less-than-or-equal", "greater-than", "greater-than-or-equal"].includes(operator) &&
      String(current ?? "").trim() === ""
    ) {
      // A number compared with nothing is not known yet.
      throw new FormulaPendingError(`"${attribute.name}" of ${candidate.name || "a related element"} has no value yet.`);
    }
    return compareValue(current, operator, value, attribute.type);
  }
}

/** A diagram as stored: its elements (with their data) and its relationships. */
export interface FlowLike {
  id?: number;
  nodes: Array<{ id: string; type?: string | null; data?: unknown }>;
  edges: Array<{ source: string; target: string; data?: unknown }>;
}

export interface ProjectGraphRelationship extends GraphRelationship {
  /** The diagram it is drawn in. */
  viewId?: number;
}

const recordOf = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

/** An element as the calculator sees it, from its stored data. */
export function graphElementOf(node: { id: string; type?: string | null; data?: unknown }): GraphElement {
  const data = recordOf(node.data);
  return {
    id: node.id,
    name: typeof data.label === "string" ? data.label : "",
    type: typeof data.type === "string" ? data.type : (node.type ?? ""),
    attributes: Array.isArray(data.attributes) ? (data.attributes as GraphAttribute[]) : [],
  };
}

/** A relationship's name: its label. */
export const relationshipNameOf = (data: unknown) => {
  const label = recordOf(data).label;
  return typeof label === "string" ? label.trim() : "";
};

/** The graph of a project's diagrams: every element once, every relationship with its diagram. */
export function graphFromFlows(flows: FlowLike[]): { elements: GraphElement[]; relationships: ProjectGraphRelationship[] } {
  const elements = new Map<string, GraphElement>();
  const relationships: ProjectGraphRelationship[] = [];
  for (const flow of flows) {
    for (const node of flow.nodes) if (!elements.has(node.id)) elements.set(node.id, graphElementOf(node));
    for (const edge of flow.edges) {
      relationships.push({ source: edge.source, target: edge.target, name: relationshipNameOf(edge.data), viewId: flow.id });
    }
  }
  return { elements: Array.from(elements.values()), relationships };
}

/** Whether any element of the graph has a Related Formula. */
export const hasRelatedFormulas = (elements: Array<{ attributes: Array<{ type?: string }> }>) =>
  elements.some((element) => element.attributes.some((attribute) => attribute.type === "related"));

/**
 * An element's stored data with the values of its calculated attributes
 * left out. A calculated value follows from everything else (and, for a
 * Related Formula, from other elements), so it must not count as a change of
 * the element: not for unsaved changes, and not for a save conflict.
 */
export function withoutCalculatedValues(data: unknown): unknown {
  const record = recordOf(data);
  if (!Array.isArray(record.attributes) || !record.attributes.some((attribute) => isCalculatedAttribute(recordOf(attribute)))) {
    return data;
  }
  return {
    ...record,
    attributes: record.attributes.map((attribute) =>
      isCalculatedAttribute(recordOf(attribute)) ? { ...recordOf(attribute), value: "" } : attribute,
    ),
  };
}

/**
 * The diagrams with every calculated attribute brought up to date over the
 * whole project, for what leaves the editor (exports). Returns the same
 * flows when the project has no Related Formula.
 */
export function withCalculatedValues<F extends FlowLike>(flows: F[]): F[] {
  const graph = graphFromFlows(flows);
  if (!hasRelatedFormulas(graph.elements)) return flows;
  const calculator = new RelatedCalculator(graph);
  const valuesOf = new Map<string, Map<string, string>>();
  const calculated = (id: string) => {
    let values = valuesOf.get(id);
    if (!values) {
      values = calculator.calculatedValues(id);
      valuesOf.set(id, values);
    }
    return values;
  };
  return flows.map((flow) => ({
    ...flow,
    nodes: flow.nodes.map((node) => {
      const data = recordOf(node.data);
      if (!Array.isArray(data.attributes)) return node;
      const values = calculated(node.id);
      if (values.size === 0) return node;
      return {
        ...node,
        data: {
          ...data,
          attributes: (data.attributes as GraphAttribute[]).map((attribute) =>
            values.has(attribute.id) ? { ...attribute, value: values.get(attribute.id) } : attribute,
          ),
        },
      };
    }),
  }));
}

/**
 * What the editor knows to link a Related Formula's references to
 * attributes, and to show them by name again.
 */
export interface RelatedFormulaContext {
  /** The element's attributes, as edited. */
  attributes: GraphAttribute[];
  /** The attribute the formula belongs to (not a reference target). */
  attributeId?: string;
  /** The attributes of the elements an aggregate relates to; empty when none are known. */
  relatedAttributes: (selector: RelatedSelector) => GraphAttribute[];
  /** An attribute by id anywhere known (other elements, types), to show its name. */
  attributeById: (id: string) => GraphAttribute | undefined;
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const storedId = (name: string) =>
  name.trim().startsWith(ATTRIBUTE_REFERENCE_PREFIX) ? name.trim().slice(ATTRIBUTE_REFERENCE_PREFIX.length) : null;

function referencesOf(formula: string): ScopedReference[] | null {
  try {
    return scopedReferences(parseFormula(formula, { aggregates: true }));
  } catch {
    return null;
  }
}

/** Replaces references from the last to the first, so earlier positions stay valid. */
function rewrite(formula: string, references: ScopedReference[], replace: (reference: ScopedReference) => string | null) {
  let next = formula;
  for (const reference of [...references].sort((a, b) => b.start - a.start)) {
    const replacement = replace(reference);
    if (replacement !== null) next = `${next.slice(0, reference.start)}${replacement}${next.slice(reference.end)}`;
  }
  return next;
}

/**
 * The attribute an aggregate's reference names, when it is one attribute:
 * every related element that has an attribute of that name has it under the
 * same id (they got it from one type, or from a type it specializes).
 */
function linkedRelatedAttribute(name: string, related: GraphAttribute[]): GraphAttribute | null {
  const matching = related.filter((attribute) => sameName(attribute.name, name));
  const ids = new Set(matching.map((attribute) => attribute.id));
  return ids.size === 1 ? matching[0] : null;
}

/**
 * A Related Formula as written (attributes by name) in the form it is
 * stored: references by id where they name one attribute, as in a Derived
 * Formula, so that they follow renames. A reference inside an aggregate
 * whose related elements have separate attributes of that name stays by
 * name. Text that cannot be read yet is stored as it is.
 */
export function storeRelatedFormula(text: string, context: RelatedFormulaContext): string {
  const references = referencesOf(text);
  if (!references) return text;
  return rewrite(text, references, (reference) => {
    if (storedId(reference.name)) return null;
    if (!reference.aggregate) {
      try {
        return `[${ATTRIBUTE_REFERENCE_PREFIX}${resolveAttributeReference(reference.name, context.attributes, context.attributeId).id}]`;
      } catch {
        return null;
      }
    }
    const linked = linkedRelatedAttribute(reference.name, context.relatedAttributes(reference.aggregate.selector));
    return linked ? `[${ATTRIBUTE_REFERENCE_PREFIX}${linked.id}]` : null;
  });
}

/**
 * A stored Related Formula as it is shown: references by the attributes'
 * names now. A reference to an attribute that cannot be found is shown as
 * stored, so that nothing is lost.
 */
export function displayRelatedFormula(stored: string, context: RelatedFormulaContext): string {
  const nameOf = (id: string, reference: ScopedReference | null) => {
    const own = context.attributes.find((attribute) => attribute.id === id && attribute.id !== context.attributeId);
    if (!reference?.aggregate && own) return own.name;
    const related = reference?.aggregate
      ? context.relatedAttributes(reference.aggregate.selector).find((attribute) => attribute.id === id)
      : undefined;
    return (related ?? own ?? context.attributeById(id))?.name ?? null;
  };
  const references = referencesOf(stored);
  if (!references) {
    // Not readable: show what can be shown.
    return stored.replace(/\[(attr:[^\]]+)\]/g, (match, raw: string) => {
      const name = nameOf(raw.slice(ATTRIBUTE_REFERENCE_PREFIX.length), null);
      return name ? `[${name}]` : match;
    });
  }
  return rewrite(stored, references, (reference) => {
    const id = storedId(reference.name);
    if (!id) return null;
    const name = nameOf(id, reference);
    return name ? `[${name}]` : null;
  });
}

/** The references inside aggregates that are by name (not linked), for the editor to point out. */
export function unlinkedRelatedReferences(stored: string): string[] {
  const references = referencesOf(stored) ?? [];
  return Array.from(
    new Set(references.filter((reference) => reference.aggregate && !storedId(reference.name)).map((reference) => reference.name)),
  );
}

/**
 * Gives this element's references new ids (its attributes were copied with
 * new ids). References inside aggregates name the related elements'
 * attributes and keep theirs.
 */
export function remapOwnReferences(formula: string, ids: Map<string, string>): string {
  const references = referencesOf(formula);
  if (!references) {
    return formula.replace(/\[(attr:[^\]]+)\]/g, (match, raw: string) => {
      const next = ids.get(raw.slice(ATTRIBUTE_REFERENCE_PREFIX.length));
      return next ? `[${ATTRIBUTE_REFERENCE_PREFIX}${next}]` : match;
    });
  }
  return rewrite(formula, references, (reference) => {
    const id = storedId(reference.name);
    const next = !reference.aggregate && id ? ids.get(id) : undefined;
    return next ? `[${ATTRIBUTE_REFERENCE_PREFIX}${next}]` : null;
  });
}

/**
 * The context for an element of a graph, with its attributes as edited.
 * `knownAttributes` are attributes outside the graph that a reference may
 * name (the types of the metamodels a model uses).
 */
export function relatedFormulaContext(
  graph: RelatedGraph | null,
  elementId: string,
  attributes: GraphAttribute[],
  attributeId?: string,
  knownAttributes: GraphAttribute[] = [],
): RelatedFormulaContext {
  // Which elements an aggregate reaches. Unlike in a calculation, an element
  // related to itself counts: in a metamodel, "Part consists of Part" is how a
  // roll-up is defined.
  const elements = new Map((graph?.elements ?? []).map((element) => [element.id, element]));
  elements.set(elementId, { id: elementId, name: "", type: "", attributes });
  const reached = (selector: RelatedSelector) => {
    const wanted = selector.relationship?.trim().toLowerCase() ?? null;
    const ids = new Set<string>();
    for (const relationship of graph?.relationships ?? []) {
      if (wanted !== null && relationship.name.trim().toLowerCase() !== wanted) continue;
      if (selector.direction !== "incoming" && relationship.source === elementId) ids.add(relationship.target);
      if (selector.direction !== "outgoing" && relationship.target === elementId) ids.add(relationship.source);
    }
    return Array.from(ids, (id) => elements.get(id)).filter((element): element is GraphElement => !!element);
  };
  const everywhere = new Map<string, GraphAttribute>();
  for (const attribute of knownAttributes) everywhere.set(attribute.id, attribute);
  for (const element of graph?.elements ?? []) {
    for (const attribute of element.attributes) if (!everywhere.has(attribute.id)) everywhere.set(attribute.id, attribute);
  }
  return {
    attributes,
    attributeId,
    relatedAttributes: (selector) => reached(selector).flatMap((element) => element.attributes),
    attributeById: (id) => everywhere.get(id),
  };
}
