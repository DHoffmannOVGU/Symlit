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
