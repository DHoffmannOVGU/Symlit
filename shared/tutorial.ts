/**
 * The guided tutorial: lesson definitions (shared by client and server) and
 * the content of the two tutorial projects.
 *
 * The tutorial creates a metamodel ("Drone types") and an instance model
 * ("Delivery drone") that uses it, so the lessons follow the real Symlit
 * workflow: define types, then build typed models from them.
 */

/**
 * The project template both tutorial projects are created from
 * (server/templates/tutorial.json); the project type tells them apart.
 */
export const TUTORIAL_TEMPLATE = "tutorial";

export const isTutorialTemplate = (templateId: string | null | undefined) =>
  templateId === TUTORIAL_TEMPLATE;

/** Things the app reports while someone works; tutorial steps wait for them. */
export const tutorialSignals = [
  "view-opened",
  "node-created",
  "typed-node-created",
  "attribute-added",
  "edge-created",
  "saved",
  "validation-run",
  "rules-opened",
  "table-mode",
  "auto-layout",
  "pattern-saved",
  "exported",
] as const;

export type TutorialSignal = (typeof tutorialSignals)[number];

/** Which tutorial project a step happens in. */
export type TutorialScope = "metamodel" | "instance";

export interface TutorialStep {
  id: string;
  title: string;
  /** What to do, in one or two sentences. */
  instruction: string;
  /** Extra help shown on demand. */
  hint?: string;
  signal: TutorialSignal;
  scope: TutorialScope;
  /**
   * Element to highlight for "Show me": a CSS selector, tried in order.
   * Without one, "Show me" only opens the right diagram.
   */
  highlight?: string[];
}

export interface TutorialLesson {
  id: string;
  title: string;
  /** Why this matters, shown above the steps. */
  why: string;
  steps: TutorialStep[];
}

export const TUTORIAL_LESSONS: TutorialLesson[] = [
  {
    id: "two-kinds",
    title: "Metamodels and models",
    why:
      "Symlit separates the vocabulary of a domain (a metamodel: which types and relationships exist) from the models built with it (instance models). The tutorial created one of each: Drone types and Delivery drone.",
    steps: [
      {
        id: "open-metamodel",
        title: "Open the Drone types metamodel",
        instruction:
          "Open the Types diagram of the Drone types project. It defines the building blocks the delivery model uses.",
        signal: "view-opened",
        scope: "metamodel",
      },
      {
        id: "open-instance",
        title: "Open the Delivery drone model",
        instruction:
          "Now open the Delivery diagram. Every element there is an instance of a type from Drone types.",
        hint: "Element cards show their type in the top right corner, for example DRONE or BATTERY.",
        signal: "view-opened",
        scope: "instance",
      },
    ],
  },
  {
    id: "define-type",
    title: "Define a type",
    why:
      "Types describe what can exist in your models and which properties they carry. Changing a type once updates every model that uses it.",
    steps: [
      {
        id: "add-type",
        title: "Add a new type",
        instruction:
          "In Drone types, open the Create Nodes tab in the sidebar and drag an Object onto the canvas. It will become a Camera.",
        hint: "Clicking a node type in the sidebar places it in the middle of the canvas instead.",
        signal: "node-created",
        scope: "metamodel",
        highlight: ['[data-testid^="button-create-sidebar-"]', '[data-sidebar="sidebar"] [role="tablist"]'],
      },
      {
        id: "add-attribute",
        title: "Give it an attribute",
        instruction:
          "Double-click the new type to open its editor, add an attribute such as resolution with a unit, and save the editor.",
        hint: "Attributes defined on a type are offered on every instance of that type.",
        signal: "attribute-added",
        scope: "metamodel",
      },
      {
        id: "relate-types",
        title: "Relate two types",
        instruction:
          "Drag from the small handle on the edge of one type to another type, for example from Drone to Camera, and pick a relationship such as Composition.",
        hint: "Hover a type to see its connection handles. The relationship menu explains each kind.",
        signal: "edge-created",
        scope: "metamodel",
      },
      {
        id: "save-metamodel",
        title: "Save the metamodel",
        instruction: "Save the diagram so the delivery model can use your new type.",
        signal: "saved",
        scope: "metamodel",
        highlight: ['[data-testid="button-save-diagram-header"]'],
      },
    ],
  },
  {
    id: "build-model",
    title: "Build a typed model",
    why:
      "Instance models are made of typed elements. Symlit checks them against the metamodel, so a relationship the metamodel does not allow is flagged.",
    steps: [
      {
        id: "insert-typed",
        title: "Add a typed element",
        instruction:
          "In Delivery drone, open the Metamodels tab in the sidebar and drag one of the Drone types onto the canvas, for example your new Camera.",
        hint: "The Metamodels tab lists the types of every metamodel this model references. The Reference Metamodels menu at the top manages those references.",
        signal: "typed-node-created",
        scope: "instance",
        highlight: ['[data-testid^="button-insert-referenced-class-"]', '[data-testid="button-metamodel-selector"]'],
      },
      {
        id: "connect-instances",
        title: "Connect it",
        instruction: "Draw a relationship from the drone to the element you just added.",
        signal: "edge-created",
        scope: "instance",
      },
      {
        id: "save-instance",
        title: "Save the model",
        instruction: "Save the Delivery diagram.",
        signal: "saved",
        scope: "instance",
        highlight: ['[data-testid="button-save-diagram-header"]'],
      },
    ],
  },
  {
    id: "check-model",
    title: "Check your model",
    why:
      "Validation compares a model with its metamodel: missing types, unknown types and relationships that are not allowed. Model rules add your own checks, such as every Battery needing a capacity.",
    steps: [
      {
        id: "validate",
        title: "Validate the model",
        instruction: "Run validation from the toolbar above the canvas and read the result.",
        signal: "validation-run",
        scope: "instance",
        highlight: ['button[title="Validate"]'],
      },
      {
        id: "open-rules",
        title: "Open the model rules",
        instruction:
          "Open Instance Rules from the bottom of the sidebar. Rules can tag elements or report issues when a condition holds.",
        signal: "rules-opened",
        scope: "instance",
        highlight: ['[data-testid="button-model-rules"]'],
      },
    ],
  },
  {
    id: "see-differently",
    title: "See it differently",
    why:
      "The same model can be read as a diagram or as a table, and the layout can be tidied automatically when a diagram grows.",
    steps: [
      {
        id: "table-mode",
        title: "Switch to the table view",
        instruction: "Use the table button in the toolbar to see every element and relationship as rows.",
        signal: "table-mode",
        scope: "instance",
        highlight: ['button[title="Table View"]'],
      },
      {
        id: "auto-layout",
        title: "Tidy the diagram",
        instruction:
          "Switch back to the graph view and press Auto Layout. Undo puts everything back if you prefer your own layout.",
        signal: "auto-layout",
        scope: "instance",
        highlight: ['button[title="Graph View"]', 'button[title="Auto Layout"]'],
      },
    ],
  },
  {
    id: "reuse",
    title: "Reuse structures",
    why:
      "Patterns save a group of elements and their relationships so you can insert the same structure again, in this or another diagram.",
    steps: [
      {
        id: "save-pattern",
        title: "Save a pattern",
        instruction:
          "Select two connected elements: hold Shift and drag a box around them, or Ctrl-click each (Cmd-click on a Mac). Save Pattern then appears in the toolbar; give the pattern a name.",
        signal: "pattern-saved",
        scope: "instance",
        highlight: ['button[title="Save Pattern"]'],
      },
    ],
  },
  {
    id: "share",
    title: "Share your work",
    why:
      "Exports contain the whole project as JSON, or elements and relationships as CSV for spreadsheets and other tools.",
    steps: [
      {
        id: "export",
        title: "Export the project",
        instruction: "Use Export Project at the bottom of the sidebar and download the model.",
        signal: "exported",
        scope: "instance",
        highlight: ['[data-testid="button-export-project"]'],
      },
    ],
  },
];

export const TUTORIAL_STEPS: TutorialStep[] = TUTORIAL_LESSONS.flatMap((lesson) => lesson.steps);
