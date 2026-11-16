/**
 * The tutorial on structure and diagrams. It creates a metamodel ("Machine
 * types") and a model ("Espresso machine E1") that uses it
 * (server/templates/tutorial-structure.json).
 *
 * The other tutorials draw plain relationships in one diagram. This one is
 * about what a relationship says (its name, its kind, its direction), about
 * Generalization, and about showing the same elements in a second diagram.
 * The model starts with one diagram, Structure: what the machine consists
 * of. The learner adds a second one, Water path, with the same elements
 * connected differently, and finds that an element changed in one diagram is
 * changed in the other, because it is one element.
 *
 * It builds on the basics tutorial: steps name the result, not every click.
 */
import {
  attributeOf,
  editing,
  ELEMENT_CARD,
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

const QUESTION = "What does replacing the pump of the espresso machine affect?";

const DIAGRAMS_TAB = '[data-sidebar="sidebar"] [role="tablist"]';
const card = (text: string) => ({ selector: ELEMENT_CARD, text });

const type = (state: TutorialModelState, name: string) => named(state, name);
/** Relationships from Boiler to Brew group in the metamodel; "heats" is there from the start. */
const boilerToBrewGroup = (state: TutorialModelState) => {
  const boilers = type(state, "Boiler").map((element) => element.id);
  const groups = type(state, "Brew group").map((element) => element.id);
  return state.relationships.filter(
    (relationship) => boilers.includes(relationship.from) && groups.includes(relationship.to),
  );
};
const feeds = { name: "feeds" };
/** The water path, in the diagram of that name. The pump may have been renamed by then. */
const pump = (state: TutorialModelState) => ofType(state, "Pump");
const pathIsConnected = (state: TutorialModelState) =>
  related(state, ofType(state, "Tank"), pump(state), feeds) &&
  related(state, pump(state), ofType(state, "Boiler"), feeds) &&
  related(state, ofType(state, "Boiler"), ofType(state, "Brew group"), feeds);
const hasGrinderType = (state: TutorialModelState) =>
  related(state, type(state, "Grinder"), type(state, "Component"), { kind: "generalization" });

const LESSONS: TutorialLesson[] = [
  {
    id: "read-structure",
    title: "Read a structure",
    goal: "read from a relationship's name, kind and direction what it says",
    why:
      "A relationship is more than a line. Its direction says who does what to whom, its name says what, and its kind says what sort of connection it is. The metamodel Machine types uses two kinds besides the plain Association: Composition, for what a machine consists of, and Generalization, which says that a Pump is a Component.",
    steps: [
      {
        id: "open-composition",
        title: "Look inside a relationship",
        instruction:
          "You are in the metamodel Machine types. Double-click the relationship consists of, between Machine and Component, and look at its Label and its Relationship Type.",
        hint: "Double-click the line or its label. The filled diamond sits at the whole: a Machine consists of Components, not the other way round.",
        done: "Its type is Composition: the components are parts of the machine. An Association would only say that the two have something to do with each other. Press Cancel to close the editor.",
        scope: "metamodel",
        check: (state) => !!state.editingRelationship && same(state.editingRelationship.name, "consists of"),
        highlight: ['.react-flow__edge-textwrapper, .react-flow__edgelabel-renderer [class*="label"]', card("Machine")],
      },
      {
        id: "open-model",
        title: "Open the machine",
        instruction:
          "Open the model Espresso machine E1. Its diagram Structure shows what the machine consists of.",
        done: "E1 consists of four components. Each relationship is the Composition the metamodel defines, with its diamond at E1.",
        signal: "view-opened",
        scope: "instance",
      },
      {
        id: "open-pump",
        title: "Look at a component",
        instruction:
          "Double-click Vibration pump. Its type is Pump, and it has a pressure. Find the two attributes that Pump does not define itself.",
        hint: "part number and mass are defined on Component. In the metamodel, a hollow arrow leads from Pump to Component: a Pump is a Component.",
        done: "The pump has the attributes of a Pump and those of a Component, and the machine may consist of it although the metamodel only says that a Machine consists of Components. Both follow from the Generalization. Press Cancel to close the editor.",
        scope: "instance",
        check: (state) => editing(state, "Vibration pump"),
        highlight: [card("Vibration pump")],
      },
    ],
    question: {
      prompt: "What does the Composition from Machine to Component say that an Association would not?",
      options: [
        { text: "That the relationship has a name", feedback: "Any relationship can have a name. The kind says something else." },
        {
          text: "That the components are parts of the machine",
          correct: true,
          feedback: "Right. Composition is the whole-part relationship: the diamond is at the whole. An Association only connects.",
        },
        { text: "That a machine has exactly one component", feedback: "The kind says nothing about how many. E1 has four." },
      ],
    },
  },
  {
    id: "say-what-you-mean",
    title: "Say what a relationship means",
    goal: "name a relationship, choose its kind, and make one type a special case of another",
    why:
      "So far the metamodel says which component heats which, but not how the water gets from the boiler into the coffee. And the machine is about to get a grinder, which is a component like the others. Both are said with relationships: one that gets a name, and one that gets another kind.",
    steps: [
      {
        id: "draw-feeds",
        title: "Draw a second relationship",
        instruction:
          "Go back to Machine types. The Boiler heats the Brew group, and it also sends the water there. Draw a second relationship from Boiler to Brew group.",
        hint: "Drag from a handle on the Boiler card to the Brew group card. Use other handles than the relationship heats, for example the lower ones, so that the two lines do not lie on top of each other.",
        done: "Two relationships now lead from Boiler to Brew group. The new one has no name yet, so nobody can tell what it means.",
        scope: "metamodel",
        check: (state) => boilerToBrewGroup(state).length >= 2,
        highlight: [card("Boiler")],
      },
      {
        id: "name-feeds",
        title: "Name it",
        instruction:
          "Double-click the new relationship, enter feeds as its Label and press Apply.",
        hint: "The tutorial looks for a relationship from Boiler to Brew group named feeds. If you drew it the wrong way round, click it once and use the Reverse button that appears on it.",
        done: "The name is part of the definition. A model has to use it: between a boiler and a brew group it will offer heats and feeds, and nothing else.",
        scope: "metamodel",
        check: (state) => boilerToBrewGroup(state).some((relationship) => same(relationship.name, "feeds")),
        highlight: ['[data-testid="input-edge-label"]', card("Boiler")],
      },
      {
        id: "add-grinder-type",
        title: "Add the Grinder",
        instruction: "Add a new type of the kind Object and name it Grinder.",
        hint: "Drag Object from the Add elements tab, double-click the new card, change the name and press Apply.",
        done: "A Grinder exists, but the metamodel does not yet say that it is something a machine can consist of.",
        scope: "metamodel",
        check: (state) => type(state, "Grinder").length > 0,
        highlight: ['[data-testid="button-create-sidebar-partdef"]'],
      },
      {
        id: "generalize",
        title: "Make the Grinder a Component",
        instruction:
          "Draw a relationship from Grinder to Component. Then double-click it, choose Generalization as its Relationship Type and press Apply.",
        hint: "The direction is from the special to the general: start at Grinder. The hollow triangle then points at Component.",
        done: "A Grinder is a Component now. Without another line, a machine may consist of a grinder, and every grinder will have a part number and a mass.",
        scope: "metamodel",
        check: hasGrinderType,
        highlight: ['[data-testid="toggle-edge-type"]', card("Grinder")],
      },
      {
        id: "save-metamodel",
        title: "Save the metamodel",
        instruction: "Save Machine types.",
        done: "Saved. The model can use the new relationship and the new type.",
        signal: "saved",
        scope: "metamodel",
        check: (state) =>
          hasGrinderType(state) && boilerToBrewGroup(state).some((relationship) => same(relationship.name, "feeds")),
        highlight: [SAVE_DIAGRAM],
      },
    ],
    question: {
      prompt: "A Generalization leads from Grinder to Component. What does a Grinder get from it?",
      options: [
        { text: "Nothing: it is only a line in the diagram", feedback: "It has consequences: for what a grinder may be connected to, and for the attributes its elements get." },
        {
          text: "Component's relationships and attributes",
          correct: true,
          feedback: "Right. Wherever a Component is allowed in a relationship, a Grinder is too, and a new grinder starts with Component's attributes as well as its own.",
        },
        { text: "Component's name", feedback: "The types keep their names. A Grinder is a Component, it is not called one." },
      ],
    },
  },
  {
    id: "build-structure",
    title: "Build with what the metamodel allows",
    goal: "add an element whose type is a special case, and connect it through the general relationship",
    why:
      "The model can now say that E1 has a grinder. Nothing in the metamodel connects Machine with Grinder directly. The relationship consists of was defined once, for Component, and holds for everything that is a Component.",
    steps: [
      {
        id: "add-grinder",
        title: "Add a grinder to the machine",
        instruction:
          "Open Espresso machine E1 and add an element of the type Grinder. Open it and look at its attributes.",
        hint: "Drag Grinder from the Add elements tab and double-click the new card.",
        done: "The grinder starts with part number and mass. Grinder defines no attributes itself: both come from Component.",
        scope: "instance",
        view: "Structure",
        check: (state) => ofType(state, "Grinder").some((element) => attributeOf(element, "part number") !== undefined),
        highlight: [{ selector: '[data-testid^="button-insert-referenced-class-"]', text: "Grinder" }],
      },
      {
        id: "compose-grinder",
        title: "Make it a part of E1",
        instruction: "Draw a relationship from E1 to the grinder and confirm what Symlit suggests.",
        hint: "Start at E1: the machine consists of the grinder. The suggestion is consists of, as a Composition.",
        done: "Symlit suggested consists of, because a Grinder is a Component and a Machine consists of Components.",
        scope: "instance",
        view: "Structure",
        check: (state) => related(state, named(state, "E1"), ofType(state, "Grinder"), { kind: "composition" }),
        highlight: [card("E1")],
      },
      {
        id: "save-structure",
        title: "Save the diagram",
        instruction: "Save the diagram Structure.",
        done: "Saved. The machine has five components.",
        signal: "saved",
        scope: "instance",
        view: "Structure",
        check: (state) => related(state, named(state, "E1"), ofType(state, "Grinder"), { kind: "composition" }),
        highlight: [SAVE_DIAGRAM],
      },
    ],
    question: {
      prompt: "The machine gets a milk frother. What is the least the metamodel needs so that E1 can consist of one?",
      options: [
        { text: "A type Milk frother and a Composition from Machine to it", feedback: "That works, but the Composition is one line too many." },
        {
          text: "A type Milk frother with a Generalization to Component",
          correct: true,
          feedback: "Right. As a Component it is covered by the Composition that exists, and by every relationship added for components later.",
        },
        { text: "Nothing, any element can be connected to E1", feedback: "It can be drawn, but validation would report a relationship the metamodel does not allow." },
      ],
    },
  },
  {
    id: "second-diagram",
    title: "A second diagram",
    goal: "create a diagram and show elements in it that exist already",
    why:
      "Structure answers one question: what does the machine consist of? How the water flows is another question, with other relationships between the same components. Drawn into one diagram, both become unreadable. A project can have several diagrams, each for one question, and an element can appear in as many of them as needed.",
    steps: [
      {
        id: "create-diagram",
        title: "Create the diagram Water path",
        instruction:
          "Open the Diagrams tab in the sidebar, press Create view and name the new diagram Water path.",
        hint: "The tutorial looks for a diagram named Water path. The new diagram opens empty.",
        done: "An empty diagram in the same project. The components are not in it yet, and they must not be created a second time.",
        scope: "instance",
        check: (state) => state.diagrams.some((name) => same(name, "Water path")),
        highlight: ['[data-testid="button-create-view-sidebar"]', DIAGRAMS_TAB],
      },
      {
        id: "place-elements",
        title: "Show the existing components",
        instruction:
          "On the Diagrams tab, press the small arrow next to Structure (Show elements) to list its elements. Point at Water tank, Vibration pump, Boiler and Brew group in turn and press the arrow that appears, to insert each into this diagram.",
        hint: "The arrow next to an element says Insert into this diagram. It turns into a check mark once the element is here. Drag the cards into a row afterwards.",
        done: "The same four elements, shown a second time. Nothing was copied: open one and it has the values it has in Structure.",
        scope: "instance",
        view: "Water path",
        check: (state) =>
          ["Water tank", "Vibration pump", "Boiler", "Brew group"].every((name) => named(state, name).length > 0),
        highlight: ['[data-testid^="button-insert-node-"]', '[data-testid^="button-toggle-view-elements-"][data-view-name="Structure"]', DIAGRAMS_TAB],
      },
      {
        id: "connect-path",
        title: "Connect the water path",
        instruction:
          "Draw the path of the water: from Water tank to Vibration pump, from there to Boiler, and from Boiler to Brew group. Confirm feeds each time; between Boiler and Brew group, choose it from the two that are offered.",
        hint: "Between a boiler and a brew group the metamodel allows heats and feeds, so Symlit shows a small list instead of one suggestion. Pick feeds and confirm with the check mark.",
        done: "Three relationships that exist only in this diagram. In Structure the same elements are connected by consists of, and by nothing else.",
        scope: "instance",
        view: "Water path",
        check: pathIsConnected,
        highlight: [card("Water tank")],
      },
      {
        id: "save-path",
        title: "Save the diagram",
        instruction: "Save the diagram Water path.",
        done: "Saved. The project has two diagrams of one model.",
        signal: "saved",
        scope: "instance",
        view: "Water path",
        check: pathIsConnected,
        highlight: [SAVE_DIAGRAM],
      },
    ],
    question: {
      prompt: "The pump is shown in Structure and in Water path. How many pumps does the model contain?",
      options: [
        { text: "Two, one per diagram", feedback: "Inserting an element shows it again; it does not create another one." },
        {
          text: "One, shown in two diagrams",
          correct: true,
          feedback: "Right. A diagram is a view of the model. The element is stored once, however often it is shown.",
        },
        { text: "None: diagrams contain pictures, not elements", feedback: "The cards are the elements. Diagrams differ in which elements they show and how they connect them." },
      ],
    },
  },
  {
    id: "one-element",
    title: "One element, two diagrams",
    goal: "change an element once and find the change wherever the element is shown",
    why:
      `The vibration pump is to be replaced by a quieter rotary pump. If the pump were drawn twice, both drawings would have to be found and changed, and one day one would be forgotten. Because it is one element, the change is made once. And the two diagrams together answer the question: ${QUESTION}`,
    steps: [
      {
        id: "rename-pump",
        title: "Replace the pump",
        instruction:
          "In Water path, rename Vibration pump to Rotary pump: select it and press F2, or open its editor. Then save the diagram.",
        hint: "F2 lets you type the new name on the card; Enter confirms. The tutorial looks for the name Rotary pump.",
        done: "Renamed and saved in the diagram Water path.",
        scope: "instance",
        view: "Water path",
        check: (state) => named(state, "Rotary pump").length > 0 && !state.dirty,
        highlight: [card("Vibration pump")],
      },
      {
        id: "see-in-structure",
        title: "Find the change in Structure",
        instruction: "Open the diagram Structure and look at the pump.",
        hint: "The Diagrams tab lists the project's diagrams. The coach's button opens it too.",
        done: "It is called Rotary pump here as well. You did not change two drawings: you changed one element, and both diagrams show it.",
        scope: "instance",
        view: "Structure",
        check: (state) => named(state, "Rotary pump").length > 0,
      },
      {
        id: "read-answer",
        title: "Read what the pump is connected to",
        instruction:
          "Go back to Water path and switch to Table. The Relationships table below the elements lists what leads to the pump and away from it.",
        done: "In Water path the pump is fed by the Water tank and feeds the Boiler. In Structure it is a part of E1. Those are the places a new pump has to fit.",
        signal: "table-mode",
        scope: "instance",
        view: "Water path",
        check: (state) => named(state, "Rotary pump").length > 0,
        highlight: ['[data-testid="button-toolbar-table"]'],
      },
    ],
    question: {
      prompt: "In Water path the Boiler feeds the Brew group. Is that relationship visible in Structure?",
      options: [
        { text: "Yes, relationships follow their elements into every diagram", feedback: "Elements are shared between diagrams; relationships are drawn in one diagram and belong to it." },
        {
          text: "No, a relationship belongs to the diagram it was drawn in",
          correct: true,
          feedback: "Right. That is what lets two diagrams tell two stories about the same elements: one about parts, one about water.",
        },
        { text: "Only after saving", feedback: "Saving stores a diagram. It does not copy its relationships into others." },
      ],
    },
  },
  {
    id: "on-your-own",
    title: "On your own",
    goal: "extend a metamodel and show the result in two diagrams of its model",
    why:
      "The machine gets a steam wand for frothing milk. It is a component, and it gets its steam from the boiler. This time only the result is given. Everything you need was in the lessons before; the hints say where.",
    steps: [
      {
        id: "own-type",
        title: "Define the Steam wand",
        instruction:
          "In Machine types: add a type Steam wand that is a Component, let the Boiler feed it, and save.",
        hint: "A type of the kind Object, a Generalization from Steam wand to Component, and a relationship from Boiler to Steam wand named feeds. See lesson 2.",
        done: "The metamodel knows what a steam wand is and where its steam comes from.",
        scope: "metamodel",
        check: (state) =>
          related(state, type(state, "Steam wand"), type(state, "Component"), { kind: "generalization" }) &&
          related(state, type(state, "Boiler"), type(state, "Steam wand"), feeds) &&
          !state.dirty,
      },
      {
        id: "own-part",
        title: "Make it a part of E1",
        instruction: "In the diagram Structure of Espresso machine E1: add a steam wand and make it a part of E1. Save.",
        hint: "An element of the type Steam wand, and a relationship from E1 to it. See lesson 3.",
        done: "E1 consists of six components.",
        scope: "instance",
        view: "Structure",
        check: (state) =>
          related(state, named(state, "E1"), ofType(state, "Steam wand"), { kind: "composition" }) && !state.dirty,
      },
      {
        id: "own-path",
        title: "Show where its steam comes from",
        instruction: "In the diagram Water path: show the same steam wand and let the Boiler feed it.",
        hint: "Insert the existing element from the element list of Structure, do not create a second one. See lesson 4.",
        done: "The steam wand is one element in two diagrams: a part of the machine, and fed by the boiler.",
        scope: "instance",
        view: "Water path",
        check: (state) => related(state, ofType(state, "Boiler"), ofType(state, "Steam wand"), feeds),
      },
      {
        id: "own-validate",
        title: "Check the diagram",
        instruction: "Validate Water path. Fix whatever is reported until there are no issues, then save.",
        hint: "A relationship drawn against the metamodel's direction is reported: select it and use Reverse.",
        done: "Everything in the diagram is something the metamodel allows.",
        signal: "validation-passed",
        scope: "instance",
        view: "Water path",
        check: (state) => related(state, ofType(state, "Boiler"), ofType(state, "Steam wand"), feeds),
        highlight: [VALIDATE],
      },
    ],
  },
];

export const STRUCTURE_TUTORIAL: TutorialDefinition = {
  id: "structure",
  templateId: "tutorial-structure",
  title: "Structure and views",
  question: QUESTION,
  answer:
    "Three places: the water tank that feeds it, the boiler it feeds, and E1, which it is a part of. Two diagrams showed them, and because the pump is one element in both, replacing it was one change.",
  answerStep: "read-answer",
  summary:
    "An espresso machine is described twice: by what it consists of, and by the path the water takes. You read and write relationships with a name, a kind and a direction, make one type a special case of another, add a second diagram, and show the same elements in both, so that a change is made once.",
  prerequisite: "Builds on Symlit basics.",
  minutes: 30,
  projects: { metamodel: "Machine types", instance: "Espresso machine E1" },
  finishedTitle: "You described one model in two diagrams",
  lessons: LESSONS,
  notCovered: [
    "Aggregation, Dependency and Realization, the other relationship kinds",
    "Multiplicity on a relationship: shown on the line, not checked",
    "Styling a relationship: thickness, line style, colour",
    "Diagrams in a metamodel: a metamodel can have several, too",
  ],
};
