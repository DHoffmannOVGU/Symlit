import assert from "node:assert/strict";
import test from "node:test";
import { findUnit, searchUnits, UNIT_CATALOG } from "@shared/units";

test("every unit symbol is listed once", () => {
  const symbols = UNIT_CATALOG.flatMap((group) => group.units.map((unit) => unit.symbol));
  assert.equal(new Set(symbols).size, symbols.length);
});

test("stored units resolve to their quantity; anything else is custom", () => {
  assert.equal(findUnit("kg")?.quantity, "Mass");
  assert.equal(findUnit(" Wh ")?.quantity, "Energy");
  assert.equal(findUnit("furlongs"), undefined);
});

test("search matches symbol, name and quantity", () => {
  assert.deepEqual(searchUnits("kwh").flatMap((g) => g.units.map((u) => u.symbol)), ["kWh"]);
  assert.ok(searchUnits("kilo").some((g) => g.quantity === "Mass"));
  const energy = searchUnits("energy");
  assert.equal(energy.length, 1);
  assert.equal(energy[0].units.length, UNIT_CATALOG.find((g) => g.quantity === "Energy")!.units.length);
  assert.equal(searchUnits("").length, UNIT_CATALOG.length);
  assert.deepEqual(searchUnits("zzz"), []);
});
