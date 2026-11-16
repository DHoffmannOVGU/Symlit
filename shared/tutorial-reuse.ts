/**
 * The tutorial on reuse. It creates a metamodel ("Sensor node types", with a
 * pattern library), a second metamodel that builds on it ("Radio modules")
 * and a model ("Sensor node S1") (server/templates/tutorial-reuse.json).
 *
 * The other tutorials build one model. This one builds a second from the
 * first: a copy of the model, a part of it replaced by a ready-made pattern
 * from the metamodel's library, a radio added from a second metamodel, and
 * the result handed on as a file. Along the way: a type's style that its
 * elements follow. Most steps happen in the copy, a "variant" the learner
 * makes; the coach follows into it.
 *
 * It builds on the basics tutorial: steps name the result, not every click.
 */
import {
  attributeOf,
  ELEMENT_CARD,
  named,
  ofType,
  related,
  same,
  SAVE_DIAGRAM,
  VALIDATE,
  variantsIn,
  type TutorialDefinition,
  type TutorialLesson,
  type TutorialModelState,
  type TutorialWorkspaceState,
} from "./tutorial-types";

const QUESTION = "How do you build a second sensor node without starting from scratch?";

/** Colours of the template, to tell a changed style from the one it started with. */
const BATTERY_COLOR = "#16a34a";
const CONTROLLER_COLOR = "#2563eb";

const card = (text: string) => ({ selector: ELEMENT_CARD, text });
const colorChanged = (color: string, from: string) => color.trim() !== "" && !same(color, from);

const node = (state: TutorialModelState, name: string) => named(state, name)[0];
const sendsVia = (state: TutorialModelState, radioType: string) =>
  related(state, ofType(state, "Sensor node"), ofType(state, radioType), { name: "sends via" });
/** The battery of the Solar supply pattern powers the controller. */
const solarPowersController = (state: TutorialModelState) =>
  related(state, named(state, "Battery 3000"), ofType(state, "Microcontroller"), { name: "powers" });

/**
 * What importing a variant's file created: a model with the variant's name
 * that uses its own copies of the metamodels, and those copies, which have
 * the names of the tutorial's metamodels.
 */
const imported = (workspace: TutorialWorkspaceState) => {
  const variants = variantsIn(workspace);
  const variantNames = variants.map((variant) => variant.name);
  const metamodelNames = workspace.projects
    .filter((project) => project.ofTutorial && project.kind === "metamodel")
    .map((project) => project.name);
  return workspace.projects.filter(
    (project) =>
      !project.ofTutorial &&
      !variants.includes(project) &&
      (project.kind === "instance"
        ? project.metamodels.length > 0 && variantNames.some((name) => same(name, project.name))
        : metamodelNames.some((name) => same(name, project.name))),
  );
};
const importedModel = (workspace: TutorialWorkspaceState) =>
  imported(workspace).some((project) => project.kind === "instance");

const LESSONS: TutorialLesson[] = [
  {
    id: "type-style",
    title: "A style for every element of a type",
    goal: "give a type a style that its elements follow, and give one element a style of its own",
    why:
      "Before anything is reused, it helps if things of the same kind look alike. A type has a style (an icon, a colour, a border), and its elements follow it: change it once on the type, and every battery in every model that uses the type changes with it.",
    steps: [
      {
        id: "style-type",
        title: "Give the Battery type a new colour",
        instruction:
          "You are in the metamodel Sensor node types. Double-click the type Battery, open the Styling tab, press the colour and pick another one, for example Amber. Press Apply.",
        hint: "The Styling tab is next to Content at the top of the editor.",
        done: "The Battery type is drawn in its new colour.",
        scope: "metamodel",
        check: (state) => !!node(state, "Battery") && colorChanged(node(state, "Battery").color, BATTERY_COLOR),
        highlight: ['[data-testid="button-pick-color"]', card("Battery")],
      },
      {
        id: "save-style",
        title: "Save the metamodel",
        instruction: "Save Sensor node types at the top right.",
        done: "Saved. Every model that uses the type will draw its batteries this way.",
        signal: "saved",
        scope: "metamodel",
        check: (state) => !!node(state, "Battery") && colorChanged(node(state, "Battery").color, BATTERY_COLOR),
        highlight: [SAVE_DIAGRAM],
      },
      {
        id: "see-style",
        title: "See it in the model",
        instruction: "Open the model Sensor node S1 and look at Battery pack.",
        done: "Battery pack has the new colour, without anyone touching it: it follows its type's style.",
        scope: "instance",
        check: (state) => ofType(state, "Battery").some((battery) => colorChanged(battery.color, BATTERY_COLOR)),
        highlight: [card("Battery pack")],
      },
      {
        id: "own-style",
        title: "Give one element a style of its own",
        instruction:
          "Open the Controller, pick another colour for it on the Styling tab, for example Rose, and press Apply.",
        hint: "Changing a setting turns off Match the type for this element. Switching it on again brings back the type's style.",
        done: "The Controller now keeps its own colour; a later change to the Microcontroller type does not reach it. Every other element still follows its type.",
        scope: "instance",
        check: (state) =>
          ofType(state, "Microcontroller").some((controller) => colorChanged(controller.color, CONTROLLER_COLOR)),
        highlight: ['[data-testid="button-pick-color"]', card("Controller")],
      },
    ],
    question: {
      prompt: "The Battery type gets yet another colour. Which elements change?",
      options: [
        {
          text: "Every battery that still matches its type",
          correct: true,
          feedback: "Right. Elements follow their type's style until they are given one of their own.",
        },
        { text: "Only batteries created from now on", feedback: "Style is not copied like attributes are: existing elements follow the type." },
        { text: "None, a colour is set per element", feedback: "Only for elements that were given a style of their own, like the Controller." },
      ],
    },
  },
  {
    id: "copy",
    title: "A variant from a copy",
    goal: "make a second model as a copy of the first and change it without touching the original",
    why:
      "A customer wants a second sensor node: like S1, but measuring humidity. Drawing it again would repeat everything that stays the same. A copy of the model starts with all of it, and only the differences are left to do. Templates on the project list work the same way, prepared by someone for everyone.",
    steps: [
      {
        id: "duplicate",
        title: "Duplicate the model",
        instruction:
          "Save the diagram. Go to All projects and press the copy button on the card Tutorial · Sensor node S1. The copy opens.",
        hint: "The copy button is among the buttons on the project card (Duplicate). The copy is called Copy of Tutorial · Sensor node S1; it gets a proper name later.",
        done: "A complete copy: its diagram, elements, values and relationships. It uses the same metamodel; the metamodel was not copied.",
        scope: "projects",
        checkProjects: (workspace) => variantsIn(workspace).length > 0,
        highlight: ['[data-testid^="button-duplicate-project-"]'],
      },
      {
        id: "rename-node",
        title: "Call the new node S2",
        instruction: "In the copy, rename the sensor node S1 to S2.",
        hint: "Select it and press F2, or open its editor.",
        done: "The copy is a sensor node of its own now, at least by name.",
        scope: "variant",
        check: (state) => ofType(state, "Sensor node").some((element) => same(element.name, "S2")),
        highlight: [card("S1")],
      },
      {
        id: "change-sensor",
        title: "Make it measure humidity",
        instruction:
          "Rename Temperature sensor to Humidity sensor, set its quantity to humidity, and save the diagram.",
        done: "S2 measures humidity. One element changed; everything else came with the copy.",
        scope: "variant",
        check: (state) =>
          ofType(state, "Sensor").some(
            (sensor) =>
              same(sensor.name, "Humidity sensor") && same(attributeOf(sensor, "quantity")?.value ?? "", "humidity"),
          ) && !state.dirty,
        highlight: [card("Temperature sensor")],
      },
      {
        id: "check-original",
        title: "Look at the original",
        instruction: "First guess: does S1 measure humidity now as well? Then open Sensor node S1 and see.",
        afterPrevious: true,
        done: "S1 is unchanged: still a temperature sensor. A copy is not linked to its original, so a variant can be changed freely.",
        scope: "instance",
        check: (state) => named(state, "Temperature sensor").length > 0 && named(state, "S1").length > 0,
      },
    ],
    question: {
      prompt: "In S2 the Controller's current is changed. What happens in S1?",
      options: [
        { text: "It changes too: S2 is a copy of S1", feedback: "A copy is independent from the moment it is made." },
        {
          text: "Nothing: the two models are independent",
          correct: true,
          feedback: "Right. What the two share is their metamodel: a change to a type reaches both, a change to an element only its own model.",
        },
        { text: "S1 is offered the change", feedback: "Nothing connects a copy to its original after copying." },
      ],
    },
  },
  {
    id: "library",
    title: "From the metamodel's library",
    goal: "insert a pattern a metamodel provides, and fit it into a model",
    why:
      "S2 will stand in a field, far from anyone who could change batteries: it needs a solar panel. How a solar supply is put together is the same for every sensor node, so the metamodel comes with it: a pattern in its library. Every model that uses the metamodel can insert it.",
    steps: [
      {
        id: "insert-pattern",
        title: "Insert the Solar supply",
        instruction:
          "Open your copy again. On the Diagrams tab, under Patterns, Solar supply is marked as coming from Sensor node types. Point at it and press the arrow to insert it.",
        hint: "The coach's button opens the copy. Patterns of a metamodel can be inserted, not changed, in a model.",
        done: "A battery and a solar panel that charges it, typed and connected, in one step.",
        signal: "pattern-inserted",
        scope: "variant",
        highlight: ['[data-testid^="button-insert-pattern-"]', '[data-sidebar="sidebar"] [role="tablist"]'],
      },
      {
        id: "connect-supply",
        title: "Connect it",
        instruction:
          "Let the new Battery 3000 power the Controller: draw a relationship from it to the Controller and confirm powers.",
        hint: "Start at the battery: a battery powers a controller, not the other way round.",
        done: "The solar supply now powers S2's controller.",
        scope: "variant",
        check: solarPowersController,
        highlight: [card("Battery 3000")],
      },
      {
        id: "remove-old",
        title: "Remove the old battery",
        instruction: "Delete Battery pack, which the solar supply replaces, and save the diagram.",
        hint: "Select it and press Delete. Its relationships go with it.",
        done: "S2 runs on solar power. Its supply is the one the metamodel's authors put together, not a new drawing.",
        scope: "variant",
        check: (state) => named(state, "Battery pack").length === 0 && solarPowersController(state) && !state.dirty,
        highlight: [card("Battery pack")],
      },
    ],
    question: {
      prompt: "Which models can insert the pattern Solar supply?",
      options: [
        { text: "Only Sensor node S1, where it was drawn", feedback: "It was not drawn in S1: it belongs to the metamodel." },
        {
          text: "Every model that uses Sensor node types",
          correct: true,
          feedback: "Right. A pattern in a metamodel's library is offered to every model built from that metamodel.",
        },
        { text: "Every model in the workspace", feedback: "Only models that use the metamodel: elsewhere its types mean nothing." },
      ],
    },
  },
  {
    id: "second-metamodel",
    title: "A second metamodel",
    goal: "let a model use a second metamodel, and connect elements of both",
    why:
      "S2 has to send its readings by radio. Radio modules are described in a metamodel of their own, Radio modules, so that sensor nodes, gateways and anything else can use them. That metamodel builds on Sensor node types: it shows the type Sensor node in its diagram and defines how a sensor node sends via a radio module.",
    steps: [
      {
        id: "add-metamodel",
        title: "Use the radio modules in S2",
        instruction:
          "In your copy, open the metamodel selector in the header (it says 1 Metamodel selected) and tick Tutorial · Radio modules.",
        hint: "The Add elements tab gets a second group, Radio modules, with its types.",
        done: "S2 uses two metamodels now. Their types are listed side by side, each group under its metamodel.",
        scope: "variant",
        check: (state) => state.metamodels.some((name) => name.toLowerCase().includes("radio modules")),
        highlight: ['[data-testid="button-metamodel-selector"]'],
      },
      {
        id: "add-radio",
        title: "Give S2 a radio",
        instruction:
          "Add a LoRa module and draw a relationship from S2 to it. Symlit suggests sends via: confirm it.",
        hint: "A LoRa module is a Radio module (a Generalization in Radio modules), so the relationship defined for Radio module holds for it.",
        done: "A relationship between elements of two metamodels, defined in the one that builds on the other.",
        scope: "variant",
        check: (state) => sendsVia(state, "LoRa module"),
        highlight: [{ selector: '[data-testid^="button-insert-referenced-class-"]', text: "LoRa module" }, card("S2")],
      },
      {
        id: "validate",
        title: "Validate S2",
        instruction: "Press Validate and check that nothing is reported.",
        hint: "If a relationship is reported, check its direction: from S2 to the module, and from the battery to the controller.",
        done: "S2 follows both of its metamodels.",
        signal: "validation-passed",
        scope: "variant",
        check: (state) => sendsVia(state, "LoRa module") && solarPowersController(state),
        highlight: [VALIDATE],
      },
    ],
    question: {
      prompt: "Why can Radio modules define a relationship from Sensor node, a type of another metamodel?",
      options: [
        {
          text: "It builds on Sensor node types and shows that type in its diagram",
          correct: true,
          feedback: "Right. A metamodel can build on another one and use its types, here to say how a sensor node uses a radio.",
        },
        { text: "Any metamodel can connect any types", feedback: "Only types it has in its diagrams: its own, and those of metamodels it builds on." },
        { text: "Because S2 uses both metamodels", feedback: "A model only uses what its metamodels define. The relationship had to be defined first." },
      ],
    },
  },
  {
    id: "hand-on",
    title: "Hand it on",
    goal: "export a model so that it can be opened elsewhere, import such a file, and tidy up afterwards",
    why:
      "The customer's integrator works with Symlit too, on another computer. A project file carries a model to them. It has to carry what the model needs as well: a model without its metamodels cannot be opened anywhere else. And the file's name and contents should say what it is.",
    steps: [
      {
        id: "rename-variant",
        title: "Give the copy its name",
        instruction:
          "Go to All projects. On the card of your copy, press Edit project (the button with the sliders), name it Sensor node S2 and save.",
        hint: "The tutorial looks for a copy named Sensor node S2.",
        done: "The copy has a name that says what it is, and so will the file made from it.",
        scope: "projects",
        checkProjects: (workspace) => variantsIn(workspace).some((variant) => same(variant.name, "Sensor node S2")),
        highlight: ['[data-testid^="button-edit-project-"]'],
      },
      {
        id: "export",
        title: "Export S2 with its metamodels",
        instruction:
          "Open Sensor node S2. Use Export Project at the bottom of the sidebar, keep the format Structured model package (JSON), tick Referenced metamodel definitions under Package contents, and download.",
        hint: "Without the metamodel definitions the file holds the model alone. Importing it would fail, because its types would be missing.",
        done: "The file holds S2 and both metamodels it uses.",
        signal: "exported",
        scope: "variant",
        highlight: ['[data-testid="button-export-project"]'],
      },
      {
        id: "import",
        title: "Open the file as the integrator would",
        instruction:
          "Go to All projects, press Import and choose the file you just downloaded. The imported model opens; come back to All projects afterwards.",
        hint: "If the import reports a metamodel that is not in the file, export again with Referenced metamodel definitions ticked.",
        done: "The file arrived complete: a model called Sensor node S2 and, as new projects, the two metamodels it needs, under the same names as yours. That is exactly what the integrator would see.",
        scope: "projects",
        checkProjects: importedModel,
        highlight: ['[data-testid="button-import-project"]'],
      },
      {
        id: "remove-imported",
        title: "Remove what was imported",
        instruction:
          "Here the imported projects only duplicate yours. Delete the imported Sensor node S2 (the one opened last) and the two metamodels that came with it, which are listed after your own.",
        hint: "Delete the metamodels first and read what the delete dialog says: it names the model that uses them. Your own S2 uses Tutorial · Sensor node types too; the imported one uses its copy.",
        done: "Only your projects are left. Deleting a metamodel that a model uses is allowed, but Symlit names that model first, because its elements would lose their types.",
        scope: "projects",
        afterPrevious: true,
        checkProjects: (workspace) => imported(workspace).length === 0 && variantsIn(workspace).length > 0,
        highlight: ['[data-testid^="button-delete-project-"]'],
      },
    ],
    question: {
      prompt: "Why does the file have to contain the metamodels?",
      options: [
        { text: "So that the file is larger", feedback: "Size is not the point." },
        {
          text: "The model's elements are typed by them; without them nobody could open it",
          correct: true,
          feedback: "Right. A model only means something together with its metamodels. A file for someone else has to bring them.",
        },
        { text: "So that the metamodels are updated on the other computer", feedback: "Importing creates new projects; it does not change existing ones." },
      ],
    },
  },
  {
    id: "on-your-own",
    title: "On your own",
    goal: "build another variant from the parts that exist",
    why:
      "A third node, S3, is for setting up gateways on site: it talks over Bluetooth instead of LoRa. This time only the result is given. Everything you need was in the lessons before; the hints say where.",
    steps: [
      {
        id: "own-copy",
        title: "Make the third node",
        instruction: "On All projects: make a copy of Sensor node S2, for S3.",
        hint: "The copy button (Duplicate) on its card. See lesson 2.",
        done: "A third model, with everything S2 has.",
        scope: "projects",
        checkProjects: (workspace) => variantsIn(workspace).length >= 2,
      },
      {
        id: "own-radio",
        title: "Change its radio",
        instruction: "In the new copy: rename its node to S3, and let it send via a Bluetooth module instead of the LoRa module.",
        hint: "Delete the LoRa module, add a Bluetooth module from the Radio modules group and draw the relationship from S3. See lesson 4.",
        done: "S3 sends via Bluetooth.",
        scope: "variant",
        check: (state) =>
          ofType(state, "Sensor node").some((element) => same(element.name, "S3")) &&
          sendsVia(state, "Bluetooth module") &&
          ofType(state, "LoRa module").length === 0,
      },
      {
        id: "own-validate",
        title: "Check S3",
        instruction: "Validate S3, fix whatever is reported, and save.",
        done: "Three sensor nodes: one drawn, two built from it.",
        signal: "validation-passed",
        scope: "variant",
        check: (state) => sendsVia(state, "Bluetooth module"),
        highlight: [VALIDATE],
      },
    ],
  },
];

export const REUSE_TUTORIAL: TutorialDefinition = {
  id: "reuse",
  templateId: "tutorial-reuse",
  title: "Reuse and variants",
  question: QUESTION,
  answer:
    "As a copy of the first, changed where it differs: a sensor that measures something else, a power supply from the metamodel's library, a radio from a second metamodel. A few steps instead of a new model, and the result passes validation.",
  answerStep: "validate",
  summary:
    "A company builds sensor nodes, and the customer wants a second one. You let a type's style reach its elements, copy the model, insert a ready-made power supply from the metamodel's library, add a radio from a second metamodel, and hand the result on as a file.",
  prerequisite: "Builds on Symlit basics; Structure and views helps.",
  minutes: 30,
  projects: { metamodel: "Sensor node types", instance: "Sensor node S1" },
  finishedTitle: "You built variants from what was there",
  lessons: LESSONS,
  notCovered: [
    "Templates: New project → From a template starts from a model someone prepared",
    "Making a pattern library for a metamodel: the library in this tutorial came with it",
    "Letting a metamodel build on another one: Radio modules came with that, too",
    "Icons, borders and shapes of a type's style",
  ],
};
