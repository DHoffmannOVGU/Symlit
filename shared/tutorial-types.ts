/**
 * Guided tutorials: what a tutorial is made of, what it can see of the open
 * diagram, and helpers for writing the checks of its steps. The tutorials
 * themselves are in tutorial-basics.ts and tutorial-ppr.ts; tutorial.ts lists them.
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
] as const;

export type TutorialSignal = (typeof tutorialSignals)[number];

/** Which tutorial project a step happens in. */
export type TutorialScope = "metamodel" | "instance";

// --- what the tutorial can see of the open diagram ---------------------------

export interface TutorialElement {
  id: string;
  name: string;
  /** In a model: the name of the element's type. In a metamodel: its kind. */
  type: string;
  attributes: Array<{ name: string; value: string }>;
}

/** A saved model rule, reduced to what the steps check. */
export interface TutorialRule {
  reportsIssue: boolean;
  /** The name of the type the rule looks at; empty for all elements. */
  target: string;
  /** Attributes its conditions compare. */
  attributes: string[];
  /** It has a condition about the elements a relationship leads to. */
  connected: boolean;
}

/** The open tutorial diagram, reduced to what the steps check. */
export interface TutorialModelState {
  scope: TutorialScope;
  elements: TutorialElement[];
  /** Relationships as element ids, in their direction. */
  relationships: Array<{ from: string; to: string }>;
  /** The element whose editor is open, if any. */
  editingId: string | null;
  /** The saved model rules of this diagram. */
  rules: TutorialRule[];
  /** The diagram has changes that are not saved yet. */
  dirty: boolean;
}

export const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
export const named = (state: TutorialModelState, name: string) =>
  state.elements.filter((element) => same(element.name, name));
export const ofType = (state: TutorialModelState, type: string) =>
  state.elements.filter((element) => same(element.type, type));
export const hasValue = (element: TutorialElement, attribute?: string) =>
  element.attributes.some(
    (candidate) => (!attribute || same(candidate.name, attribute)) && candidate.value.trim() !== "",
  );
export const related = (state: TutorialModelState, from: TutorialElement[], to: TutorialElement[]) =>
  state.relationships.some(
    (relationship) =>
      from.some((element) => element.id === relationship.from) &&
      to.some((element) => element.id === relationship.to),
  );
export const editing = (state: TutorialModelState, name: string) =>
  named(state, name).some((element) => element.id === state.editingId);

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
  /** A feature the learner has to use. */
  signal?: TutorialSignal;
  /** What the model has to show. With a signal, both are needed. */
  check?: (state: TutorialModelState) => boolean;
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
  projects: Record<TutorialScope, string>;
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
