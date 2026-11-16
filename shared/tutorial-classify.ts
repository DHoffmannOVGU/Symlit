/**
 * The tutorial on classifying with rules. It creates a metamodel ("Component
 * types") and a model ("Control cabinet K1") that uses it
 * (server/templates/tutorial-classify.json): the purchased parts of a control
 * cabinet, with their lead time, whether only one supplier can deliver them,
 * and how much the cabinet depends on them.
 *
 * The other tutorials use rules to report what is wrong. Here nothing is
 * wrong: the rules sort the parts, with tags, until the model shows which
 * ones need a second supplier. The learner combines conditions, moves a rule
 * into the metamodel so that every cabinet gets it, and reviews the result
 * in the table.
 *
 * It builds on the basics tutorial: steps name the result, not every click.
 */
import {
  attributeOf,
  editing,
  ELEMENT_CARD,
  named,
  numberOf,
  ofType,
  same,
  tagged,
  type TutorialDefinition,
  type TutorialLesson,
  type TutorialModelState,
  type TutorialRule,
} from "./tutorial-types";

const QUESTION = "Which parts of the control cabinet need a second supplier?";

const RULES_BUTTON = '[data-testid="button-model-rules"]';
const ADD_RULE = '[data-testid="button-add-rule"]';
const TABLE = '[data-testid="button-toolbar-table"]';

/** The rule has a comparison of the element's own attribute, with one of the operators and, if given, the value. */
const compares = (rule: TutorialRule, attribute: string, operators: string[], value?: string) =>
  rule.conditions.some(
    (condition) =>
      condition.about === "self" &&
      condition.field === "attribute" &&
      same(condition.attribute, attribute) &&
      operators.includes(condition.operator) &&
      (value === undefined || same(condition.value, value)),
  );
/** An active rule for components that adds the tag. */
const tags = (rule: TutorialRule, tag: string) => same(rule.tag, tag) && same(rule.target, "Component");
const hasRule = (state: TutorialModelState, test: (rule: TutorialRule) => boolean) => state.rules.some(test);

const longLead = (rule: TutorialRule) =>
  tags(rule, "Long lead") &&
  rule.conditions.some(
    (condition) =>
      same(condition.attribute, "lead time") &&
      ["greater-than", "greater-than-or-equal"].includes(condition.operator) &&
      Number(condition.value) === 60,
  );
const singleSource = (rule: TutorialRule) =>
  tags(rule, "Single source") && rule.conditions.length === 1 && compares(rule, "single source", ["is-true"]);
const critical = (rule: TutorialRule) =>
  tags(rule, "Critical") && rule.conditions.length === 1 && compares(rule, "criticality", ["equals"], "high");
/** Both conditions have to hold: only one supplier, and the cabinet depends on the part. */
const secondSource = (rule: TutorialRule) =>
  tags(rule, "Second source") &&
  rule.combinator === "all" &&
  compares(rule, "single source", ["is-true"]) &&
  compares(rule, "criticality", ["equals"], "high");
/** Long to get and critical: order early. */
const orderEarly = (rule: TutorialRule) =>
  tags(rule, "Order early") &&
  rule.combinator === "all" &&
  compares(rule, "lead time", ["greater-than", "greater-than-or-equal"]) &&
  compares(rule, "criticality", ["equals"], "high");

const part = (state: TutorialModelState, name: string) => named(state, name)[0];
const isTagged = (state: TutorialModelState, name: string, tag: string) => {
  const element = part(state, name);
  return !!element && tagged(element, tag);
};

const LESSONS: TutorialLesson[] = [
  {
    id: "tag-not-issue",
    title: "A tag instead of an issue",
    goal: "write a rule that labels elements instead of reporting them",
    why:
      "The cabinet K1 has eight purchased parts, and nothing is wrong with any of them. Still, they are not all alike: some take months to arrive, some can be bought from one supplier only. A rule can say so on the diagram. Instead of reporting an issue, it adds a tag to every element its condition holds for: a label that sorts, without saying that anything is broken.",
    steps: [
      {
        id: "open-part-type",
        title: "Look at what is known about a component",
        instruction:
          "You are in the metamodel Component types. Double-click the type Component and read its attributes: a lead time in days, single source (Yes/No), a criticality (low, medium or high) and the supplier.",
        done: "Three of these can be used to sort parts: a number, a Yes/No fact and a choice from a list. Press Cancel to close the editor.",
        scope: "metamodel",
        check: (state) => editing(state, "Component"),
        highlight: [{ selector: ELEMENT_CARD, text: "Component" }],
      },
      {
        id: "open-model",
        title: "Open the cabinet",
        instruction: "Open the model Control cabinet K1: the cabinet and the eight parts it contains.",
        done: "Eight parts that look alike. Their differences are in their attribute values, where nobody sees them at a glance.",
        signal: "view-opened",
        scope: "instance",
      },
      {
        id: "tag-long-lead",
        title: "Tag the parts that take long to arrive",
        instruction:
          "Open Model rules and press Add rule. Name it Long lead time. Elements: Component. Condition: lead time · is greater than · 60. Then: add descriptor tag, with the label Long lead. Save the rules.",
        hint: "A new rule already says add descriptor tag: only the label has to be changed. In the condition row, the second list picks the attribute and the third the comparison. The tutorial looks for the label Long lead.",
        done: "Close the rules panel and look at the diagram: PLC and HMI panel now carry the tag Long lead. Nothing was reported, and Validate would still pass.",
        scope: "instance",
        check: (state) => hasRule(state, longLead),
        highlight: [ADD_RULE, RULES_BUTTON],
      },
      {
        id: "tag-follows",
        title: "Change a value and watch the tag",
        instruction:
          "The HMI panel is now available from stock: double-click it, set its lead time to 30 and press Apply.",
        hint: "Close the rules panel first if it is still open.",
        done: "The tag is gone from the HMI panel. A tag is not something you put on an element: the rule gives it, for as long as its condition holds.",
        scope: "instance",
        check: (state) => {
          const panel = part(state, "HMI panel");
          return !!panel && numberOf(panel, "lead time") === 30 && !tagged(panel, "Long lead");
        },
        highlight: [{ selector: ELEMENT_CARD, text: "HMI panel" }],
      },
    ],
    question: {
      prompt: "When is a tag the better outcome of a rule than an issue?",
      options: [
        { text: "When the element has a mistake that must be fixed", feedback: "That is what an issue is for: Validate lists it until it is fixed." },
        {
          text: "When the rule sorts elements, and nothing about them is wrong",
          correct: true,
          feedback: "Right. A long lead time is a fact to know about, not a mistake. A tag shows it without making validation fail.",
        },
        { text: "When the rule should apply to one element only", feedback: "Both outcomes apply to every element the condition holds for." },
      ],
    },
  },
  {
    id: "facts-and-choices",
    title: "Conditions on facts and choices",
    goal: "write conditions on a Yes/No attribute and on a list attribute",
    why:
      "A number is compared with a number. The other two kinds of attribute have comparisons of their own: a Yes/No attribute is true or false, and a list attribute equals one of its options. Two more tags make the two properties visible that the question is about: who has only one supplier, and what the cabinet cannot do without.",
    steps: [
      {
        id: "tag-single-source",
        title: "Tag the parts with one supplier",
        instruction:
          "Add a rule named One supplier. Elements: Component. Condition: single source · is true. Tag: Single source. Save the rules.",
        hint: "For a Yes/No attribute the comparisons is true and is false need no value.",
        done: "PLC, HMI panel and Safety relay carry the tag Single source.",
        scope: "instance",
        check: (state) => hasRule(state, singleSource),
        highlight: [ADD_RULE, RULES_BUTTON],
      },
      {
        id: "tag-critical",
        title: "Tag the critical parts",
        instruction:
          "Add a rule named Critical part. Elements: Component. Condition: criticality · equals · high. Tag: Critical. Save the rules.",
        hint: "The value is typed as it is written in the list: high. Because criticality is a list, there are only three spellings a part can have.",
        done: "Four parts are Critical. Two of them, PLC and Safety relay, carry Single source as well.",
        scope: "instance",
        check: (state) => hasRule(state, critical),
        highlight: [ADD_RULE, RULES_BUTTON],
      },
      {
        id: "reclassify",
        title: "Correct a classification",
        instruction:
          "The Fan was rated low, but without it the cabinet overheats. Close the rules panel, open the Fan and set its criticality to high. Apply.",
        done: "The Fan is tagged Critical as soon as its value says so. Nobody had to remember to re-tag it.",
        scope: "instance",
        check: (state) => {
          const fan = part(state, "Fan");
          return !!fan && same(attributeOf(fan, "criticality")?.value ?? "", "high") && tagged(fan, "Critical");
        },
        highlight: [{ selector: ELEMENT_CARD, text: "Fan" }],
      },
    ],
    question: {
      prompt: "Why is criticality a list (low, medium, high) and not a text?",
      options: [
        { text: "A list takes less space on the card", feedback: "Attribute values are not shown on cards at all." },
        {
          text: "So that the rule criticality equals high finds every critical part",
          correct: true,
          feedback: "Right. In a text, High, hi and very high would all slip past the rule. A list has exactly the spellings its rules expect.",
        },
        { text: "Rules cannot read text attributes", feedback: "They can (equals, contains). The problem with text is that it can be spelled in many ways." },
      ],
    },
  },
  {
    id: "combine-conditions",
    title: "Combine conditions",
    goal: "combine two conditions in one rule and switch rules on and off",
    why:
      `One supplier is not a problem for a part the cabinet can do without, and a critical part with three suppliers is safe. The parts to worry about are those where both come together. A rule can hold several conditions and say whether all of them or any of them must hold. That rule answers the question: ${QUESTION}`,
    steps: [
      {
        id: "tag-second-source",
        title: "Tag the parts where both hold",
        instruction:
          "Add a rule named Needs a second supplier. Elements: Component. First condition: single source · is true. Press + Condition and add: criticality · equals · high. Leave Match on all. Tag: Second source. Save the rules.",
        hint: "+ Condition is in the line that says Match all of these conditions. With all, every condition has to hold; with any, one is enough.",
        done: "Only PLC and Safety relay get the tag Second source: one supplier each, and the cabinet does not run without them.",
        scope: "instance",
        check: (state) => hasRule(state, secondSource),
        highlight: [ADD_RULE, RULES_BUTTON],
      },
      {
        id: "switch-off",
        title: "Switch off the rules you no longer need",
        instruction:
          "The cards are getting crowded. Switch off the rules One supplier and Critical part with the toggle at the left of each, and save the rules.",
        hint: "A rule that is switched off stays in the list and can be switched on again. Deleting it would work too.",
        done: "The two helper tags are gone, the rules are kept. What is left on the diagram is the answer, and the long lead times.",
        scope: "instance",
        check: (state) => hasRule(state, secondSource) && !hasRule(state, singleSource) && !hasRule(state, critical),
        highlight: [RULES_BUTTON],
      },
      {
        id: "read-answer",
        title: "Read the answer in the table",
        instruction: "Close the rules panel and switch to Table. Tags have a column of their own.",
        done: "Two parts need a second supplier: the PLC and the Safety relay. The PLC also takes 90 days to arrive.",
        signal: "table-mode",
        scope: "instance",
        check: (state) => isTagged(state, "PLC", "Second source") && isTagged(state, "Safety relay", "Second source"),
        highlight: [TABLE],
      },
    ],
    question: {
      prompt: "What would the rule tag if Match were set to any instead of all?",
      options: [
        { text: "The same two parts", feedback: "With any, one condition is enough: every part with one supplier, and every critical part." },
        {
          text: "Every part that has one supplier or is critical",
          correct: true,
          feedback: "Right: six parts instead of two. All narrows a rule down, any widens it.",
        },
        { text: "No part at all", feedback: "Any is the looser of the two: it tags more parts, not fewer." },
      ],
    },
  },
  {
    id: "rule-for-all",
    title: "A rule for every cabinet",
    goal: "put a rule into the metamodel so that it applies to every model built from it",
    why:
      "The rule lives in the diagram of K1. The next cabinet, K2, would start without it, and someone would have to remember to write it again. A rule that should hold for every cabinet belongs where the parts are defined: in the metamodel. Models built from it get the rule without being able to change it.",
    steps: [
      {
        id: "meta-rule",
        title: "Write the rule in the metamodel",
        instruction:
          "Switch back to Diagram and save it. Then open Component types, open Model rules there and add the same rule: name Needs a second supplier, elements Component (under Types in this diagram), conditions single source · is true and criticality · equals · high, tag Second source. Save the rules.",
        hint: "In a metamodel, the rule's elements are chosen from the types in the diagram. The attributes offered in the condition are those of the types.",
        done: "The rule is part of what a Component is now. Every model that uses Component types applies it.",
        scope: "metamodel",
        check: (state) => hasRule(state, secondSource),
        highlight: [ADD_RULE, RULES_BUTTON],
      },
      {
        id: "see-inherited",
        title: "Find it in the model",
        instruction:
          "Open Control cabinet K1 and open Model rules. The rule appears at the top, under Rules from metamodels, with a lock.",
        done: "It is listed as a Meta rule and cannot be edited here: a model follows the rules of its metamodel, it does not rewrite them.",
        signal: "rules-opened",
        scope: "instance",
        highlight: [RULES_BUTTON],
      },
      {
        id: "remove-local",
        title: "Remove the copy in the diagram",
        instruction:
          "The diagram's own rule Needs a second supplier is now a duplicate. Delete it with the bin at its right and save the rules.",
        done: "PLC and Safety relay are still tagged Second source: the tag now comes from the metamodel, and so it will in K2.",
        scope: "instance",
        check: (state) =>
          !hasRule(state, secondSource) &&
          isTagged(state, "PLC", "Second source") &&
          isTagged(state, "Safety relay", "Second source"),
        highlight: [RULES_BUTTON],
      },
    ],
    question: {
      prompt: "Purchasing decides: no part may have a lead time above 120 days, in any cabinet. Where does that rule belong?",
      options: [
        { text: "In the diagram of K1", feedback: "Then K2 and every later cabinet would have to repeat it, and could forget to." },
        {
          text: "In the metamodel Component types",
          correct: true,
          feedback: "Right. A rule for every model belongs to the metamodel. A rule about one cabinet belongs to that cabinet's diagram.",
        },
        { text: "In each part, as an attribute", feedback: "An attribute holds a value. The check on the value is a rule." },
      ],
    },
  },
  {
    id: "review",
    title: "Review in the table",
    goal: "filter the table by a tag, correct values in place and hand the list on as a file",
    why:
      "A classification is made to be acted on: the two parts go to purchasing, and what purchasing finds out comes back into the model. For lists like this the table is the better view. It can be filtered by a tag, its values can be edited where they stand, and it can be exported for people who do not use Symlit.",
    steps: [
      {
        id: "filter-table",
        title: "Show only the parts that need a second supplier",
        instruction: "Close the rules panel, switch to Table and type Second source into the filter above the elements.",
        hint: "The filter looks at names, types, tags, descriptions and attribute values.",
        done: "Two rows are left: the list for purchasing.",
        scope: "instance",
        check: (state) => state.tableFilter.toLowerCase().includes("second"),
        highlight: ['[data-testid="input-node-table-filter"]', TABLE],
      },
      {
        id: "edit-in-table",
        title: "Enter what purchasing found out",
        instruction:
          "Purchasing found a second supplier for the Safety relay. Set its single source to No, directly in the table.",
        hint: "Yes/No values are chosen from a small list in the cell.",
        done: "The Safety relay dropped out of the filtered list: its tag is gone, because its value changed. The table always shows the classification as it is now.",
        scope: "instance",
        check: (state) => {
          const relay = part(state, "Safety relay");
          return !!relay && same(attributeOf(relay, "single source")?.value ?? "", "false") && !tagged(relay, "Second source");
        },
        highlight: ['[data-testid="table-element-row"][data-element-name="Safety relay"]'],
      },
      {
        id: "export-csv",
        title: "Export the parts list",
        instruction:
          "Clear the filter and save the diagram. Then use Export Project at the bottom of the sidebar, choose the format Model elements (CSV) and download it.",
        hint: "A CSV file opens in any spreadsheet program. It contains the elements with their attribute values; tags are worked out by rules and are not part of the file.",
        done: "The parts list is a file that a spreadsheet can open.",
        signal: "exported-csv",
        scope: "instance",
        highlight: ['[data-testid="button-export-project"]'],
      },
    ],
    question: {
      prompt: "You correct a value in the table. What happens to the diagram?",
      options: [
        { text: "Nothing, until the change is copied over", feedback: "There is nothing to copy: table and diagram show the same elements." },
        {
          text: "It shows the same change: both are views of one model",
          correct: true,
          feedback: "Right. The table and the diagram are two ways of looking at the same elements. A value, and every tag that depends on it, is the same in both.",
        },
        { text: "The diagram has to be validated first", feedback: "Validation checks a model; it is not needed for a change to show." },
      ],
    },
  },
  {
    id: "on-your-own",
    title: "On your own",
    goal: "classify with a combined rule of your own, for every model",
    why:
      "Purchasing has a second worry: parts that are critical and take long to arrive have to be ordered before the cabinet is designed to the end. This time only the result is given. Everything you need was in the lessons before; the hints say where.",
    steps: [
      {
        id: "own-rule",
        title: "Tag what has to be ordered early",
        instruction:
          "For every cabinet built from Component types: tag the parts that are critical and have a lead time above 30 days with Order early.",
        hint: "A rule in the metamodel Component types, for Component, with two conditions that both have to hold: lead time · is greater than · 30 and criticality · equals · high. See lessons 3 and 4.",
        done: "The rule is part of the metamodel.",
        scope: "metamodel",
        check: (state) => hasRule(state, orderEarly),
      },
      {
        id: "own-result",
        title: "See which parts it finds",
        instruction: "Open Control cabinet K1 and filter the table by Order early.",
        hint: "Switch to Table and type the tag into the filter. See lesson 5.",
        done: "PLC and Safety relay have to be ordered early. The Fan is critical too, but arrives in a week.",
        scope: "instance",
        check: (state) =>
          state.tableFilter.toLowerCase().includes("early") &&
          ofType(state, "Component").some((element) => tagged(element, "Order early")),
      },
      {
        id: "own-change",
        title: "Take the PLC off the list",
        instruction:
          "The supplier now keeps the PLC in stock: its lead time is 10 days. Enter that and check that the PLC is no longer tagged Order early.",
        hint: "Edit the value in the table or in the PLC's editor. With a filter set, the row leaves the table as soon as the tag is gone.",
        done: "One part left to order early. The classification followed the model, as it will for every change from here on.",
        scope: "instance",
        check: (state) => {
          const plc = part(state, "PLC");
          return (
            !!plc &&
            !tagged(plc, "Order early") &&
            ofType(state, "Component").some((element) => tagged(element, "Order early"))
          );
        },
      },
    ],
  },
];

export const CLASSIFY_TUTORIAL: TutorialDefinition = {
  id: "classify",
  templateId: "tutorial-classify",
  title: "Classify and review",
  question: QUESTION,
  answer:
    "The PLC and the Safety relay: one supplier each, and the cabinet does not run without them. Your rule found them by combining two conditions, and it now belongs to the metamodel, so the next cabinet is checked the same way.",
  answerStep: "read-answer",
  summary:
    "A control cabinet has eight purchased parts, and nothing is wrong with any of them. You write rules that tag instead of report: by a number, a Yes/No fact and a choice from a list, then two combined. You move the rule into the metamodel for every cabinet, and review and correct the result in the table.",
  prerequisite: "Builds on Symlit basics.",
  minutes: 25,
  projects: { metamodel: "Component types", instance: "Control cabinet K1" },
  finishedTitle: "You let rules sort a model, and reviewed the result",
  lessons: LESSONS,
  notCovered: [
    "Conditions about connected elements, such as a cabinet without a power supply (see Production with PPR)",
    "Groups inside a rule: all of these, and any of those",
    "A tag's colour, set in the rule",
    "Rules that report issues on calculated values (see Calculate with attributes)",
  ],
};
