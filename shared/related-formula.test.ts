import assert from "node:assert/strict";
import test from "node:test";
import { isFormulaPending } from "./formula";
import { RelatedCalculator, type GraphAttribute, type GraphElement, type RelatedGraph } from "./related-formula";

const number = (name: string, value: string): GraphAttribute => ({ id: name, name, type: "number", value });
const text = (name: string, value: string): GraphAttribute => ({ id: name, name, type: "string", value });
const related = (name: string, formula: string): GraphAttribute => ({ id: name, name, type: "related", formula, value: "" });
const derived = (name: string, formula: string): GraphAttribute => ({ id: name, name, type: "derived", formula, value: "" });
const element = (id: string, type: string, attributes: GraphAttribute[] = []): GraphElement => ({ id, name: id, type, attributes });
const link = (source: string, target: string, name = "consists of") => ({ source, target, name });

const TOTAL = "[mass] + sum([total mass] of \"consists of\")";

/** An espresso machine with a boiler group of two parts, and a pump. */
const machine = (): RelatedGraph => ({
  elements: [
    element("E1", "Machine", [number("mass", "2"), related("total mass", TOTAL), related("parts", 'count(of "consists of")')]),
    element("Boiler group", "Assembly", [number("mass", "1"), related("total mass", TOTAL), text("status", "released")]),
    element("Boiler", "Component", [number("mass", "3"), related("total mass", TOTAL), text("status", "released")]),
    element("Heater", "Component", [number("mass", "0.5"), related("total mass", TOTAL), text("status", "draft")]),
    element("Pump", "Pump", [number("mass", "1.5"), related("total mass", TOTAL), text("status", "draft")]),
    element("Tank", "Tank", [number("volume", "1.8")]),
  ],
  relationships: [
    link("E1", "Boiler group"),
    link("Boiler group", "Boiler"),
    link("Boiler group", "Heater"),
    link("E1", "Pump"),
    link("Tank", "Pump", "feeds"),
    // Drawn again in a second diagram: counts once.
    link("E1", "Pump"),
  ],
});
const calc = (graph: RelatedGraph, id: string, formula: string) => {
  const target = graph.elements.find((candidate) => candidate.id === id)!;
  target.attributes.push(related("result", formula));
  return new RelatedCalculator(graph).value(id, "result");
};

test("count and sum one step along a relationship; the same relationship in two diagrams counts once", () => {
  assert.equal(calc(machine(), "E1", 'count(of "consists of")'), 2);
  assert.equal(calc(machine(), "E1", 'sum([mass] of "consists of")'), 2.5);
  assert.equal(calc(machine(), "Pump", 'count(of incoming "feeds")'), 1);
  assert.equal(calc(machine(), "Pump", "count(of all)"), 2);
  assert.equal(calc(machine(), "Pump", "count(of all outgoing)"), 0);
  assert.equal(calc(machine(), "E1", 'count(of "Consists Of")'), 2, "names in any case");
});

test("a roll-up over several levels comes from formulas reading the related elements' formulas", () => {
  const calculator = new RelatedCalculator(machine());
  // 2 + (1 + 3 + 0.5) + 1.5
  assert.equal(calculator.value("E1", "total mass"), 8);
  assert.equal(calculator.value("Boiler group", "total mass"), 4.5);
  assert.equal(calculator.value("Heater", "total mass"), 0.5, "a leaf sums over nothing: 0");
});

test("where keeps the related elements that meet the condition", () => {
  assert.equal(calc(machine(), "Boiler group", 'sum([mass] of "consists of" where [status] = "released")'), 3);
  assert.equal(calc(machine(), "E1", 'count(of "consists of" where type = "pump")'), 1);
  assert.equal(calc(machine(), "E1", 'count(of "consists of" where [mass] > 1 and name contains "group")'), 0);
  assert.equal(calc(machine(), "E1", 'count(of "consists of" where [mass] >= 1 or [status] is not set)'), 2);
  // What is taken can be calculated from the related element's attributes.
  assert.equal(calc(machine(), "Boiler group", 'max([mass] * 2 of "consists of")'), 6);
  // A calculated attribute of the related element can be compared too.
  assert.equal(calc(machine(), "E1", 'count(of "consists of" where [total mass] > 2)'), 1);
});

test("related elements without the attribute do not take part; over none, sum is 0 and avg is not calculated yet", () => {
  assert.equal(calc(machine(), "Pump", 'sum([mass] of incoming "feeds")'), 0, "the tank has no mass");
  assert.throws(() => calc(machine(), "Pump", 'avg([mass] of incoming "feeds")'), isFormulaPending);
  assert.throws(() => calc(machine(), "Heater", 'min([mass] of "consists of")'), isFormulaPending);
  assert.equal(calc(machine(), "Heater", 'count(of "consists of")'), 0);
});

test("an empty value of a related element means not calculated yet, not zero", () => {
  const graph = machine();
  graph.elements.find((candidate) => candidate.id === "Pump")!.attributes[0].value = "";
  assert.throws(() => new RelatedCalculator(graph).value("E1", "total mass"), isFormulaPending);
  // Also in a condition that compares a number.
  const blank = machine();
  blank.elements.find((candidate) => candidate.id === "Heater")!.attributes[0].value = "";
  assert.throws(() => calc(blank, "Boiler group", 'count(of "consists of" where [mass] > 1)'), isFormulaPending);
  // A related element without the attribute does not meet the condition, except "is not set".
  assert.equal(calc(machine(), "E1", 'count(of "consists of" where [status] is not set)'), 0);
  assert.equal(calc(machine(), "Pump", 'count(of incoming "feeds" where [status] is not set)'), 1);
});

test("a circle through related elements is reported, not followed for ever", () => {
  const graph: RelatedGraph = {
    elements: [
      element("A", "Part", [related("total", 'sum([total] of "uses")')]),
      element("B", "Part", [related("total", 'sum([total] of "uses")')]),
    ],
    relationships: [link("A", "B", "uses"), link("B", "A", "uses")],
  };
  assert.throws(() => new RelatedCalculator(graph).value("A", "total"), /Circular/);
});

test("a Derived Formula can use a Related Formula of its element, and the editor learns what was used", () => {
  const graph = machine();
  graph.elements[0].attributes.push(number("budget", "10"), derived("reserve", "[budget] - [total mass]"));
  const calculator = new RelatedCalculator(graph);
  assert.equal(calculator.value("E1", "reserve"), 2);
  const values = calculator.calculatedValues("E1");
  assert.equal(values.get("total mass"), "8");
  assert.equal(values.get("reserve"), "2");

  const explained = new RelatedCalculator(machine());
  const boilerGroup = explained.explain("Boiler group", "total mass");
  assert.equal(boilerGroup.value, 4.5);
  assert.deepEqual(boilerGroup.explanations, [{ used: ["Boiler", "Heater"], leftOut: 0, without: 0 }]);
});

test("a Derived Formula cannot aggregate; mistakes say what is wrong", () => {
  const graph = machine();
  graph.elements[0].attributes.push(derived("bad", 'sum([mass] of "consists of")'));
  const result = new RelatedCalculator(graph).explain("E1", "bad");
  assert.equal(result.problem?.pending, false);
  assert.match(result.problem!.message, /Related Formula/);
  assert.match(new RelatedCalculator(machine()).explain("E1", "parts").problem?.message ?? "ok", /ok/);
});

test("the phrase reads as it means, and mistakes say what is wrong", async () => {
  const { parseFormula } = await import("./formula");
  const message = (formula: string, aggregates = true) => {
    try {
      parseFormula(formula, { aggregates });
      return "ok";
    } catch (error) {
      return (error as Error).message;
    }
  };
  assert.equal(message('max([lead time] of \u201csupplied by\u201d where [critical] = yes and ([lead time] > 30 or type = "Pump"))'), "ok");
  assert.equal(message('sum([a] of "x" where [b] is not set or name contains "valve")'), "ok");
  assert.equal(message("count(of all incoming)"), "ok");
  assert.equal(message("sum(1, 2)"), "ok", "the function sum is still there");
  assert.match(message('sum([mass] of "x")', false), /Related Formula/);
  assert.match(message('sum(count(of "a") of "b")'), /one step only/);
  assert.match(message("count([x])"), /count\(of "relationship"\)/);
  assert.match(message('sum(of "x")'), /needs a value before "of"/);
  assert.match(message("sum([a] of x)"), /name in quotes/);
  assert.match(message('sum([a] of "x", 2)'), /one value/);
  assert.match(message("[a] = 3"), /only in a condition after where/);
  assert.match(message('count(of "x" where [a] ~ 3)'), /Unexpected token/);
  assert.match(message('count(of "x" where [a] = )'), /number, a text in quotes, or yes\/no/);
  assert.match(message('count(of "x" where [a] is)'), /is set/);
});

test("references are stored by id where they name one attribute, and shown by the name it has now", async () => {
  const {
    displayRelatedFormula,
    relatedFormulaContext,
    remapOwnReferences,
    storeRelatedFormula,
    unlinkedRelatedReferences,
  } = await import("./related-formula");
  // Parts made from one type share its attributes' ids; a hand-made element has its own.
  const typed = (id: string, mass: string): GraphElement => ({
    id,
    name: id,
    type: "Part",
    attributes: [
      { id: "type-mass", name: "mass", type: "number", value: mass },
      { id: "type-total", name: "total", type: "related", formula: "" },
      { id: `${id}-status`, name: "status", type: "string", value: "released" },
    ],
  });
  const graph: RelatedGraph = {
    elements: [typed("Frame", "4"), typed("Arm", "1"), typed("Wrist", "0.5")],
    // Two parts of the frame, each with a status of its own.
    relationships: [link("Frame", "Arm"), link("Frame", "Wrist")],
  };
  const frame = graph.elements[0];
  const context = relatedFormulaContext(graph, "Frame", frame.attributes, "type-total");

  const written = '[mass] + sum([total] of "consists of" where [status] = "released")';
  const stored = storeRelatedFormula(written, context);
  // Its own mass and the parts' total are one attribute each; the parts' status are separate ones.
  assert.equal(stored, '[attr:type-mass] + sum([attr:type-total] of "consists of" where [status] = "released")');
  assert.deepEqual(unlinkedRelatedReferences(stored), ["[status]"]);
  assert.equal(displayRelatedFormula(stored, context), written);

  // Renamed on the elements: the formula shows the new names and still calculates.
  for (const element of graph.elements) {
    element.attributes[0].name = "weight";
    element.attributes[1].name = "total weight";
  }
  const renamed = relatedFormulaContext(graph, "Frame", frame.attributes, "type-total");
  assert.equal(
    displayRelatedFormula(stored, renamed),
    '[weight] + sum([total weight] of "consists of" where [status] = "released")',
  );
  for (const element of graph.elements) element.attributes[1].formula = stored;
  assert.equal(new RelatedCalculator(graph).value("Frame", "type-total"), 5.5);

  // Without related elements known yet, a reference inside stays by name; one that cannot be found shows as stored.
  const alone = relatedFormulaContext(null, "Frame", frame.attributes, "type-total");
  assert.equal(storeRelatedFormula('sum([mass] of "x")', alone), 'sum([mass] of "x")');
  assert.equal(displayRelatedFormula('sum([attr:gone] of "x")', alone), 'sum([attr:gone] of "x")');
  // Not readable yet: stored as written.
  assert.equal(storeRelatedFormula("[weight] + sum(", renamed), "[weight] + sum(");

  // Copied with new ids, its own references follow; the related elements' keep theirs.
  assert.equal(
    remapOwnReferences(stored, new Map([["type-mass", "copy-mass"], ["type-total", "copy-total"]])),
    '[attr:copy-mass] + sum([attr:type-total] of "consists of" where [status] = "released")',
  );
});

test("in a metamodel, a type related to itself links a roll-up's reference to its own attribute", async () => {
  const { relatedFormulaContext, storeRelatedFormula } = await import("./related-formula");
  const part: GraphElement = {
    id: "Part",
    name: "Part",
    type: "Object",
    attributes: [
      { id: "mass", name: "mass", type: "number", value: "" },
      { id: "total", name: "total mass", type: "related", formula: "" },
    ],
  };
  const context = relatedFormulaContext(
    { elements: [part], relationships: [link("Part", "Part")] },
    "Part",
    part.attributes,
    "total",
  );
  assert.equal(
    storeRelatedFormula('[mass] + sum([total mass] of "consists of")', context),
    '[attr:mass] + sum([attr:total] of "consists of")',
  );
});

test("relationships are linked to the metamodel relationship they stand for, and follow its rename", async () => {
  const { deriveRelationId, displayRelatedFormula, linkRelationships, relatedFormulaContext, storeRelatedFormula, unlinkedRelatedReferences } =
    await import("./related-formula");
  // The metamodel: a Machine consists of Components; a Pump is a Component.
  const relations = [
    { id: "mm:1:10:consists", label: "consists of", edgeType: "composition", sourceTypeId: "mm:1:Machine", targetTypeId: "mm:1:Component" },
    { id: "mm:1:10:drives", label: "drives", edgeType: "association", sourceTypeId: "mm:1:Machine", targetTypeId: "mm:1:Component" },
  ];
  const parentMap = new Map([["mm:1:Pump", new Set(["mm:1:Component"])]]);
  const typed = (id: string, typeId: string, mass: string): GraphElement => ({
    id,
    name: id,
    type: typeId.split(":").pop()!,
    typeId,
    attributes: [{ id: "mass", name: "mass", type: "number", value: mass }],
  });
  const graph: RelatedGraph = {
    elements: [typed("E1", "mm:1:Machine", "2"), typed("P1", "mm:1:Pump", "1.5"), typed("B1", "mm:1:Component", "3")],
    relationships: [
      // Drawn with Symlit's suggestion: it says which metamodel relationship it is.
      { source: "E1", target: "P1", name: "consists of", kind: "composition", relationId: "consists" },
      // Drawn before relationships recorded that: worked out from types, name and kind.
      { source: "E1", target: "B1", name: "consists of", kind: "composition" },
      { source: "E1", target: "B1", name: "drives", kind: "association" },
    ],
  };
  assert.equal(deriveRelationId(graph.relationships[1], "mm:1:Machine", "mm:1:Component", relations, parentMap), "consists");
  assert.equal(deriveRelationId(graph.relationships[1], "mm:1:Component", "mm:1:Machine", relations, parentMap), undefined, "the other way round");
  const linked = linkRelationships(graph, relations, parentMap);
  assert.deepEqual(linked.relationships.map((relationship) => relationship.relationId), ["consists", "consists", "drives"]);

  const machine = graph.elements[0];
  machine.attributes.push({ id: "parts", name: "parts mass", type: "related", formula: "" });
  const knowledge = { relations, parentMap, typeId: "mm:1:Machine" };
  const context = relatedFormulaContext(graph, "E1", machine.attributes, "parts", [], knowledge);
  const stored = storeRelatedFormula('sum([mass] of "consists of")', context);
  assert.equal(stored, 'sum([attr:mass] of "rel:consists")');
  assert.deepEqual(unlinkedRelatedReferences(stored, context), []);
  machine.attributes[1].formula = stored;
  assert.equal(new RelatedCalculator(linked).value("E1", "parts"), 4.5);

  // Renamed in the metamodel: the formula shows the new name, and the relationships drawn
  // before (still labelled "consists of") keep counting.
  const renamed = relations.map((relation) => (relation.id.endsWith("consists") ? { ...relation, label: "contains" } : relation));
  const renamedContext = relatedFormulaContext(graph, "E1", machine.attributes, "parts", [], { ...knowledge, relations: renamed });
  assert.equal(displayRelatedFormula(stored, renamedContext), 'sum([mass] of "contains")');
  // Recorded relationships keep counting. One that never recorded its metamodel relationship can no
  // longer be worked out from its old label: that is why the server records it once, at start.
  assert.equal(new RelatedCalculator(linkRelationships(graph, renamed, parentMap)).value("E1", "parts"), 1.5);
  assert.equal(new RelatedCalculator(linkRelationships(linked, renamed, parentMap)).value("E1", "parts"), 4.5);

  // Without a metamodel there is nothing to link: by name, as before, and nothing to point out.
  const unlinkedGraph: RelatedGraph = {
    ...graph,
    relationships: graph.relationships.map(({ relationId: _relationId, ...relationship }) => relationship),
  };
  const plain = relatedFormulaContext(unlinkedGraph, "E1", machine.attributes, "parts");
  assert.equal(storeRelatedFormula('count(of "consists of")', plain), 'count(of "consists of")');
  assert.deepEqual(unlinkedRelatedReferences('count(of "consists of")', plain), []);
  // A name no relationship of the metamodel has stays by name, and is pointed out.
  assert.equal(storeRelatedFormula('count(of "feeds")', context), 'count(of "feeds")');
  assert.deepEqual(unlinkedRelatedReferences('count(of "feeds")', context), ['"feeds"']);
});
