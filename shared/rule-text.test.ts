import assert from "node:assert/strict";
import test from "node:test";
import { RelatedCalculator, type GraphAttribute, type GraphElement, type RelatedGraph } from "./related-formula";
import { ruleConditionOf, ruleHolds } from "./rule-evaluation";
import {
  builderFromRule,
  displayRuleCondition,
  parseRuleCondition,
  printRuleCondition,
  printRuleText,
  remapRuleIds,
  ruleFromBuilder,
  ruleFromModelCondition,
  splitRuleText,
  storeRuleCondition,
  type RuleBuilderGroup,
  type RuleTextContext,
} from "./rule-text";
import { modelRuleSchema, type ModelRuleCondition } from "./contracts";

const canonical = (text: string) => printRuleCondition(parseRuleCondition(text));

test("rule conditions read and print back the same", () => {
  for (const text of [
    "[range] < 15",
    "name is not set",
    "description is set",
    "[single source] is true and [criticality] = \"high\"",
    "[price] < [total cost]",
    "count(of \"consists of\") < 2",
    "sum([mass] of \"consists of\" where [status] = \"released\") > [max mass]",
    "none of incoming \"executes\"",
    "any of all outgoing where type = \"Battery\" has [capacity] < 100",
    "all of \"consists of\" have [status] = \"released\"",
    "not [mass] is set",
    "([a] = 1 or [b] = 2) and [c] = 3",
    "[a] = 1 or [b] = 2 and [c] = 3",
    "([mass] + [extra]) * 2 >= 10",
    "type = \"Battery\"",
    "[code] = \"0.50\"",
    "[delta] > -3",
  ]) {
    assert.equal(canonical(text), text, text);
  }
});

test("where and has take one comparison; and after them is about the element again", () => {
  const condition = parseRuleCondition('any of "has" has [capacity] < 100 and [range] <= 15');
  assert.equal(condition?.kind, "and");
  // Several checks of the related element go in parentheses, and print so.
  const grouped = 'any of "has" where (type = "Battery" or type = "Cell") has ([capacity] < 100 and [mass] > 1)';
  assert.equal(canonical(grouped), grouped);
  const related = parseRuleCondition(grouped);
  assert.equal(related?.kind === "related" && related.has?.kind, "and");
  assert.equal(canonical('none of "has" and [mass] > 5'), 'none of "has" and [mass] > 5');
});

test("readable mistakes", () => {
  const error = (text: string) => {
    try {
      parseRuleCondition(text);
    } catch (caught) {
      return (caught as Error).message;
    }
    return "";
  };
  assert.match(error("mass > 5"), /square brackets/);
  assert.match(error("[criticality] = high"), /texts in quotes/);
  assert.match(error("[mass] >"), /incomplete/);
  assert.match(error("[mass] is empty"), /is set/);
  assert.match(error("([mass] > 5"), /parentheses/);
  assert.match(error("[a] = 1 [b] = 2"), /and \/ or/);
  assert.match(error("[…] = 1"), /not finished/);
  assert.equal(parseRuleCondition("   "), null);
});

test("the whole text: for <type> where <condition>", () => {
  assert.deepEqual(splitRuleText("for Drone where [range] < 15"), { target: "Drone", condition: "[range] < 15" });
  assert.deepEqual(splitRuleText("for Print job where [margin] < 0"), { target: "Print job", condition: "[margin] < 0" });
  assert.deepEqual(splitRuleText("for all elements where name is not set"), { target: null, condition: "name is not set" });
  assert.deepEqual(splitRuleText("for Battery"), { target: "Battery", condition: "" });
  assert.deepEqual(splitRuleText('for "Where house" where [a] = 1'), { target: "Where house", condition: "[a] = 1" });
  assert.deepEqual(splitRuleText("[a] = 1"), { target: null, condition: "[a] = 1" });
  assert.equal(printRuleText("Drone", "[range] < 15"), "for Drone where [range] < 15");
  assert.equal(printRuleText(null, ""), "for all elements");
  assert.equal(printRuleText("all", "[a] = 1"), 'for "all" where [a] = 1');
});

const group = (combinator: "all" | "any", conditions: RuleBuilderGroup["conditions"]): RuleBuilderGroup => ({
  kind: "group",
  combinator,
  conditions,
});

test("the lists and the text show the same rule", () => {
  const lists = group("all", [
    { kind: "comparison", source: "self", field: "attribute", attribute: "single source", operator: "is-true" },
    group("any", [
      { kind: "comparison", source: "self", field: "attribute", attribute: "criticality", operator: "equals", value: "high" },
      { kind: "comparison", source: "self", field: "attribute", attribute: "lead time", operator: "greater-than", value: "30" },
    ]),
    {
      kind: "comparison",
      source: "connected",
      direction: "incoming",
      relationship: "executes",
      quantifier: "none",
      targetType: "all",
      field: "exists",
      operator: "exists",
    },
    {
      kind: "comparison",
      source: "connected",
      direction: "outgoing",
      quantifier: "all",
      targetType: "mm:1:battery",
      field: "attribute",
      attribute: "capacity",
      operator: "greater-than-or-equal",
      value: "100",
    },
  ]);
  const text = printRuleCondition(ruleFromBuilder(lists));
  assert.equal(
    text,
    '[single source] is true and ([criticality] = "high" or [lead time] > 30) and none of incoming "executes" and all of all outgoing where type = "type:mm:1:battery" have [capacity] >= 100',
  );
  assert.deepEqual(builderFromRule(parseRuleCondition(text)), lists);
  // Not in the lists: comparing two attributes, counting, not.
  assert.equal(builderFromRule(parseRuleCondition("[price] < [total cost]")), null);
  assert.equal(builderFromRule(parseRuleCondition('count(of "consists of") < 2')), null);
  assert.equal(builderFromRule(parseRuleCondition("not [a] is set")), null);
  // No condition: an empty group, which applies to every element.
  assert.deepEqual(builderFromRule(null), group("all", []));
  assert.equal(ruleFromBuilder(group("all", [])), null);
});

test("what the lists have not chosen yet is a placeholder that cannot be saved", () => {
  const text = printRuleCondition(
    ruleFromBuilder(group("all", [{ kind: "comparison", source: "self", field: "attribute", attribute: "", operator: "equals", value: "" }])),
  );
  assert.equal(text, "[…] = \"…\"");
  assert.throws(() => parseRuleCondition(text), /not finished/);
});

test("rules stored as lists convert without loss", () => {
  const stored: ModelRuleCondition = {
    kind: "group",
    combinator: "all",
    conditions: [
      { kind: "comparison", source: "self", field: "attribute", attribute: "capacity", operator: "missing" },
      { kind: "comparison", source: "connected", direction: "incoming", quantifier: "none", targetType: "mm:5:resource", field: "name", operator: "exists" },
    ],
  };
  assert.equal(
    printRuleCondition(ruleFromModelCondition(stored)),
    '[capacity] is not set and none of all incoming where type = "type:mm:5:resource" has name is set',
  );
});

const context: RuleTextContext = {
  types: [
    { value: "mm:1:battery", label: "Battery" },
    { value: "mm:1:drone", label: "Drone" },
  ],
  ownAttributes: [{ id: "a-range", name: "range" }],
  relatedAttributes: [
    { id: "a-capacity", name: "capacity" },
    { id: "a-mass", name: "mass" },
    { id: "a-mass-2", name: "mass" },
  ],
  relationCandidates: (name, direction) => (name === "has" && direction !== "incoming" ? ["edge-has"] : []),
  relationName: (id) => (id === "edge-has" ? "carries" : undefined),
};

test("names are stored by id where they stand for one thing, and shown by their name now", () => {
  const text = 'for Drone where [range] < 15 and any of "has" where type = "Battery" has ([capacity] < 100 and [mass] > 1)';
  const condition = splitRuleText(text).condition;
  const stored = storeRuleCondition(condition, context);
  assert.equal(
    stored,
    '[attr:a-range] < 15 and any of "rel:edge-has" where type = "type:mm:1:battery" has ([attr:a-capacity] < 100 and [mass] > 1)',
  );
  // The relationship was renamed to "carries"; [mass] stays by name (two attributes have it).
  assert.equal(
    displayRuleCondition(stored, context),
    '[range] < 15 and any of "carries" where type = "Battery" has ([capacity] < 100 and [mass] > 1)',
  );
  // Unreadable text is kept as it is, but still shown by names where it can be.
  assert.equal(storeRuleCondition("[range] <", context), "[range] <");
  assert.equal(displayRuleCondition('[attr:a-range] < and "type:mm:1:drone"', context), '[range] < and "Drone"');
  assert.equal(
    remapRuleIds('any of "rel:edge-has" where type = "type:node:t1"', { type: (target) => `mm:9:${target}`, relationship: (id) => `${id}-copy` }),
    'any of "rel:edge-has-copy" where type = "type:mm:9:node:t1"',
  );
});

test("a rule's text is checked when it is saved", () => {
  const base = { id: "r", name: "Rule", enabled: true, targetType: "all", outcome: { kind: "issue" as const, severity: "warning" as const } };
  assert.equal(modelRuleSchema.safeParse({ ...base, expression: "[range] < 15" }).success, true);
  assert.equal(modelRuleSchema.safeParse({ ...base, expression: "" }).success, true);
  assert.equal(modelRuleSchema.safeParse({ ...base, expression: "[range] <" }).success, false);
  assert.equal(modelRuleSchema.safeParse({ ...base, expression: "[…] = 1" }).success, false);
});

const number = (id: string, name: string, value: string): GraphAttribute => ({ id, name, type: "number", value });
const element = (id: string, type: string, attributes: GraphAttribute[] = [], extra: Partial<GraphElement> = {}): GraphElement => ({
  id,
  name: id,
  type,
  attributes,
  ...extra,
});

/** A drone with two batteries; a second drone with none; a resource executing a process. */
const fleet = (): RelatedGraph => ({
  elements: [
    element("D1", "Drone", [number("a-range", "range", "12"), number("a-mass", "mass", "3"), number("a-max", "max mass", "8")], { typeId: "mm:1:drone" }),
    element("D2", "Drone", [number("a-range", "range", "20")], { typeId: "mm:1:drone" }),
    element("B1", "Battery", [number("a-capacity", "capacity", "80"), number("a-mass", "mass", "2")], { typeId: "mm:1:battery" }),
    element("B2", "Battery", [number("a-capacity", "capacity", "120"), number("a-mass", "mass", "4")], { typeId: "mm:1:battery" }),
    element("P1", "Process", [], { typeId: "mm:1:process", description: "Cutting" }),
    element("P2", "Process", [], { typeId: "mm:1:process" }),
    element("R1", "Resource", [], { typeId: "mm:1:resource" }),
  ],
  relationships: [
    { source: "D1", target: "B1", name: "has", relationId: "edge-has" },
    { source: "D1", target: "B2", name: "has", relationId: "edge-has" },
    { source: "R1", target: "P1", name: "executes" },
  ],
});

test("rules hold over the whole graph", () => {
  const graph = fleet();
  const calculator = new RelatedCalculator(graph);
  const holds = (text: string, id: string) =>
    ruleHolds(parseRuleCondition(text), graph.elements.find((element) => element.id === id)!, calculator);
  assert.equal(holds("[range] < 15", "D1"), true);
  assert.equal(holds("[attr:a-range] < 15", "D2"), false);
  assert.equal(holds("15 > [range]", "D1"), true);
  assert.equal(holds('none of incoming "executes"', "P1"), false);
  assert.equal(holds('none of incoming "executes"', "P2"), true);
  assert.equal(holds('any of "rel:edge-has" has [capacity] < 100', "D1"), true);
  assert.equal(holds('all of "has" have [capacity] >= 100', "D1"), false);
  // "all" needs at least one related element.
  assert.equal(holds('all of "has" have [capacity] >= 100', "D2"), false);
  assert.equal(holds('any of all outgoing where type = "type:mm:1:battery" has [capacity] > 100', "D1"), true);
  assert.equal(holds('any of all where type = "Resource"', "P1"), true);
  assert.equal(holds('count(of "has") >= 2', "D1"), true);
  assert.equal(holds('[mass] + sum([mass] of "has") > [max mass]', "D1"), true);
  assert.equal(holds('[mass] + sum([mass] of "has") > [max mass]', "D2"), false, "not calculable: does not hold");
  assert.equal(holds("description contains \"cut\"", "P1"), true);
  assert.equal(holds('type = "Process" and not description is set', "P2"), true);
  assert.equal(holds('type = "type:mm:1:process"', "P1"), true);
  // Without the attribute, only "is not set" holds.
  assert.equal(holds("[capacity] < 100", "P1"), false);
  assert.equal(holds("[capacity] is not set", "P1"), true);
  assert.equal(holds("", "P1"), true);
});

test("old rules and text rules give the same results", () => {
  const graph = fleet();
  const calculator = new RelatedCalculator(graph);
  const lists: ModelRuleCondition = {
    kind: "group",
    combinator: "all",
    conditions: [
      { kind: "comparison", source: "connected", direction: "outgoing", quantifier: "any", targetType: "mm:1:battery", field: "attribute", attribute: "capacity", operator: "less-than", value: "100" },
    ],
  };
  const text = printRuleCondition(ruleFromModelCondition(lists));
  for (const id of ["D1", "D2", "P1"]) {
    const node = graph.elements.find((element) => element.id === id)!;
    assert.equal(
      ruleHolds(ruleConditionOf({ condition: lists }), node, calculator),
      ruleHolds(ruleConditionOf({ expression: text }), node, calculator),
      id,
    );
  }
});

test("the lists read back what they have not chosen yet", () => {
  const lists = group("all", [
    { kind: "comparison", source: "self", field: "attribute", attribute: "", operator: "equals", value: "" },
    { kind: "comparison", source: "connected", direction: "any", quantifier: "any", targetType: "all", field: "attribute", attribute: "", operator: "less-than", value: "" },
  ]);
  const text = printRuleCondition(ruleFromBuilder(lists));
  assert.deepEqual(builderFromRule(parseRuleCondition(text, { placeholders: true })), lists);
});
