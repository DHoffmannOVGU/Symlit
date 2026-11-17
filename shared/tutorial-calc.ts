/**
 * The tutorial on calculated attributes. It creates a metamodel ("Quote
 * types") and a model ("Orders in May") that uses it
 * (server/templates/tutorial-calc.json): the print jobs of a small
 * 3D-printing service, one of which loses money without anyone having noticed.
 *
 * A formula sees only the attributes of its own element, so the example is one
 * where every number belongs to one thing: a job's mass, time, price and cost.
 * The learner writes the formulas once, on the type, sees every job calculate
 * its own result, and lets a rule on the calculated margin answer the question.
 *
 * It builds on the basics tutorial: steps name the result and the values,
 * not every click.
 */
import {
  attributeOf,
  calculatedFrom,
  calculates,
  comparesWith,
  editing,
  ELEMENT_CARD,
  named,
  numberOf,
  ofType,
  same,
  SAVE_DIAGRAM,
  VALIDATE,
  type TutorialDefinition,
  type TutorialElement,
  type TutorialLesson,
  type TutorialModelState,
} from "./tutorial-types";

const QUESTION = "Which print job loses money?";

const ADD_ATTRIBUTE = '[data-testid="button-add-attribute"]';
const JOB_TYPE = { selector: ELEMENT_CARD, text: "Print job" };

/** The type Print job, in the metamodel. */
const jobType = (state: TutorialModelState) => named(state, "Print job")[0];
const jobs = (state: TutorialModelState) => ofType(state, "Print job");
const typeCalculates = (state: TutorialModelState, name: string, from: string[]) => {
  const type = jobType(state);
  return !!type && calculatedFrom(type, name, from);
};
const hasNumber = (element: TutorialElement, name: string) => numberOf(element, name) !== null;
/** The type calculates the attribute as the step asks, however the formula is written: [inputs, result] pairs. */
const typeGives = (state: TutorialModelState, name: string, cases: Array<[Record<string, number>, number]>) => {
  const type = jobType(state);
  return !!type && calculates(type, name, cases);
};
/** price - total cost, not the other way round: a job that loses money has a negative margin. */
const marginIsRight = (state: TutorialModelState) =>
  typeGives(state, "margin", [
    [{ price: 10, "total cost": 4 }, 6],
    [{ price: 3, "total cost": 5 }, -2],
  ]);
/** The rate of lesson 2, and its name after lesson 3 renames it. */
const RATE = "machine rate";
const RENAMED_RATE = "hourly rate";
/** print time × rate, under either name of the rate. */
const machineCostIsRight = (state: TutorialModelState) =>
  typeGives(state, "machine cost", [
    [{ "print time": 3, [RATE]: 4, [RENAMED_RATE]: 4 }, 12],
    [{ "print time": 2, [RATE]: 5, [RENAMED_RATE]: 5 }, 10],
  ]);
const NEW_JOB = (job: TutorialElement) => !["Phone stand", "Gear housing", "Cable clip"].some((name) => same(name, job.name));

/** The learner's rule: a print job whose margin is below zero is reported. */
const marginRule = (state: TutorialModelState) =>
  state.rules.some(
    (rule) => rule.reportsIssue && same(rule.target, "Print job") && comparesWith(rule, "margin", ["less-than"]) === 0,
  );

const LESSONS: TutorialLesson[] = [
  {
    id: "attribute-types",
    title: "Attributes have types",
    goal: "tell the attribute types apart and fill in a number, a choice from a list and a Yes/No value",
    why:
      "To find the print job that loses money, its cost has to be worked out from what is known about it: what it is made of, how heavy it is, how long it prints, what the customer pays. Each of these is an attribute, and its type decides how the value is entered and what can be done with it later: only numbers can be calculated with.",
    steps: [
      {
        id: "open-job-type",
        title: "Look at the attributes of a print job",
        instruction:
          "You are in the metamodel Quote types. Double-click the type Print job and read its five attributes: each line shows the name and, in grey, the type.",
        hint: "material is a List: one of PLA, PETG or ABS. rush order is Yes/No. mass, print time and price are Numbers, each with a unit.",
        done: "Five attributes, three types: a List for a choice between fixed options, Yes/No for a fact that is true or not, Number for a quantity with a unit. Press Cancel to close the editor.",
        scope: "metamodel",
        check: (state) => editing(state, "Print job"),
        highlight: [JOB_TYPE],
      },
      {
        id: "open-model",
        title: "Open the orders",
        instruction: "Open the model Orders in May: two customers and the print jobs they ordered.",
        done: "Three print jobs. Phone stand and Gear housing are filled in; Cable clip came in this morning.",
        signal: "view-opened",
        scope: "instance",
      },
      {
        id: "fill-job",
        title: "Fill in the new job",
        instruction:
          "First guess: could you type petg into material? Then double-click Cable clip and fill it in: material PETG, mass 20, print time 1, price 6, and the customer needs it tomorrow: rush order Yes. Press Apply, then Save at the top right.",
        hint: "material is chosen from its list, the numbers are typed, and rush order is a switch. The units (g, h, €) come from the type and are shown next to the values. Apply puts the values into the diagram; Save stores the diagram.",
        done: "Each type of attribute has its own way of being entered. Because material is a list, nobody can write PET-G or petg by mistake, and a rule can rely on the three spellings that exist.",
        scope: "instance",
        // Later lessons calculate with these numbers: they have to be the ones given.
        check: (state) =>
          named(state, "Cable clip").some(
            (job) =>
              same(attributeOf(job, "material")?.value ?? "", "PETG") &&
              numberOf(job, "mass") === 20 &&
              numberOf(job, "print time") === 1 &&
              numberOf(job, "price") === 6 &&
              attributeOf(job, "rush order")?.value === "true",
          ) && !state.dirty,
        highlight: [{ selector: ELEMENT_CARD, text: "Cable clip" }],
      },
    ],
    question: {
      prompt: "Filament comes in black, white or red. Which attribute type fits the colour?",
      options: [
        { text: "Text", feedback: "Text accepts anything, also Black, blak and dark. A rule or a filter cannot rely on it." },
        { text: "List", correct: true, feedback: "Right. A fixed set of choices is a list: quick to enter and always spelled the same." },
        { text: "Yes/No", feedback: "Yes/No has two states. Three colours need a list." },
      ],
    },
  },
  {
    id: "first-formula",
    title: "A first formula",
    goal: "give a type a default value and an attribute that is calculated from others",
    why:
      "What does a job cost to make? The printer costs 4 € for every hour it runs, so the machine cost is the print time multiplied by that rate. Nobody should work this out by hand for every job. An attribute of the type Derived Formula calculates it, and because it is defined on the type, every print job gets it.",
    steps: [
      {
        id: "add-rate",
        title: "Add the machine rate, with a default",
        instruction:
          "Go back to Quote types and open Print job. Add an attribute named machine rate (a Number) and give it the default value 4. Press Add attribute, then Apply.",
        hint: "Pick a unit if you like: search the unit list, or type your own, such as €/h. The default value is what every new print job starts with; a single job can still change it.",
        done: "Every new print job will start with a machine rate of 4. A default saves typing a value that is nearly always the same.",
        scope: "metamodel",
        // Lesson 3 renames the rate to hourly rate: a step skipped here can still be done after that.
        check: (state) =>
          !!jobType(state) && [RATE, RENAMED_RATE].some((name) => numberOf(jobType(state), name) === 4),
        highlight: [ADD_ATTRIBUTE, JOB_TYPE],
      },
      {
        id: "add-machine-cost",
        title: "Calculate the machine cost",
        instruction:
          "Open Print job again and add an attribute named machine cost. Set its Type to Derived Formula and enter the formula [print time] * [machine rate]. First guess: what can the type calculate, when no print time is filled in on it? Look at the Calculated Value, then press Add attribute and Apply.",
        hint: "Other attributes are referred to by their name in square brackets; typing [ offers the names. A formula can use + - * / and parentheses, numbers written with a point (0.5), and functions such as max or round.",
        done: "The Calculated Value says it cannot be calculated yet: the type has no print time. That is as it should be. The type holds the formula; each job will supply its own print time.",
        scope: "metamodel",
        check: machineCostIsRight,
        highlight: [ADD_ATTRIBUTE, JOB_TYPE],
      },
      {
        id: "save-first",
        title: "Save the metamodel",
        instruction: "Press Save at the top right, or Ctrl+S.",
        done: "Saved. The formula is part of what a print job is.",
        signal: "saved",
        scope: "metamodel",
        check: machineCostIsRight,
        highlight: [SAVE_DIAGRAM],
      },
    ],
    question: {
      prompt: "Why is the formula defined on the type Print job and not on each job?",
      options: [
        {
          text: "Written once, every print job calculates its own result with it",
          correct: true,
          feedback: "Right. The type says how the machine cost is calculated; each job fills in its own numbers.",
        },
        { text: "Formulas only work on types", feedback: "A single element can have a formula too. It would then be that element's alone." },
        { text: "So that all jobs have the same machine cost", feedback: "They share the formula, not the result: each job has its own print time." },
      ],
    },
  },
  {
    id: "formula-chain",
    title: "Formulas build on formulas",
    goal: "break a calculation into steps, where one calculated attribute uses another",
    why:
      "The machine is not the only cost. The material costs by weight, and what matters in the end is what is left of the price. Each of these is a small formula. A formula may refer to an attribute that is itself calculated, so a calculation is built up in steps that can each be read and checked.",
    steps: [
      {
        id: "rename-rate",
        title: "Rename an input",
        instruction:
          "First guess: machine cost refers to machine rate. If machine rate gets another name, does machine cost still work? Open Print job, click machine rate in the attribute list, rename it to hourly rate and press Apply. Then look at the formula of machine cost.",
        hint: "Clicking an attribute's line opens it; its name is at the top. Press Done, then Apply.",
        done: "machine cost now reads [print time] * [hourly rate]. A formula refers to the attribute itself, not to its name, so renaming is safe. Deleting an input is not: the formula would have nothing to calculate with.",
        scope: "metamodel",
        check: (state) =>
          !!jobType(state) &&
          !attributeOf(jobType(state), RATE) &&
          typeCalculates(state, "machine cost", ["print time", RENAMED_RATE]),
        highlight: ['[data-testid^="button-attr-open-"]', JOB_TYPE],
      },
      {
        id: "add-material-cost",
        title: "Calculate the material cost",
        instruction:
          "On Print job, add a Number attribute material price (the price of a kilogram of filament). Then add a Derived Formula attribute material cost with the formula [mass] / 1000 * [material price]. Apply.",
        hint: "The mass is in grams and the price is per kilogram, so the mass is divided by 1000. Units are not converted for you: a formula calculates with the numbers as they are.",
        done: "Two inputs, one result. The division by 1000 is the unit conversion, written into the formula.",
        scope: "metamodel",
        // 200 g at 25 € per kilogram cost 5 €: without the conversion it would be 5000.
        check: (state) =>
          typeGives(state, "material cost", [
            [{ mass: 200, "material price": 25 }, 5],
            [{ mass: 1000, "material price": 30 }, 30],
          ]),
        highlight: [ADD_ATTRIBUTE, JOB_TYPE],
      },
      {
        id: "add-total-cost",
        title: "Add them up",
        instruction:
          "Add a Derived Formula attribute total cost with the formula [machine cost] + [material cost]. Apply.",
        done: "total cost refers to two attributes that are themselves calculated. When a print time changes, the machine cost follows, and the total cost follows that.",
        scope: "metamodel",
        check: (state) =>
          typeGives(state, "total cost", [
            [{ "machine cost": 12, "material cost": 1.5 }, 13.5],
            [{ "machine cost": 1, "material cost": 2 }, 3],
          ]),
        highlight: [ADD_ATTRIBUTE, JOB_TYPE],
      },
      {
        id: "add-margin",
        title: "Calculate what is left",
        instruction:
          "Add a Derived Formula attribute margin with the formula [price] - [total cost]. Apply.",
        hint: "Price first: [price] - [total cost]. The other way round, a job that loses money would show a positive margin. Below zero, the job loses money.",
        done: "The whole calculation is four short formulas, each with a name that says what it means.",
        scope: "metamodel",
        check: marginIsRight,
        highlight: [ADD_ATTRIBUTE, JOB_TYPE],
      },
      {
        id: "save-chain",
        title: "Save the metamodel",
        instruction: "Save Quote types, so that the orders can use the new attributes.",
        done: "Saved. A print job now knows how to work out its cost and its margin.",
        signal: "saved",
        scope: "metamodel",
        check: marginIsRight,
        highlight: [SAVE_DIAGRAM],
      },
    ],
    question: {
      prompt: "The printer gets more expensive and the hourly rate of a job is changed from 4 to 5. What happens to that job's margin?",
      options: [
        { text: "Nothing, the margin only depends on price and total cost", feedback: "It does, and the total cost depends on the machine cost, which depends on the hourly rate." },
        {
          text: "It is recalculated, through machine cost and total cost",
          correct: true,
          feedback: "Right. Every formula that uses a changed value, directly or through another formula, gives a new result.",
        },
        { text: "It has to be recalculated by hand", feedback: "That is what the formulas are for: results follow their inputs." },
      ],
    },
  },
  {
    id: "type-to-elements",
    title: "From the type to the jobs",
    goal: "bring attributes a type has gained to existing elements, and compare calculated values in the table",
    why:
      "The formulas are on the type. A print job created from now on starts with all of them. The three jobs that exist already do not change behind your back: an element keeps what it has until you add what its type has gained. After that, each job calculates its own cost from its own numbers.",
    steps: [
      {
        id: "add-missing",
        title: "Give Phone stand the new attributes",
        instruction:
          "Open Orders in May and double-click Phone stand. Its editor says that Print job defines attributes this element does not have: press Add. Enter the material price 25. Before you press Apply, work out its total cost: 3 h at 4 €, plus 60 g of PLA at 25 € per kilogram. Then compare and Apply.",
        hint: "PLA costs 25 € per kilogram. The hourly rate arrives with its default of 4.",
        done: "Phone stand worked it out for itself: 12 € for the machine, 1.50 € for the material, 13.50 € in total, and 1.50 € left of its price.",
        scope: "instance",
        check: (state) => named(state, "Phone stand").some((job) => numberOf(job, "total cost") === 13.5),
        highlight: ['[data-testid="button-add-missing-attributes"]', { selector: ELEMENT_CARD, text: "Phone stand" }],
      },
      {
        id: "complete-jobs",
        title: "Do the same for the other jobs",
        instruction:
          "Add the missing attributes to Gear housing and Cable clip as well (open, Add, Apply). Then switch to Table and enter the material price 30 for both: they are printed in PETG.",
        hint: "In the table, values are edited in place. Watch the calculated columns while you type: they are not editable, they follow.",
        done: "The table shows the same calculation for every job, side by side. Calculated values are results: they change when their inputs do, wherever those are edited.",
        scope: "instance",
        check: (state) =>
          jobs(state).length >= 3 &&
          jobs(state).every((job) => hasNumber(job, "margin")) &&
          ["Gear housing", "Cable clip"].every((name) =>
            named(state, name).some((job) => numberOf(job, "material price") === 30),
          ),
        highlight: ['[data-testid="button-toolbar-table"]', '[data-testid="button-add-missing-attributes"]'],
      },
      {
        id: "new-job",
        title: "Take a new order",
        instruction:
          "Switch back to Diagram and add a new Print job from the Add elements tab. Name it Lamp shade and fill it in: mass 180, print time 11, price 55, material price 25.",
        hint: "A new element starts with everything its type has now, formulas included. Nothing has to be added afterwards.",
        done: "Lamp shade came with the formulas and calculated its margin as soon as its numbers were in: 6.50 €.",
        scope: "instance",
        // 44 € of machine time and 4.50 € of material leave 6.50 € of 55 €.
        check: (state) => jobs(state).some((job) => NEW_JOB(job) && numberOf(job, "margin") === 6.5),
        highlight: [{ selector: '[data-testid^="button-insert-referenced-class-"]', text: "Print job" }],
      },
    ],
    question: {
      prompt: "Next month the formula for machine cost is changed on the type. What happens to the jobs of May?",
      options: [
        { text: "They are recalculated with the new formula", feedback: "No: an element holds its own copy of what it got from its type, formula included." },
        {
          text: "They keep the formula they have",
          correct: true,
          feedback: "Right. An element gets copies of its type's attributes. May's jobs stay as they were quoted; new jobs get the new formula.",
        },
        { text: "Their margin becomes empty", feedback: "Nothing is removed from existing elements when a type changes." },
      ],
    },
  },
  {
    id: "model-answers",
    title: "Let the model answer",
    goal: "write a rule on a calculated value and use it to find and correct a problem",
    why:
      `The margins are in the table now, and one of them should worry the print shop. But nobody reads a table every morning. A model rule compares an attribute with a fixed number, and the margin is a number that says everything: below zero, the job costs more than it brings in. That is how the model answers the question: ${QUESTION}`,
    steps: [
      {
        id: "read-margins",
        title: "Find the negative margin",
        instruction: "Switch to Table and compare the margin column. Which job has a margin below zero?",
        done: "Gear housing: -3.20 €. The largest order of the month, at 60 €, costs 63.20 € to make.",
        signal: "table-mode",
        scope: "instance",
        highlight: ['[data-testid="button-toolbar-table"]'],
      },
      {
        id: "add-rule",
        title: "Write the rule",
        instruction:
          "Switch back to Diagram and open Model rules. Add a rule named No job below cost. In the list next to its name, which says All object types, choose Print job (under Built-in types). Condition: margin · is less than · 0. Then: report an issue, with a message such as Costs more than it brings in. Save the rules.",
        hint: "In the condition row, the second list picks the attribute and the third the comparison. In the Then row, switch from add descriptor tag to report an issue. The rules panel has its own Save.",
        done: "The rule does not calculate anything. It reads the result of your formulas, which is why the margin had to be an attribute.",
        scope: "instance",
        check: marginRule,
        highlight: ['[data-testid="button-add-rule"]', '[data-testid="button-model-rules"]'],
      },
      {
        id: "validate",
        title: "Validate",
        instruction: "First guess: which jobs will be reported? Then close the rules panel and press Validate.",
        hint: "If nothing is reported, the price of Gear housing was raised already: set it back to 60 and validate, to see the rule find it.",
        done: "Gear housing is reported, and marked on the canvas. From now on every job below cost is found without anyone looking for it.",
        signal: "validation-run",
        scope: "instance",
        // The rule has to find something: a validation with nothing to find shows nothing.
        check: (state) => marginRule(state) && jobs(state).some((job) => (numberOf(job, "margin") ?? 0) < 0),
        highlight: [VALIDATE],
      },
      {
        id: "fix-price",
        title: "Correct the quote",
        instruction:
          "Raise the price of Gear housing until its margin is no longer negative, for example to 70. Edit it in the table or in its editor, then save the diagram.",
        hint: "The cost is 63.20 €, so any price from there on works. The margin follows the price at once.",
        done: "No job is below cost any more, and the corrected quote is saved. You changed one number; the model worked out the rest.",
        scope: "instance",
        afterPrevious: true,
        check: (state) =>
          jobs(state).length >= 3 && jobs(state).every((job) => (numberOf(job, "margin") ?? -1) >= 0) && !state.dirty,
        highlight: [{ selector: ELEMENT_CARD, text: "Gear housing" }, '[data-testid="button-toolbar-table"]'],
      },
      {
        id: "validate-clean",
        title: "Validate again",
        instruction: "Validate once more and check that nothing is reported.",
        done: "No issues. The question is answered, and the answer will be checked again every time someone validates.",
        signal: "validation-passed",
        scope: "instance",
        check: marginRule,
        highlight: ['[data-testid="button-validate-again"]', VALIDATE],
      },
    ],
    question: {
      prompt: "A rule compares an attribute with a fixed number. How do you check that the price covers the cost, which are two attributes?",
      options: [
        { text: "With a rule: price is less than total cost", feedback: "A rule cannot compare two attributes with each other, only one attribute with a number." },
        {
          text: "Calculate the difference as an attribute and compare it with 0",
          correct: true,
          feedback: "Right. The formula does the comparing (margin = price - total cost), and the rule reads the result.",
        },
        { text: "It cannot be checked", feedback: "It can: let a formula calculate the difference and a rule test it." },
      ],
    },
  },
  {
    id: "on-your-own",
    title: "On your own",
    goal: "extend a calculation on a type and see it work for a new element",
    why:
      "The printer also uses electricity, and so far no job pays for it. This time only the result is given. Everything you need was in the lessons before; the hints say where.",
    steps: [
      {
        id: "own-formula",
        title: "Add the energy cost to the calculation",
        instruction:
          "In Quote types: give Print job a calculated energy cost that depends on the print time, make the total cost include it, and save.",
        hint: "For example: a Number attribute energy price with the default 0.05 (the printer uses about 0.05 € of electricity per hour), energy cost = [print time] * [energy price], and total cost = [machine cost] + [material cost] + [energy cost]. To change a formula, click the attribute in the list. See lessons 2 and 3.",
        done: "The calculation has one more step, and the total cost knows about it.",
        scope: "metamodel",
        check: (state) =>
          typeCalculates(state, "energy cost", ["print time"]) &&
          typeGives(state, "total cost", [[{ "machine cost": 1, "material cost": 2, "energy cost": 4 }, 7]]) &&
          !state.dirty,
      },
      {
        id: "own-job",
        title: "Quote a job with it",
        instruction:
          "In Orders in May: add a new print job, fill in its numbers, and give it a price that leaves a margin.",
        hint: "A new job gets the new calculation; the jobs of May keep the one they were quoted with. See lesson 4.",
        done: "The new job's total cost includes the energy, and its margin is still positive.",
        scope: "instance",
        check: (state) =>
          jobs(state).some(
            (job) =>
              calculatedFrom(job, "total cost", ["energy cost"]) &&
              hasNumber(job, "energy cost") &&
              (numberOf(job, "margin") ?? -1) >= 0,
          ),
      },
      {
        id: "own-validate",
        title: "Check all jobs",
        instruction: "Save the diagram and validate. If something is reported, fix it, save and validate again.",
        hint: "Your rule from lesson 5 reports every job with a negative margin. A job without a margin is not reported: its margin counts as nothing, not as below zero.",
        done: "Every job of the month, old and new, has a margin and covers its cost, and it is saved.",
        signal: "validation-passed",
        scope: "instance",
        check: (state) =>
          marginRule(state) &&
          jobs(state).every((job) => hasNumber(job, "margin")) &&
          jobs(state).some((job) => calculatedFrom(job, "total cost", ["energy cost"])) &&
          !state.dirty,
      },
    ],
  },
];

export const CALC_TUTORIAL: TutorialDefinition = {
  id: "calc",
  templateId: "tutorial-calc",
  title: "Calculate with attributes",
  question: QUESTION,
  answer:
    "Gear housing did: at 60 € it did not cover 63.20 € of machine time and material. Your formulas showed it, your rule found it, and it will find the next one.",
  answerStep: "validate-clean",
  summary:
    "A small 3D-printing service quotes its jobs by feel. You give a print job attributes of different types, let formulas calculate its cost and its margin, see every job work out its own numbers, and write the rule that finds the job that costs more than it brings in.",
  prerequisite: "Builds on Symlit basics.",
  minutes: 30,
  projects: { metamodel: "Quote types", instance: "Orders in May" },
  finishedTitle: "You let a model calculate, and checked its results",
  lessons: LESSONS,
  notCovered: [
    "Date attributes, and text attributes that hold a number",
    "Adding up across elements, such as the cost of all jobs of a customer: a formula sees only its own element",
    "Tags: rules that label elements instead of reporting issues (see Classify and review)",
    "Deleting an attribute a formula uses: the formula is left without an input, and the editor is not applied until it is fixed",
  ],
};
