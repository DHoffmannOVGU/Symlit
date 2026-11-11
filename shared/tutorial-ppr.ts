/**
 * The PPR tutorial: modelling production as products, processes and
 * resources, starting from the requirements. It creates a metamodel
 * ("PPR types") and a model ("Bracket production") that uses it
 * (server/templates/tutorial-ppr.json).
 *
 * PPR separates what is made (product), what is done (process) and what does
 * it (resource). Products go into processes and come out of them; resources
 * execute processes. The tutorial adds requirements to that and traces each
 * of them to the product, process or resource that satisfies it. The model
 * starts incomplete on purpose, and the learner closes the gaps in the order
 * an engineer would: requirement, then product, then process, then resource.
 *
 * It builds on the basics tutorial: steps say what to achieve, not where to click.
 */
import {
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
  type TutorialElement,
  type TutorialLesson,
  type TutorialModelState,
} from "./tutorial-types";

const QUESTION = "Can the workshop produce the bracket the customer asked for?";

/** What the model starts with. */
const STARTING_REQUIREMENTS = ["Carries 5 kg", "Corrosion protection"];
const STARTING_PROCESSES = ["Laser cutting"];

const isOneOf = (names: string[], element: TutorialElement) => names.some((name) => same(name, element.name));

/** Requirements the learner added. */
const ownRequirements = (state: TutorialModelState) =>
  ofType(state, "Requirement").filter((element) => !isOneOf(STARTING_REQUIREMENTS, element));

/** A process is complete when a product goes in, a product comes out and a resource executes it. */
const transforms = (state: TutorialModelState, process: TutorialElement) =>
  related(state, ofType(state, "Product"), [process]) && related(state, [process], ofType(state, "Product"));
const executed = (state: TutorialModelState, process: TutorialElement) =>
  related(state, ofType(state, "Resource"), [process]);
const satisfied = (state: TutorialModelState, requirement: TutorialElement) =>
  state.relationships.some((relationship) => relationship.to === requirement.id);

const processRule = (state: TutorialModelState) =>
  state.rules.some((rule) => rule.reportsIssue && rule.connected && same(rule.target, "Process"));

const LESSONS: TutorialLesson[] = [
  {
    id: "ppr-view",
    title: "Product, process, resource",
    goal: "say what a product, a process and a resource are, and read how they are connected",
    why:
      "PPR describes production with three kinds of things. Products are what is made: raw material, intermediate parts, the finished part. Processes are what is done to them. Resources are the machines, tools and people that do it. Kept apart, each can change on its own: the same product on another machine, the same machine for another product.",
    steps: [
      {
        id: "open-process-type",
        title: "Look at the Process type",
        instruction:
          "You are in the metamodel PPR types. Look at how the three types are connected, then double-click Process to open it.",
        hint: "Read the relationships as sentences: a Product goes into a Process, a Process produces a Product, a Resource executes a Process. The hollow arrows say that all three are PPR elements.",
        done: "A Process is something that is done, so its kind is Behavior. A Product is an Object, a Resource a Performer. Every process will have a cycle time. Press Cancel to close the editor.",
        scope: "metamodel",
        check: (state) => editing(state, "Process"),
        highlight: [{ selector: ELEMENT_CARD, text: "Process" }],
      },
      {
        id: "open-model",
        title: "Open the production model",
        instruction:
          "Open Bracket production. It describes how a shelf bracket is made, as far as it has been worked out.",
        done: "Each card shows its type in the corner. Requirements are at the top; below them, the chain from raw material towards the bracket.",
        signal: "view-opened",
        scope: "instance",
      },
      {
        id: "read-chain",
        title: "Read one production step",
        instruction:
          "Find the process Laser cutting and read the three relationships around it. Then double-click Laser cutting to open it.",
        done: "Steel sheet goes into Laser cutting, Laser cutting produces the Blank, and the Laser cutter executes it. That is one complete PPR step: product in, process, product out, resource. Press Cancel to close the editor.",
        scope: "instance",
        check: (state) => editing(state, "Laser cutting"),
        highlight: [{ selector: ELEMENT_CARD, text: "Laser cutting" }],
      },
    ],
    question: {
      prompt: "A robot welds two parts into a frame. What is the welding?",
      options: [
        { text: "A product", feedback: "The two parts and the frame are the products: what goes in and what comes out." },
        { text: "A process", correct: true, feedback: "Right. Welding is what is done. The parts and the frame are products, the robot is the resource." },
        { text: "A resource", feedback: "The robot is the resource. Welding is what the robot does." },
      ],
    },
  },
  {
    id: "requirements",
    title: "Start from the requirements",
    goal: "state a requirement so that it can be checked, and trace it to what has to satisfy it",
    why:
      "Production planning starts with what is asked for, not with machines. A requirement is useful when it says how to tell that it is met, and when the model shows what is responsible for meeting it. That link is called a trace. PPR types has a Requirement type, but no way yet to connect it to products, processes and resources.",
    steps: [
      {
        id: "relate-satisfies",
        title: "Let PPR elements satisfy requirements",
        instruction:
          "In PPR types, draw a relationship from PPR element to Requirement.",
        hint: "Drag from a handle on the PPR element card to the Requirement card. You can double-click the new relationship and name it satisfies.",
        done: "One relationship is enough. Product, Process and Resource are PPR elements (the hollow arrows are Generalizations), so each of them may now satisfy a requirement.",
        scope: "metamodel",
        check: (state) => related(state, named(state, "PPR element"), named(state, "Requirement")),
        highlight: [{ selector: ELEMENT_CARD, text: "PPR element" }],
      },
      {
        id: "save-metamodel",
        title: "Save the metamodel",
        instruction: "Save PPR types, so that the production model can use the new relationship.",
        done: "Saved. The model may now contain traces.",
        signal: "saved",
        scope: "metamodel",
        check: (state) => related(state, named(state, "PPR element"), named(state, "Requirement")),
        highlight: [SAVE_DIAGRAM],
      },
      {
        id: "trace-load",
        title: "Trace an existing requirement",
        instruction:
          "In Bracket production, open the requirement Carries 5 kg and read its criterion. Then draw a relationship from the product Bracket to Carries 5 kg and confirm it.",
        hint: "The direction says who is responsible: the Bracket satisfies the requirement, so start at Bracket.",
        done: "The model now says that the Bracket has to carry the load. The requirement has an owner.",
        scope: "instance",
        check: (state) => related(state, named(state, "Bracket"), named(state, "Carries 5 kg")),
        highlight: [{ selector: ELEMENT_CARD, text: "Carries 5 kg" }],
      },
      {
        id: "add-requirement",
        title: "Capture a new requirement",
        instruction:
          "The customer adds: the bracket has to fit into the corner between wall and shelf. Add a Requirement named Mounting angle and fill in its criterion, for example 90 degrees, plus or minus 1.",
        hint: "Drag Requirement from the Add elements tab, double-click it, set the name and the criterion and press Save Changes. A criterion with a number and a tolerance can be measured; \"fits well\" cannot.",
        done: "A requirement with a criterion can be checked on the finished part. Without one, nobody can say whether it is met.",
        scope: "instance",
        check: (state) => ownRequirements(state).some((element) => hasValue(element, "criterion")),
        highlight: [{ selector: '[data-testid^="button-insert-referenced-class-"]', text: "Requirement" }],
      },
      {
        id: "trace-new",
        title: "Trace the new requirement",
        instruction: "Say what has to satisfy Mounting angle: draw a relationship from Bracket to it.",
        done: "The Bracket now has to have a 90 degree angle. The model does not yet say how it gets one: nothing produces the Bracket. That is the next lesson.",
        scope: "instance",
        check: (state) => related(state, ofType(state, "Product"), ownRequirements(state)),
        highlight: [{ selector: ELEMENT_CARD, text: "Bracket" }],
      },
    ],
    question: {
      prompt: "A requirement says: one bracket takes at most 60 seconds to make. What should satisfy it?",
      options: [
        { text: "The product Bracket", feedback: "The time is not a property of the bracket itself but of how it is made." },
        {
          text: "The processes",
          correct: true,
          feedback: "Right. It is a requirement on how the bracket is made, so the processes and their cycle times have to satisfy it.",
        },
        { text: "Another requirement", feedback: "Requirements are satisfied by products, processes or resources, not by each other." },
      ],
    },
  },
  {
    id: "derive-process",
    title: "Derive the process",
    goal: "derive a process from a product requirement and place it between the product that goes in and the product that comes out",
    why:
      "A product requirement leads to a process: the bracket needs a 90 degree angle, the Blank is flat, so something has to bend it. In PPR a process is defined by its products: what goes in and what comes out. A process without both is not finished.",
    steps: [
      {
        id: "add-process",
        title: "Add the Bending process",
        instruction:
          "Add a Process named Bending and give it a cycle time, for example 15.",
        hint: "Drag Process from the Add elements tab, double-click it, set the name and the value and press Save Changes. The tutorial looks for a process named exactly Bending.",
        done: "Bending exists, but it is not connected to any product yet.",
        scope: "instance",
        check: (state) =>
          named(state, "Bending").some((element) => same(element.type, "Process") && hasValue(element, "cycle time")),
        highlight: [{ selector: '[data-testid^="button-insert-referenced-class-"]', text: "Process" }],
      },
      {
        id: "process-input",
        title: "Say what goes in",
        instruction: "The flat Blank is what gets bent: draw a relationship from Blank to Bending and confirm it.",
        hint: "Products go into processes: start at the product, end on the process.",
        done: "The Blank goes into Bending.",
        scope: "instance",
        check: (state) => related(state, named(state, "Blank"), named(state, "Bending")),
        highlight: [{ selector: ELEMENT_CARD, text: "Blank" }],
      },
      {
        id: "process-output",
        title: "Say what comes out",
        instruction: "Bending turns the Blank into the Bracket: draw a relationship from Bending to Bracket and confirm it.",
        hint: "Processes produce products: start at the process, end on the product.",
        done: "The chain is closed: Steel sheet, Laser cutting, Blank, Bending, Bracket. The model now says how the Bracket comes into being.",
        scope: "instance",
        check: (state) => related(state, named(state, "Bending"), named(state, "Bracket")),
        highlight: [{ selector: ELEMENT_CARD, text: "Bending" }],
      },
    ],
    question: {
      prompt: "Why does a process need a product going in and a product coming out?",
      options: [
        {
          text: "A process is a transformation: its products say what it changes",
          correct: true,
          feedback: "Right. Bending is only defined by turning a Blank into a Bracket. Without both, the model cannot say what the process is for.",
        },
        { text: "Symlit does not allow elements without relationships", feedback: "It does. The reason is in the method, not in the tool." },
        { text: "So that the process has a resource", feedback: "The resource is a third relationship: who executes the process. That comes next." },
      ],
    },
  },
  {
    id: "check-completeness",
    title: "Check completeness",
    goal: "let rules about relationships find what is missing in a PPR model",
    why:
      `Whether the workshop can produce the bracket is a question of completeness: is every requirement satisfied by something, and can every process be carried out? Such questions are about relationships, and model rules can check them. That is how this model answers the question: ${QUESTION}`,
    steps: [
      {
        id: "validate",
        title: "Validate the model",
        instruction: "Press Validate and read what is reported.",
        done: "A rule reports Corrosion protection: nothing satisfies it. Leave it for now; it is the task of the last lesson.",
        signal: "validation-run",
        scope: "instance",
        highlight: [VALIDATE],
      },
      {
        id: "open-rules",
        title: "Read the rule that fired",
        instruction:
          "Open Model rules and read the rule Every requirement is satisfied: for Requirement, when no element is connected by an incoming relationship, report an issue.",
        done: "This rule does not compare a value. It looks at relationships: a requirement nothing points at has no owner.",
        signal: "rules-opened",
        scope: "instance",
        highlight: ['[data-testid="button-model-rules"]'],
      },
      {
        id: "add-rule",
        title: "Write the rule for processes",
        instruction:
          "Add a rule named Every process has a resource. Elements: Process. Condition: Incoming from · none · Resource · Name · is set. Then: report an issue, with a message such as No resource executes this process. Save the rules.",
        hint: "In the condition row, change This object to Incoming from; three more lists appear. Set them to none, Resource and Name, and the comparison to is set. In the Then row, switch to report an issue. The panel has its own Save.",
        done: "Your rule reads: a process that no Resource points at is reported. The Live results on the right already show which process that is.",
        scope: "instance",
        check: processRule,
        highlight: ['[data-testid="button-add-rule"]', '[data-testid="button-model-rules"]'],
      },
      {
        id: "validate-rule",
        title: "Validate with your rule",
        instruction: "Close the rules panel and validate again.",
        hint: "If Bending is not reported, compare your rule with: Incoming from · none · Resource · Name · is set.",
        done: "Bending is reported: no resource executes it. The bracket is planned, but nobody can bend it yet. Laser cutting passes, because the Laser cutter executes it.",
        signal: "validation-run",
        scope: "instance",
        check: processRule,
        highlight: [VALIDATE],
      },
    ],
    question: {
      prompt: "Which gap does the rule Every process has a resource find?",
      options: [
        { text: "A requirement that nothing satisfies", feedback: "That is what the other rule, Every requirement is satisfied, finds." },
        { text: "A process that nobody can carry out", correct: true, feedback: "Right. A process without a resource is a plan without the means to do it." },
        { text: "A machine that is not used", feedback: "That would be the opposite rule: for Resource, when it executes no Process." },
      ],
    },
  },
  {
    id: "assign-resource",
    title: "Assign the resource",
    goal: "assign a resource to a process and see the model confirm it",
    why:
      "The process says what has to be done; the resource says who or what does it. Because they are separate elements, a process can be planned before the machine is chosen, and a machine can be replaced without touching the process or the product.",
    steps: [
      {
        id: "add-resource",
        title: "Add a resource for bending",
        instruction: "Add a Resource for the Bending process, for example a Press brake, and give it an hourly rate.",
        hint: "Drag Resource from the Add elements tab, double-click it, set the name and the value and press Save Changes.",
        done: "The workshop has a machine that could bend. The model does not say yet that it does.",
        scope: "instance",
        check: (state) =>
          ofType(state, "Resource").some((element) => !same(element.name, "Laser cutter") && hasValue(element, "hourly rate")),
        highlight: [{ selector: '[data-testid^="button-insert-referenced-class-"]', text: "Resource" }],
      },
      {
        id: "assign-resource",
        title: "Let it execute the process",
        instruction: "Draw a relationship from the new resource to Bending and confirm it.",
        hint: "Resources execute processes: start at the resource, end on the process.",
        done: "Bending is a complete PPR step now: Blank in, Bracket out, executed by your resource.",
        scope: "instance",
        check: (state) => named(state, "Bending").some((process) => executed(state, process)),
        highlight: [{ selector: ELEMENT_CARD, text: "Bending" }],
      },
      {
        id: "validate-resource",
        title: "Validate again",
        instruction: "Validate and check that Bending is no longer reported.",
        done: "Your rule passes for every process. One issue is left: Corrosion protection is still not satisfied.",
        signal: "validation-run",
        scope: "instance",
        check: (state) => named(state, "Bending").some((process) => executed(state, process)),
        highlight: ['[data-testid="button-validate-again"]', VALIDATE],
      },
    ],
    question: {
      prompt: "The workshop replaces the press brake with a newer one. What changes in the model?",
      options: [
        { text: "The product Bracket", feedback: "The bracket stays the same part with the same requirements." },
        { text: "The process Bending", feedback: "Bending still turns a Blank into a Bracket. At most its cycle time changes." },
        {
          text: "Only the resource",
          correct: true,
          feedback: "Right. That is the point of keeping product, process and resource apart: each can change on its own.",
        },
      ],
    },
  },
  {
    id: "close-the-gap",
    title: "Close the last gap",
    goal: "take a requirement through product, process and resource on your own",
    why:
      "Corrosion protection is still open. This time only the result is given. Work in the order of the lessons before: what has to satisfy the requirement, which process brings that about, which products go in and come out, and which resource executes it.",
    steps: [
      {
        id: "own-process",
        title: "Add the missing process",
        instruction:
          "Add a process that protects the bracket against corrosion, for example Powder coating, with the product that goes in and the product that comes out.",
        hint: "The Bracket goes in. What comes out is a different product, for example a Coated bracket: add it as a Product. See lesson 3.",
        done: "The production chain is one step longer, and there is a new product at its end.",
        scope: "instance",
        check: (state) =>
          ofType(state, "Process").some(
            (process) => !isOneOf([...STARTING_PROCESSES, "Bending"], process) && transforms(state, process),
          ),
      },
      {
        id: "own-resource",
        title: "Assign its resource",
        instruction: "Add the resource that executes your new process, and connect it.",
        hint: "For example a Coating booth. Your rule from lesson 4 tells you when a process has no resource. See lesson 5.",
        done: "Every process in the model can be carried out.",
        scope: "instance",
        check: (state) =>
          ofType(state, "Process").length >= 3 && ofType(state, "Process").every((process) => executed(state, process)),
      },
      {
        id: "own-trace",
        title: "Trace the requirement",
        instruction: "Decide what satisfies Corrosion protection, and draw the trace.",
        hint: "The coated product, or the coating process: either is a defensible answer. See lesson 2.",
        done: "Every requirement has an owner.",
        scope: "instance",
        check: (state) =>
          ofType(state, "Requirement").length >= 3 &&
          ofType(state, "Requirement").every((requirement) => satisfied(state, requirement)),
      },
      {
        id: "own-validate",
        title: "Let the model answer",
        instruction: "Validate. Fix whatever is reported until there are no issues, then save the diagram.",
        hint: "A relationship the metamodel does not allow is reported as well: products go into processes, processes produce products, resources execute processes, and PPR elements satisfy requirements.",
        done: "No issues: every requirement is satisfied, every process has its products and a resource.",
        signal: "validation-passed",
        scope: "instance",
        check: (state) =>
          ofType(state, "Process").length >= 3 &&
          ofType(state, "Process").every((process) => executed(state, process)) &&
          ofType(state, "Requirement").every((requirement) => satisfied(state, requirement)),
      },
    ],
  },
];

export const PPR_TUTORIAL: TutorialDefinition = {
  id: "ppr",
  templateId: "tutorial-ppr",
  title: "Production with PPR",
  question: QUESTION,
  answer:
    "Yes: every requirement is satisfied by a product or a process, every process turns one product into another, and a resource executes each of them. Your rules keep checking that.",
  answerStep: "own-validate",
  summary:
    "Model how a shelf bracket is made, the way production engineers do: products, processes and resources (PPR), starting from the customer's requirements. You trace each requirement to what satisfies it, derive the missing process, assign its resource, and write a rule that finds what is still missing.",
  prerequisite: "Builds on Symlit basics: steps say what to achieve, not where to click.",
  minutes: 30,
  projects: { metamodel: "PPR types", instance: "Bracket production" },
  finishedTitle: "You planned a production with PPR, from requirement to resource",
  lessons: LESSONS,
  notCovered: [
    "Capabilities: describing what a resource can do, and matching that with what a process needs",
    "Process requirements with numbers, such as a total cycle time, checked by rules on attribute values",
    "Product structure: assemblies and their parts, with Composition",
    "Several diagrams of the same model, for example one per production line",
  ],
};
