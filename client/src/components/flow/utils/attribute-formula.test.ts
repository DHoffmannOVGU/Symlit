import assert from "node:assert/strict";
import test from "node:test";
import type { NodeAttribute } from "../types";
import {
  evaluateDerivedAttribute,
  formatDerivedValue,
  getDisplayFormula,
  getStoredFormulaFromDisplay,
  isFormulaPending,
  recalculateDerivedAttributes,
} from "./attribute-formula";

const number = (id: string, name: string, value: string): NodeAttribute => ({ id, name, value, unit: "", type: "number" });
const derived = (id: string, name: string, formula: string, value = ""): NodeAttribute => ({
  id,
  name,
  value,
  unit: "",
  type: "derived",
  formula,
});

/** The value a formula gives over the given inputs. */
const calc = (formula: string, inputs: NodeAttribute[] = []) =>
  evaluateDerivedAttribute(derived("result", "result", formula), [...inputs, derived("result", "result", formula)]).value;

const job = [number("mass", "mass", "120"), number("time", "print time", "6"), number("rate", "machine rate", "4")];

test("the four operations, parentheses and the usual precedence", () => {
  assert.equal(calc("1 + 2 * 3"), 7);
  assert.equal(calc("(1 + 2) * 3"), 9);
  assert.equal(calc("10 / 4 - 0.5"), 2);
  assert.equal(calc("[print time] * [machine rate]", job), 24);
  assert.equal(calc("[mass] / 1000 * 25", job), 3);
});

test("a minus sign in front of a value applies to that value only", () => {
  assert.equal(calc("-3"), -3);
  assert.equal(calc("2 * -3"), -6, "used to give -3");
  assert.equal(calc("[mass] / -2", job), -60, "used to fail as a division by zero");
  assert.equal(calc("10 - -2"), 12);
  assert.equal(calc("-(1 + 2) * 2"), -6);
  assert.equal(calc("--2"), 2);
  assert.equal(calc("2 - 3"), -1, "a minus between two values is still a subtraction");
});

test("references are found by name, whatever the case, and stored by id", () => {
  assert.equal(calc("[Print Time] * 2", job), 12);
  const attributes = [...job, derived("cost", "machine cost", "")];
  const stored = getStoredFormulaFromDisplay("[print time] * [machine rate]", attributes, "cost");
  assert.equal(stored, "[attr:time] * [attr:rate]");
  // Renaming an input does not break the formula, and the shown text follows the new name.
  const renamed = attributes.map((a) => (a.id === "time" ? { ...a, name: "duration" } : a));
  assert.equal(getDisplayFormula(stored, renamed, "cost"), "[duration] * [machine rate]");
  assert.equal(evaluateDerivedAttribute({ ...renamed[3], formula: stored }, renamed).value, 24);
});

test("a formula can build on another formula", () => {
  const attributes = [
    ...job,
    derived("machine", "machine cost", "[print time] * [machine rate]"),
    derived("material", "material cost", "[mass] / 1000 * 25"),
    derived("total", "total cost", "[machine cost] + [material cost]"),
  ];
  assert.equal(evaluateDerivedAttribute(attributes[5], attributes).value, 27);
});

test("an input without a value means not calculable yet, not zero and not a mistake", () => {
  const empty = [number("mass", "mass", ""), number("price", "price", "10")];
  assert.throws(
    () => calc("[mass] * [price]", empty),
    (error) => isFormulaPending(error) && /"mass" has no value yet/.test((error as Error).message),
  );
  // The same for a division by zero, which an empty or zero input produces.
  assert.throws(() => calc("[price] / 0", empty), isFormulaPending);
  assert.throws(() => calc("[price] / [mass]", [number("mass", "mass", "0"), empty[1]]), isFormulaPending);
});

test("mistakes in a formula are errors, and say what is wrong", () => {
  const message = (formula: string, inputs: NodeAttribute[] = job) => {
    try {
      calc(formula, inputs);
      return "no error";
    } catch (error) {
      assert.ok(!isFormulaPending(error), `${formula} is a mistake, not a missing value`);
      return (error as Error).message;
    }
  };
  assert.match(message("[weight] * 2"), /Unknown attribute "weight"/);
  assert.match(message("[mass] * "), /incomplete/);
  assert.match(message("(1 + 2"), /parentheses/);
  assert.match(message("[mass] ^ 2"), /Unexpected token/);
  assert.match(message("pow([mass], 2)"), /Unknown function "pow"/);
  assert.match(message("mass * 2"), /Unknown function "mass".*square brackets/);
  assert.match(message("max"), /parentheses/);
  assert.match(message("round([mass], 1, 2)"), /round takes/);
  assert.match(message("min()"), /min takes/);
  assert.match(message("1, 2"), /comma/);
  assert.match(message("round([mass], 0.5)"), /decimals/);
  assert.match(message("sqrt(-4)"), /negative/);
  assert.match(message(""), /required/);
  assert.match(message("[rush] + 1", [{ id: "rush", name: "rush", value: "true", unit: "", type: "boolean" }]), /not numeric/);
  // A formula cannot refer to itself, directly or in a circle.
  const circle = [derived("a", "a", "[b] + 1"), derived("b", "b", "[a] + 1")];
  assert.throws(() => evaluateDerivedAttribute(circle[0], circle), /Circular/);
});

test("results are shown without rounding noise", () => {
  assert.equal(formatDerivedValue(0.1 + 0.2), "0.3");
  assert.equal(formatDerivedValue(24), "24");
  assert.equal(formatDerivedValue(Number.NaN), "");
});

test("recalculating brings every calculated value up to date", () => {
  const attributes = [
    ...job,
    derived("machine", "machine cost", "[attr:time] * [attr:rate]", "999"),
    derived("total", "total cost", "[attr:machine] + 1", ""),
  ];
  const fresh = recalculateDerivedAttributes(attributes);
  assert.deepEqual(fresh.map((a) => a.value), ["120", "6", "4", "24", "25"]);
  // Inputs are untouched, and nothing is copied when nothing changed.
  assert.equal(fresh[0], attributes[0]);
  assert.equal(recalculateDerivedAttributes(fresh), fresh);
});

test("a value that cannot be calculated is left empty rather than stale", () => {
  const attributes = [number("time", "print time", ""), derived("cost", "cost", "[attr:time] * 4", "24")];
  assert.equal(recalculateDerivedAttributes(attributes)[1].value, "");
  const broken = [number("time", "print time", "6"), derived("cost", "cost", "[attr:gone] * 4", "24")];
  assert.equal(recalculateDerivedAttributes(broken)[1].value, "");
});

test("functions: min, max, sum, avg, round, floor, ceil, abs, sqrt", () => {
  assert.equal(calc("min([mass], [print time], 10)", job), 6);
  assert.equal(calc("max([mass], [print time]) / 2", job), 60);
  assert.equal(calc("sum([mass], [print time], [machine rate])", job), 130);
  assert.equal(calc("avg([print time], [machine rate])", job), 5);
  assert.equal(calc("AVERAGE(2, 4, 9)"), 5, "names in any case; average for avg");
  assert.equal(calc("round(2.5)"), 3);
  assert.equal(calc("round(-2.5)"), -3, "half away from zero, as by hand");
  assert.equal(calc("round(1.005, 2)"), 1.01);
  assert.equal(calc("round([mass] / 7, 1)", job), 17.1);
  assert.equal(calc("floor(2.9) + ceil(2.1)"), 5);
  assert.equal(calc("abs(3 - [mass])", job), 117);
  assert.equal(calc("sqrt(16)"), 4);
  // Functions nest and mix with operators; a minus in front of one applies to its result.
  assert.equal(calc("-max(1, min(5, 3)) * 2"), -6);
});

test("a function with an input that has no value yet is not calculated yet", () => {
  const empty = [number("a", "a", "3"), number("b", "b", "")];
  assert.throws(() => calc("max([a], [b])", empty), isFormulaPending);
  // A mistake elsewhere is still reported, not hidden behind the empty input.
  assert.throws(
    () => calc("max([b], [weight])", empty),
    (error) => !isFormulaPending(error) && /Unknown attribute "weight"/.test((error as Error).message),
  );
});

test("references inside functions are stored by id and shown by name", () => {
  const stored = getStoredFormulaFromDisplay("max([mass], [print time])", job, "result");
  assert.equal(stored, "max([attr:mass], [attr:time])");
  assert.equal(getDisplayFormula(stored, job, "result"), "max([mass], [print time])");
  assert.deepEqual(
    evaluateDerivedAttribute(derived("result", "result", stored), [...job, derived("result", "result", stored)]).references,
    ["mass", "print time"],
  );
});
