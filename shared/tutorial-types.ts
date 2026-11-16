/**
 * Guided tutorials: what a tutorial is made of, what it can see of the open
 * diagram, and helpers for writing the checks of its steps. The tutorials
 * themselves are in the tutorial-*.ts files beside this one; tutorial.ts lists them.
 *
 * A step is done when the model shows its result (`check`), when the learner
 * used a feature (`signal`), or both. Steps never complete on a click alone
 * where the model can show whether the work was done. The didactic reasoning
 * is in docs/ux/TUTORIAL_DIDACTICS.md.
 */

/** Things the app reports while someone works; some steps wait for them. */
export const tutorialSignals = [
  "view-opened",
  "saved",
  "validation-run",
  "validation-passed",
  "rules-opened",
  "table-mode",
  "auto-layout",
  "pattern-saved",
  "pattern-inserted",
  "exported",
  "exported-csv",
] as const;

export type TutorialSignal = (typeof tutorialSignals)[number];

/**
 * Where a step happens: in the tutorial's metamodel, in its model, or on the
 * project list (duplicating, importing, starting from a template).
 */
export type TutorialScope = "metamodel" | "instance" | "projects";

/** The two projects every tutorial has. */
export type TutorialProjectScope = Exclude<TutorialScope, "projects">;

// --- what the tutorial can see of the open diagram ---------------------------

export type TutorialAttributeType = "string" | "number" | "boolean" | "date" | "list" | "derived";

export interface TutorialAttribute {
  name: string;
  /**
   * The value as text. For a calculated attribute it is the result for the
   * element's current values, empty when it cannot be calculated.
   */
  value: string;
  type: TutorialAttributeType;
  unit: string;
  /** A calculated attribute's formula, with the names of what it refers to in [ ]. */
  formula: string;
  /** The names of the attributes a calculated attribute's formula refers to. */
  references: string[];
  /** The choices of a list attribute. */
  options: string[];
}

export interface TutorialElement {
  id: string;
  name: string;
  /** In a model: the name of the element's type. In a metamodel: its kind. */
  type: string;
  attributes: TutorialAttribute[];
  /** The tags model rules currently give this element. */
  tags: string[];
  /** The colour of its card. */
  color: string;
}

export interface TutorialRelationship {
  /** Element ids, in the relationship's direction. */
  from: string;
  to: string;
  /** association, aggregation, composition, generalization, dependency or realization. */
  kind: string;
  /** Its label; empty when it has none. */
  name: string;
}

/** One comparison in a rule's condition. */
export interface TutorialRuleCondition {
  /** About the element itself, or about the elements a relationship leads to. */
  about: "self" | "connected";
  /** For connected elements: any, incoming or outgoing. */
  direction: string;
  /** For connected elements: any ("at least one"), all or none. */
  quantifier: string;
  /** For connected elements: the name of their type; empty for any. */
  type: string;
  /** name, description, type or attribute. */
  field: string;
  /** The attribute's name when the field is an attribute. */
  attribute: string;
  /** exists, missing, equals, less-than, is-true, … */
  operator: string;
  value: string;
}

/** A saved model rule, reduced to what the steps check. */
export interface TutorialRule {
  reportsIssue: boolean;
  /** The label of the tag the rule adds; empty when it reports an issue. */
  tag: string;
  /** The name of the type the rule looks at; empty for all elements. */
  target: string;
  /** Attributes its conditions compare. */
  attributes: string[];
  /** It has a condition about the elements a relationship leads to. */
  connected: boolean;
  /** Its comparisons, groups flattened. */
  conditions: TutorialRuleCondition[];
  /** How the comparisons are combined at the top: all or any. */
  combinator: "all" | "any";
}

/** The open tutorial diagram, reduced to what the steps check. */
export interface TutorialModelState {
  scope: TutorialProjectScope;
  /** The name of the open diagram. */
  diagram: string;
  /** The names of all diagrams of the project. */
  diagrams: string[];
  /** The names of the metamodels an open model uses. */
  metamodels: string[];
  elements: TutorialElement[];
  relationships: TutorialRelationship[];
  /** The element whose editor is open, if any. */
  editingId: string | null;
  /** What the elements table is filtered by; empty when it is not. */
  tableFilter: string;
  /** The saved model rules of this diagram. */
  rules: TutorialRule[];
  /** The diagram has changes that are not saved yet. */
  dirty: boolean;
}

/** A project as the project list knows it. */
export interface TutorialWorkspaceProject {
  id: number;
  name: string;
  kind: "metamodel" | "instance";
  /** The template it was created from, if any. */
  templateId: string | null;
  /** The ids of the metamodels a model uses. */
  metamodels: number[];
  /** It is one of the projects the tutorial created. */
  ofTutorial: boolean;
}

/** What a step on the project list can check. */
export interface TutorialWorkspaceState {
  projects: TutorialWorkspaceProject[];
}

export const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
export const named = (state: TutorialModelState, name: string) =>
  state.elements.filter((element) => same(element.name, name));
export const ofType = (state: TutorialModelState, type: string) =>
  state.elements.filter((element) => same(element.type, type));
/** The attribute of that name, if the element has it. */
export const attributeOf = (element: TutorialElement, name: string) =>
  element.attributes.find((candidate) => same(candidate.name, name));
/**
 * The element has a value for the attribute (for any attribute when no name
 * is given). Yes/No and List attributes always have one, so this says
 * nothing about them.
 */
export const hasValue = (element: TutorialElement, attribute?: string) =>
  element.attributes.some(
    (candidate) => (!attribute || same(candidate.name, attribute)) && candidate.value.trim() !== "",
  );
/** The attribute's value as a number, or null when it has none. */
export const numberOf = (element: TutorialElement, name: string) => {
  const value = attributeOf(element, name)?.value.trim() ?? "";
  return value === "" || !Number.isFinite(Number(value)) ? null : Number(value);
};
/**
 * The attribute is calculated by a formula that refers to all of the given
 * attributes (and may refer to more).
 */
export const calculatedFrom = (element: TutorialElement, name: string, references: string[]) => {
  const attribute = attributeOf(element, name);
  return (
    !!attribute &&
    attribute.type === "derived" &&
    references.every((reference) => attribute.references.some((used) => same(used, reference)))
  );
};
export const tagged = (element: TutorialElement, tag: string) => element.tags.some((label) => same(label, tag));
/** A relationship leads from one of `from` to one of `to`, optionally of a kind and with a name. */
export const related = (
  state: TutorialModelState,
  from: TutorialElement[],
  to: TutorialElement[],
  how: { kind?: string; name?: string } = {},
) =>
  state.relationships.some(
    (relationship) =>
      from.some((element) => element.id === relationship.from) &&
      to.some((element) => element.id === relationship.to) &&
      (how.kind === undefined || same(relationship.kind, how.kind)) &&
      (how.name === undefined || same(relationship.name, how.name)),
  );
export const editing = (state: TutorialModelState, name: string) =>
  named(state, name).some((element) => element.id === state.editingId);
/** The number the rule compares the attribute with, for the given operators. */
export const comparesWith = (rule: TutorialRule, attribute: string, operators: string[]) => {
  const condition = rule.conditions.find(
    (candidate) =>
      candidate.about === "self" &&
      candidate.field === "attribute" &&
      same(candidate.attribute, attribute) &&
      operators.includes(candidate.operator),
  );
  return condition && Number.isFinite(Number(condition.value)) && condition.value.trim() !== ""
    ? Number(condition.value)
    : null;
};

// --- lessons -----------------------------------------------------------------

/** What "Show me" points at: a CSS selector, optionally narrowed to elements containing a text. */
export type TutorialHighlight = string | { selector: string; text: string };

export interface TutorialStep {
  id: string;
  title: string;
  /** What to do. */
  instruction: string;
  /** Extra help shown on demand. */
  hint?: string;
  /** What just happened and why it matters, shown once the step is done. */
  done: string;
  scope: TutorialScope;
  /**
   * The diagram the step happens in, by name, when the project has several.
   * Without it the step counts in any diagram of the project, and the coach
   * opens the first one.
   */
  view?: string;
  /** A feature the learner has to use. */
  signal?: TutorialSignal;
  /** What the model has to show. With a signal, both are needed. */
  check?: (state: TutorialModelState) => boolean;
  /** For a step on the project list: what the list of projects has to show. */
  checkProjects?: (workspace: TutorialWorkspaceState) => boolean;
  /** What "Show me" highlights, tried in order. Without one there is no "Show me". */
  highlight?: TutorialHighlight[];
}

export interface TutorialQuestion {
  prompt: string;
  options: Array<{ text: string; correct?: boolean; feedback: string }>;
}

export interface TutorialLesson {
  id: string;
  title: string;
  /** What the learner can do afterwards: "After this lesson you can …". */
  goal: string;
  /** Why this matters, shown above the steps. */
  why: string;
  steps: TutorialStep[];
  /** One question to look back on the lesson; answering is optional. */
  question?: TutorialQuestion;
}


/** One guided tutorial: two projects created from a template, and lessons that work in them. */
export interface TutorialDefinition {
  /** Short id, used in addresses and test ids. */
  id: string;
  /**
   * The project template both tutorial projects are created from
   * (server/templates/); the project type tells them apart.
   */
  templateId: string;
  title: string;
  /** The question the tutorial model is built to answer. */
  question: string;
  /** The answer, shown at the end once `answerStep` was done. */
  answer: string;
  answerStep: string;
  /** What the learner does, shown before starting. */
  summary: string;
  /** What should be known before, if anything. */
  prerequisite?: string;
  /** Rough duration in minutes. */
  minutes: number;
  /** How the two projects are called in the coach. */
  projects: Record<TutorialProjectScope, string>;
  /** Heading of the last screen when nothing was skipped. */
  finishedTitle: string;
  lessons: TutorialLesson[];
  /** Related things the tutorial leaves out, named on its last screen. */
  notCovered: string[];
}

/** Selectors of controls that several tutorials point at. */
export const ELEMENT_CARD = ".react-flow__node";
export const SAVE_DIAGRAM = '[data-testid="button-save-diagram-header"]';
export const VALIDATE = '[data-testid="button-toolbar-validate"]';
