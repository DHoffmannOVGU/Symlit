/**
 * The guided tutorial: lesson definitions (shared by client and server) and
 * the rules for when a step counts as done.
 *
 * The tutorial creates a metamodel ("Drone types") and an instance model
 * ("Delivery drone") that uses it (server/templates/tutorial.json), and
 * follows the real Symlit workflow with one question in mind: can the drone
 * fly the city route? The didactic reasoning is in docs/ux/TUTORIAL_DIDACTICS.md.
 *
 * A step is done when the model shows its result (`check`), when the learner
 * used a feature (`signal`), or both. Steps never complete on a click alone
 * where the model can show whether the work was done.
 */

/**
 * The project template both tutorial projects are created from
 * (server/templates/tutorial.json); the project type tells them apart.
 */
export const TUTORIAL_TEMPLATE = "tutorial";

export const isTutorialTemplate = (templateId: string | null | undefined) =>
  templateId === TUTORIAL_TEMPLATE;

/** The question the tutorial model is built to answer. */
export const TUTORIAL_QUESTION = "Can the drone Courier X1 fly the city route?";

/** Rough duration shown before starting. */
export const TUTORIAL_MINUTES = 25;

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

/** The open tutorial diagram, reduced to what the steps check. */
export interface TutorialModelState {
  scope: TutorialScope;
  elements: TutorialElement[];
  /** Relationships as element ids, in their direction. */
  relationships: Array<{ from: string; to: string }>;
  /** The element whose editor is open, if any. */
  editingId: string | null;
  /** The saved model rules of this diagram. */
  rules: Array<{ reportsIssue: boolean; attributes: string[] }>;
  /** The diagram has changes that are not saved yet. */
  dirty: boolean;
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const named = (state: TutorialModelState, name: string) =>
  state.elements.filter((element) => same(element.name, name));
const ofType = (state: TutorialModelState, type: string) =>
  state.elements.filter((element) => same(element.type, type));
const hasValue = (element: TutorialElement, attribute?: string) =>
  element.attributes.some(
    (candidate) => (!attribute || same(candidate.name, attribute)) && candidate.value.trim() !== "",
  );
const related = (state: TutorialModelState, from: TutorialElement[], to: TutorialElement[]) =>
  state.relationships.some(
    (relationship) =>
      from.some((element) => element.id === relationship.from) &&
      to.some((element) => element.id === relationship.to),
  );
const editing = (state: TutorialModelState, name: string) =>
  named(state, name).some((element) => element.id === state.editingId);

/** The types the tutorial metamodel starts with. */
const STARTING_TYPES = ["Drone", "Battery", "Delivery"];

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

const ELEMENT_CARD = ".react-flow__node";
const SAVE_DIAGRAM = '[data-testid="button-save-diagram-header"]';
const VALIDATE = '[data-testid="button-toolbar-validate"]';

export const TUTORIAL_LESSONS: TutorialLesson[] = [
  {
    id: "types-and-elements",
    title: "Types and elements",
    goal: "tell a kind, a type and an element apart, and find each on screen",
    why:
      "Symlit works on two levels. A metamodel defines types: what a Drone or a Battery is and which properties it has. A model contains elements of those types: one particular drone with its own values. The tutorial created one of each, Drone types and Delivery drone.",
    steps: [
      {
        id: "open-type",
        title: "Look inside a type",
        instruction:
          "You are in the metamodel Drone types. Double-click the Drone card to open it and look at its attributes: mass and range are listed, each without a value.",
        hint: "The grey label on a card, such as OBJECT or BEHAVIOR, is the kind of the type. Symlit has seven built-in kinds; a Delivery is a Behavior because it is something that happens, not a thing.",
        done: "Drone is a type. It says what every drone has (a mass and a range), not how much. Press Cancel to close the editor.",
        scope: "metamodel",
        check: (state) => editing(state, "Drone"),
        highlight: [{ selector: ELEMENT_CARD, text: "Drone" }],
      },
      {
        id: "open-instance",
        title: "Open the model",
        instruction:
          "Now open the model built from these types: Delivery drone. Its cards carry the name of their type in the corner: DRONE, BATTERY, DELIVERY.",
        done: "Same three types, now as elements: one particular drone, its batteries and one delivery.",
        signal: "view-opened",
        scope: "instance",
      },
      {
        id: "open-element",
        title: "Look inside an element",
        instruction:
          "Double-click Courier X1 to open it. Compare it with the Drone type you just saw: the same attributes, now with values.",
        done: "Courier X1 is an element of type Drone. It got mass and range from its type and fills in its own values: 4.2 kg and 18 km. Press Cancel to close the editor.",
        scope: "instance",
        check: (state) => editing(state, "Courier X1"),
        highlight: [{ selector: ELEMENT_CARD, text: "Courier X1" }],
      },
    ],
    question: {
      prompt: "Which of these is an element, not a type?",
      options: [
        { text: "Battery", feedback: "Battery is a type: it describes batteries in general and lives in Drone types." },
        { text: "Pack A", correct: true, feedback: "Right. Pack A is one particular battery, with its own capacity of 160 Wh." },
        { text: "Object", feedback: "Object is a built-in kind. Types such as Drone and Battery are Objects." },
      ],
    },
  },
  {
    id: "define-type",
    title: "Define a type",
    goal: "add a type, name it, give it an attribute with a unit and relate it to another type",
    why:
      "The delivery drone gets a camera. Before a model can contain a camera, the metamodel has to say what a camera is. You define the type once; every model that uses Drone types can then create cameras.",
    steps: [
      {
        id: "add-type",
        title: "Add a new type",
        instruction:
          "Go back to Drone types. On the Add elements tab in the sidebar, drag Object onto the canvas.",
        hint: "Clicking Object instead of dragging places it in a free spot. A camera is a thing, so Object is the right kind.",
        done: "A new type, still with a placeholder name.",
        scope: "metamodel",
        check: (state) => state.elements.some((element) => !STARTING_TYPES.some((name) => same(name, element.name))),
        highlight: ['[data-testid="button-create-sidebar-partdef"]'],
      },
      {
        id: "name-type",
        title: "Name it Camera",
        instruction:
          "Double-click the new type, change its Name to Camera and press Save Changes at the bottom of the editor.",
        hint: "The tutorial looks for a type named exactly Camera. Save Changes keeps what you edited in the editor; it does not store the diagram yet.",
        done: "Symlit saves in two steps. Save Changes keeps your edits to one type or element. Save at the top right stores the whole diagram; until then the header shows Unsaved changes.",
        scope: "metamodel",
        check: (state) => named(state, "Camera").length > 0,
        highlight: ['[data-testid="input-node-label"]', { selector: ELEMENT_CARD, text: "New Object" }],
      },
      {
        id: "add-attribute",
        title: "Give it an attribute",
        instruction:
          "Open Camera again and press Add attribute. Name the attribute resolution, pick a unit if you like, and press Add attribute. Then press Save Changes.",
        hint: "An attribute is a property every camera has. Leave Default value empty: each camera gets its own value later. In the unit list you can search, or type your own unit such as MP.",
        done: "Every camera created from now on starts with a resolution attribute.",
        scope: "metamodel",
        check: (state) => named(state, "Camera").some((element) => element.attributes.length > 0),
        highlight: ['[data-testid="button-add-attribute"]', { selector: ELEMENT_CARD, text: "Camera" }],
      },
      {
        id: "relate-types",
        title: "Relate Drone to Camera",
        instruction:
          "Move the pointer over the Drone card: round handles appear on its sides. Drag from one of these handles to the Camera card.",
        hint: "The direction matters: start at Drone and end on Camera. If the arrow points the wrong way, click the relationship, press Delete and draw it again.",
        done: "You drew an Association: a drone can now be related to a camera. Models may only connect elements the way their types are related. The diamond on powered by marks a Composition, a stronger kind: a battery is part of its drone. Double-click a relationship to name it or change its kind.",
        scope: "metamodel",
        check: (state) => related(state, named(state, "Drone"), named(state, "Camera")),
        highlight: [{ selector: ELEMENT_CARD, text: "Drone" }],
      },
      {
        id: "save-metamodel",
        title: "Save the metamodel",
        instruction: "Press Save at the top right, so that the model can use the new type.",
        done: "Saved. Camera is now available in every model that uses Drone types.",
        signal: "saved",
        scope: "metamodel",
        check: (state) => named(state, "Camera").length > 0,
        highlight: [SAVE_DIAGRAM],
      },
    ],
    question: {
      prompt: "Every drone should have a serial number. Where do you add it?",
      options: [
        { text: "As an attribute of the Drone type", correct: true, feedback: "Right. Defined once on the type, every drone has it." },
        { text: "As an attribute of Courier X1", feedback: "That gives only Courier X1 a serial number. The next drone would not have one." },
        { text: "As a new type Serial number", feedback: "A serial number is a property of a drone, not a thing of its own: an attribute fits better." },
      ],
    },
  },
  {
    id: "build-model",
    title: "Build a typed model",
    goal: "create an element of a type, fill in its values and connect it",
    why:
      "A model is built from elements of the types its metamodel offers. Because every element has a type, Symlit knows which attributes it should have and which relationships it may take part in.",
    steps: [
      {
        id: "insert-typed",
        title: "Add a camera",
        instruction:
          "Open Delivery drone. The Add elements tab lists the types from Drone types, now including Camera. Drag Camera onto the canvas.",
        hint: "Clicking Camera instead of dragging places it in the middle of the canvas. If Camera is missing from the list, the metamodel was not saved: go back to Drone types and press Save.",
        done: "A new element of type Camera, named New Camera.",
        scope: "instance",
        check: (state) => ofType(state, "Camera").length > 0,
        highlight: [{ selector: '[data-testid^="button-insert-referenced-class-"]', text: "Camera" }],
      },
      {
        id: "set-value",
        title: "Fill in its values",
        instruction:
          "Double-click the new camera. It already has the resolution attribute from its type. Enter a value such as 12, give the camera a name such as Nose camera, and press Save Changes.",
        done: "An element starts with a copy of its type's attributes and then keeps its own values. If a type gains an attribute later, existing elements keep what they have; their editor offers to add the new attribute.",
        scope: "instance",
        check: (state) => ofType(state, "Camera").some((element) => hasValue(element)),
        highlight: ['[data-testid="input-attr-value-0"]', { selector: ELEMENT_CARD, text: "Camera" }],
      },
      {
        id: "connect-instances",
        title: "Connect it to the drone",
        instruction:
          "Drag from a handle on Courier X1 to the camera. Symlit looks up which relationship the metamodel allows between a Drone and a Camera; confirm its suggestion with the check mark.",
        hint: "Start at Courier X1, as in the metamodel: the relationship there runs from Drone to Camera.",
        done: "The model now says that Courier X1 has this camera, in the way the metamodel allows.",
        scope: "instance",
        check: (state) => related(state, ofType(state, "Drone"), ofType(state, "Camera")),
        highlight: [{ selector: ELEMENT_CARD, text: "Courier X1" }],
      },
      {
        id: "save-instance",
        title: "Save the model",
        instruction: "Press Save at the top right.",
        done: "Saved. The model now contains a camera that did not exist as a concept ten minutes ago.",
        signal: "saved",
        scope: "instance",
        check: (state) => ofType(state, "Camera").length > 0,
        highlight: [SAVE_DIAGRAM],
      },
    ],
    question: {
      prompt: "You draw a relationship from Pack A to the camera. What happens when the model is validated?",
      options: [
        { text: "Nothing, any two elements may be connected", feedback: "Not in a typed model: relationships have to follow the metamodel." },
        {
          text: "Validation reports it",
          correct: true,
          feedback: "Right. Drone types has no relationship from Battery to Camera, so the model does not follow its metamodel.",
        },
        { text: "Symlit adds the relationship to the metamodel", feedback: "The metamodel only changes when you change it. The model is checked against it." },
      ],
    },
  },
  {
    id: "check-model",
    title: "Check your model",
    goal: "validate a model, read and fix an issue, and write a simple rule of your own",
    why:
      `A model is useful when it can answer questions. Validation checks two things: that the model follows its metamodel, and that it passes your model rules. A rule is a check you write yourself, and it is how this model will answer the question: ${TUTORIAL_QUESTION}`,
    steps: [
      {
        id: "validate",
        title: "Validate the model",
        instruction:
          "First guess: is this model complete? Then press Validate in the toolbar and read the result.",
        done: "Validation found something. A model rule reported Pack B: it has no capacity. The element is marked on the canvas.",
        signal: "validation-run",
        scope: "instance",
        highlight: [VALIDATE],
      },
      {
        id: "fix-issue",
        title: "Fix the issue",
        instruction:
          "Click the issue to find Pack B on the canvas. Double-click Pack B, enter a capacity such as 160 and press Save Changes.",
        hint: "The results stay open while you work. Every battery in the model needs a capacity value.",
        done: "Pack B now has a capacity.",
        scope: "instance",
        check: (state) =>
          ofType(state, "Battery").length > 0 &&
          ofType(state, "Battery").every((element) => hasValue(element, "capacity")),
        highlight: ['[data-testid="validation-issue-0"]', { selector: ELEMENT_CARD, text: "Pack B" }],
      },
      {
        id: "validate-again",
        title: "Validate again",
        instruction: "Press Validate again and check that the issue is gone.",
        hint: "If another issue shows up, read it: it names the element and what is wrong. A relationship the metamodel does not allow is reported here as well.",
        done: "No issues: the model follows its metamodel and passes its rules.",
        signal: "validation-passed",
        scope: "instance",
        highlight: ['[data-testid="button-validate-again"]', VALIDATE],
      },
      {
        id: "open-rules",
        title: "Read the rule that fired",
        instruction:
          "Open Model rules at the bottom of the sidebar and read the rule Every battery needs a capacity: for Battery, when capacity is not set, report an issue.",
        done: "A rule has three parts: which elements it looks at, a condition, and what happens when the condition holds: report an issue or add a tag.",
        signal: "rules-opened",
        scope: "instance",
        highlight: ['[data-testid="button-model-rules"]'],
      },
      {
        id: "add-rule",
        title: "Write your own rule",
        instruction:
          "The city route is 15 km long. Press Add rule and set it up: name Range covers the city route; elements Drone; condition range · is less than · 15; then report an issue. Press Save in the rules panel.",
        hint: "In the condition row, the second list picks the attribute (range) and the third the comparison. In the Then row, switch from add descriptor tag to report an issue. The panel's Save stores the rules; it is separate from the diagram's Save.",
        done: "Your rule is stored with the diagram and checked on every validation.",
        scope: "instance",
        check: (state) =>
          state.rules.some((rule) => rule.reportsIssue && rule.attributes.some((name) => same(name, "range"))),
        highlight: ['[data-testid="button-add-rule"]', '[data-testid="button-model-rules"]'],
      },
      {
        id: "answer-question",
        title: "Answer the question",
        instruction: "Close the rules panel and press Validate once more.",
        hint: "If your rule reports Courier X1, compare the condition with: range · is less than · 15.",
        done: "No issues: 18 km of range covers the 15 km route. Yes, Courier X1 can fly the city route, and the model will say so if that ever changes. Try it: set the range to 10, validate, then undo.",
        signal: "validation-passed",
        scope: "instance",
        check: (state) =>
          state.rules.some((rule) => rule.reportsIssue && rule.attributes.some((name) => same(name, "range"))),
        highlight: [VALIDATE],
      },
    ],
    question: {
      prompt: "Which of these checks needs a model rule?",
      options: [
        {
          text: "A relationship the metamodel does not allow",
          feedback: "Validation finds that on its own, by comparing the model with its metamodel.",
        },
        {
          text: "No drone may weigh more than 25 kg",
          correct: true,
          feedback: "Right. Only you know this limit, so you write it down as a rule: for Drone, when mass is greater than 25, report an issue.",
        },
        { text: "An element without a type", feedback: "Validation finds that on its own." },
      ],
    },
  },
  {
    id: "read-and-reuse",
    title: "Read and reuse",
    goal: "read a model as a table, tidy a diagram, and save and insert a pattern",
    why:
      "A diagram shows structure; a table shows values side by side. And when the same structure is needed again, such as a drone with its battery, a pattern saves you from drawing it twice.",
    steps: [
      {
        id: "table-mode",
        title: "Read the model as a table",
        instruction: "Press Table in the toolbar. Every element is a row, with its type and attribute values.",
        done: "Same model, different reading. The table is the quickest way to compare values or spot an empty one.",
        signal: "table-mode",
        scope: "instance",
        highlight: ['[data-testid="button-toolbar-table"]'],
      },
      {
        id: "auto-layout",
        title: "Tidy the diagram",
        instruction: "Switch back to Diagram and press Auto layout.",
        hint: "Undo (Ctrl+Z, or Cmd+Z on a Mac) puts everything back if you prefer your own layout.",
        done: "Auto layout arranges elements along their relationships. It changes positions only, never the model.",
        signal: "auto-layout",
        scope: "instance",
        highlight: ['[data-testid="button-toolbar-graph"]', '[data-testid="button-toolbar-auto-layout"]'],
      },
      {
        id: "save-pattern",
        title: "Save a pattern",
        instruction:
          "Select Courier X1 and Pack A together: hold Shift and drag a box around them, or Ctrl-click each (Cmd-click on a Mac). Press Save pattern in the toolbar and name it Drone with battery.",
        done: "The pattern stores both elements, their types and values, and the relationship between them.",
        signal: "pattern-saved",
        scope: "instance",
        highlight: ['[data-testid="button-toolbar-save-pattern"]', { selector: ELEMENT_CARD, text: "Courier X1" }],
      },
      {
        id: "insert-pattern",
        title: "Insert the pattern",
        instruction:
          "Open the Diagrams tab in the sidebar. Under Patterns, point at Drone with battery and press the arrow next to it.",
        done: "A second drone with its battery, typed and connected in one step. The copies are elements of their own: rename them and change their values freely.",
        signal: "pattern-inserted",
        scope: "instance",
        highlight: ['[data-testid^="button-insert-pattern-"]', '[data-sidebar="sidebar"] [role="tablist"]'],
      },
    ],
    question: {
      prompt: "When is a pattern the right tool?",
      options: [
        {
          text: "The same group of elements is needed several times",
          correct: true,
          feedback: "Right. A pattern is a reusable piece of model.",
        },
        { text: "Every drone should get a new attribute", feedback: "That is a change to the Drone type in the metamodel." },
        { text: "Values should be checked automatically", feedback: "That is what model rules do." },
      ],
    },
  },
  {
    id: "on-your-own",
    title: "On your own",
    goal: "extend a metamodel and its model without step-by-step instructions",
    why:
      "The depot gets a charger. This time there are no instructions for each click, only the result to reach. Everything you need was in the lessons before; the hints say where.",
    steps: [
      {
        id: "own-type",
        title: "Define a Charger type",
        instruction:
          "In Drone types: add a type named Charger with an attribute power, relate Charger to Battery, and save the metamodel.",
        hint: "This is lesson 2 again: drag Object, name it, add the attribute, drag from a handle on Charger to Battery, press Save at the top right.",
        done: "Charger is part of the vocabulary now.",
        scope: "metamodel",
        check: (state) =>
          named(state, "Charger").some((element) => element.attributes.length > 0) &&
          related(state, named(state, "Charger"), named(state, "Battery")) &&
          !state.dirty,
      },
      {
        id: "own-element",
        title: "Add a charger to the model",
        instruction:
          "In Delivery drone: add a charger, give its power a value, and connect it to a battery.",
        hint: "This is lesson 3 again: drag Charger from the Add elements tab, double-click it to enter the value, then drag from the charger to a battery and confirm the suggested relationship.",
        done: "The depot has a charger, and the model knows which battery it charges.",
        scope: "instance",
        check: (state) =>
          ofType(state, "Charger").some((element) => hasValue(element)) &&
          related(state, ofType(state, "Charger"), ofType(state, "Battery")),
      },
      {
        id: "own-validate",
        title: "Check your work",
        instruction: "Validate the model. Fix whatever it reports until there are no issues.",
        hint: "A relationship that runs the other way than in the metamodel is reported: delete it and draw it from the charger to the battery.",
        done: "Your own extension follows the metamodel and passes every rule.",
        signal: "validation-passed",
        scope: "instance",
        check: (state) => ofType(state, "Charger").length > 0,
      },
      {
        id: "export",
        title: "Export the model",
        instruction:
          "Save the diagram, then use Export Project at the bottom of the sidebar to download the model.",
        hint: "JSON holds the whole project, including the metamodel it uses. CSV lists elements and relationships for spreadsheets and other tools.",
        done: "The model is a file now: something you can share, archive or load into another tool.",
        signal: "exported",
        scope: "instance",
        highlight: ['[data-testid="button-export-project"]'],
      },
    ],
  },
];

export const TUTORIAL_STEPS: TutorialStep[] = TUTORIAL_LESSONS.flatMap((lesson) => lesson.steps);

/** Symlit features the tutorial leaves out, named on its last screen. */
export const TUTORIAL_NOT_COVERED = [
  "Several diagrams per project: an element is stored once and can appear in many",
  "Generalization: a type inherits attributes and relationships from another",
  "Derived attributes: values calculated from other attributes with a formula",
  "Tags: rules that label elements instead of reporting issues",
];
