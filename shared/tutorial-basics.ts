/**
 * The first tutorial: how Symlit works. It creates a metamodel ("Drone types")
 * and a model ("Delivery drone") that uses it (server/templates/tutorial.json),
 * and follows the real workflow with one question in mind.
 */
import {
  attributeOf,
  comparesWith,
  editing,
  ELEMENT_CARD,
  hasValue,
  named,
  ofType,
  related,
  same,
  SAVE_DIAGRAM,
  VALIDATE,
  type TutorialDefinition,
  type TutorialLesson,
  type TutorialModelState,
} from "./tutorial-types";

const QUESTION = "Can the drone Courier X1 fly the city route?";

/**
 * The learner's rule: a drone whose range is below the 15 km of the city
 * route is reported. The texts that follow state that 18 km covers 15 km, so
 * the rule has to say exactly that.
 */
const rangeRule = (state: TutorialModelState) =>
  state.rules.some(
    (rule) =>
      rule.reportsIssue && same(rule.target, "Drone") && comparesWith(rule, "range", ["less-than"]) === 15,
  );

/** The types the tutorial metamodel starts with. */
const STARTING_TYPES = ["Drone", "Battery", "Delivery"];

const LESSONS: TutorialLesson[] = [
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
          "Before you open Courier X1, guess: which attributes will it have, and will they have values? Then double-click it and compare with the Drone type you just saw.",
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
        // One type more than at the start: renaming an existing type is not adding one.
        check: (state) => state.elements.length > STARTING_TYPES.length,
        highlight: ['[data-testid="button-create-sidebar-partdef"]'],
      },
      {
        id: "name-type",
        title: "Name it Camera",
        instruction:
          "Double-click the new type, change its Name to Camera and press Apply at the bottom of the editor. Guess first: will the header still say Unsaved changes afterwards?",
        hint: "The tutorial looks for a type named exactly Camera. Apply puts what you edited into the diagram; it does not store the diagram yet.",
        done: "Symlit saves in two steps. Apply puts your edits to one type or element into the diagram. Save at the top right stores the whole diagram; until then the header shows Unsaved changes.",
        scope: "metamodel",
        check: (state) => named(state, "Camera").length > 0,
        highlight: ['[data-testid="input-node-label"]', { selector: ELEMENT_CARD, text: "New Object" }],
      },
      {
        id: "add-attribute",
        title: "Give it an attribute",
        instruction:
          "Open Camera again and press Add attribute. Name the attribute resolution, pick a unit if you like, and press Add attribute. Then press Apply.",
        hint: "An attribute is a property every camera has. Leave Default value empty: each camera gets its own value later. In the unit list you can search, or type your own unit such as MP.",
        done: "Every camera created from now on starts with a resolution attribute.",
        scope: "metamodel",
        check: (state) => named(state, "Camera").some((element) => attributeOf(element, "resolution") !== undefined),
        highlight: ['[data-testid="button-add-attribute"]', { selector: ELEMENT_CARD, text: "Camera" }],
      },
      {
        id: "relate-types",
        title: "Relate Drone to Camera",
        instruction:
          "Move the pointer over the Drone card: round handles appear on its sides. Drag from one of these handles and let go on the Camera card.",
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
        scope: "metamodel",
        // Judged on the saved diagram once the work before it is done: a save before
        // the attribute and the relationship were there did not store them.
        afterPrevious: true,
        check: (state) => named(state, "Camera").length > 0 && !state.dirty,
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
        done: "A new element of type Camera, with a placeholder name such as New Camera 5.",
        scope: "instance",
        check: (state) => ofType(state, "Camera").length > 0,
        highlight: [{ selector: '[data-testid^="button-insert-referenced-class-"]', text: "Camera" }],
      },
      {
        id: "set-value",
        title: "Fill in its values",
        instruction:
          "Guess first: will the new camera have the resolution you defined on the type? Double-click it and see. Enter a value such as 12, give the camera a name such as Nose camera, and press Apply.",
        done: "An element starts with a copy of its type's attributes and then keeps its own values. If a type gains an attribute later, existing elements keep what they have; their editor offers to add the new attribute.",
        scope: "instance",
        // A value it got from a default on the type, and the placeholder name, are not filled in yet.
        check: (state) =>
          ofType(state, "Camera").some(
            (element) => hasValue(element, "resolution") && !/^new camera\b/i.test(element.name.trim()),
          ),
        highlight: ['[data-attribute-name="resolution"]', { selector: ELEMENT_CARD, text: "Camera" }],
      },
      {
        id: "connect-instances",
        title: "Connect it to the drone",
        instruction:
          "Drag from a handle on Courier X1 and let go on the camera. Symlit looks up which relationship the metamodel allows between a Drone and a Camera; confirm its suggestion with the check mark.",
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
        scope: "instance",
        afterPrevious: true,
        check: (state) => ofType(state, "Camera").length > 0 && !state.dirty,
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
      `A model is useful when it can answer questions. Validation checks two things: that the model follows its metamodel, and that it passes your model rules. A rule is a check you write yourself, and it is how this model will answer the question: ${QUESTION}`,
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
          "Click the issue to find Pack B on the canvas. Double-click Pack B, enter a capacity such as 160 and press Apply.",
        hint: "The results stay open while you work. Every battery in the model needs a capacity value.",
        done: "Pack B now has a capacity.",
        scope: "instance",
        // Two batteries at the start: deleting Pack B is not fixing it.
        check: (state) =>
          ofType(state, "Battery").length >= 2 &&
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
        id: "add-rule",
        title: "Write your own rule",
        instruction:
          "The city route is 15 km long. Open Model rules at the bottom of the sidebar: the rule that fired is there, Every battery needs a capacity. Below it, press Add rule and set it up: name Range covers the city route; in the list next to the name, change All object types to Drone; condition range · is less than · 15; then report an issue. Press Save in the rules panel.",
        hint: "The tutorial looks for exactly this rule: for Drone, range · is less than · 15, report an issue. In the condition row, the second list picks the attribute (range) and the third the comparison. In the Then row, switch from add descriptor tag to report an issue. The panel's Save stores the rules; it is separate from the diagram's Save.",
        done: "A rule has three parts: which elements it looks at, a condition, and what happens when the condition holds. The text above the lists says the first two in one line: for Drone where [range] < 15. You can write rules there, too. Yours is stored with the diagram and checked on every validation.",
        scope: "instance",
        check: rangeRule,
        highlight: ['[data-testid="button-add-rule"]', '[data-testid="button-model-rules"]'],
      },
      {
        id: "answer-question",
        title: "Answer the question",
        instruction: "Close the rules panel and press Validate once more.",
        hint: "If validation still reports something, read the issue: it names the element and what is wrong. Your rule only reports a drone whose range is below 15 km; a relationship the metamodel does not allow is reported too.",
        done: "No issues: 18 km of range covers the 15 km route. Yes, Courier X1 can fly the city route, and the model will say so if that ever changes. Try it: set the range to 10, validate, then undo.",
        signal: "validation-passed",
        scope: "instance",
        check: rangeRule,
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
        instruction: "Guess first: will Auto layout change any value or relationship? Then switch back to Diagram and press Auto layout.",
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
          "Select only Courier X1 and Pack A: click Courier X1, then Ctrl-click Pack A (Cmd-click on a Mac), or hold Shift and drag a box around just these two. Press Save pattern in the toolbar and name it Drone with battery.",
        done: "The pattern stores the selected elements, their types and values, and the relationships between them.",
        signal: "pattern-saved",
        scope: "instance",
        highlight: ['[data-testid="button-toolbar-save-pattern"]', { selector: ELEMENT_CARD, text: "Courier X1" }],
      },
      {
        id: "insert-pattern",
        title: "Insert the pattern",
        instruction:
          "Open the Diagrams tab in the sidebar. Under Patterns, point at Drone with battery and press the arrow next to it.",
        hint: "If only a drone was inserted, the pattern was saved without Pack A: select both and save it again.",
        done: "A copy of the pattern, typed and connected in one step: a second drone with its battery. The copies are elements of their own: rename them and change their values freely.",
        scope: "instance",
        // Judged by what was inserted: a pattern without the battery is not a drone with its battery.
        afterPrevious: true,
        check: (state) =>
          ofType(state, "Drone").filter((drone) => related(state, [drone], ofType(state, "Battery"))).length >= 2,
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
        hint: "This is lesson 2 again: drag Object, name it, add the attribute, drag from a handle on Charger and let go on Battery, press Save at the top right.",
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
          "Save the diagram, then press Export Project at the bottom of the sidebar and download the Structured model package (JSON), the format it offers first.",
        hint: "The JSON package holds the model's diagrams. Tick Referenced metamodel definitions to include Drone types, and Reusable patterns to include Drone with battery. The two CSV formats list either the elements or the relationships, for spreadsheets.",
        done: "The model is a file now: something you can share, archive or load into another tool.",
        signal: "exported",
        scope: "instance",
        highlight: ['[data-testid="button-export-project"]'],
      },
    ],
  },
];

const NOT_COVERED = [
  "Several diagrams per project: an element is stored once and can appear in many",
  "Generalization: elements of a specialized type also get the attributes of its general type, and it may be used wherever the general type is allowed in a relationship",
  "Derived attributes: values calculated from other attributes with a formula",
  "Tags: rules that label elements instead of reporting issues",
];

export const BASICS_TUTORIAL: TutorialDefinition = {
  id: "basics",
  templateId: "tutorial",
  title: "Symlit basics",
  question: QUESTION,
  answer: "Yes: its 18 km of range covers the 15 km route, and your rule keeps checking that.",
  answerStep: "answer-question",
  summary:
    "Find out by modeling it. You look at what a drone and a battery are, define a camera, build a model from these types, let Symlit check it, and write the rule that answers the question. The last lesson is yours: you extend the model without step-by-step instructions.",
  minutes: 25,
  projects: { metamodel: "Drone types", instance: "Delivery drone" },
  finishedTitle: "You built, checked and extended a model",
  lessons: LESSONS,
  notCovered: NOT_COVERED,
};
