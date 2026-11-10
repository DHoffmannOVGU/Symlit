import assert from "node:assert/strict";
import test from "node:test";
import { describeMultiplicity, formatMultiplicity, isUnrestricted, parseMultiplicity } from "./multiplicity";

test("reads numbers, ranges and open ranges", () => {
  assert.deepEqual(parseMultiplicity("1"), { min: 1, max: 1 });
  assert.deepEqual(parseMultiplicity("0..1"), { min: 0, max: 1 });
  assert.deepEqual(parseMultiplicity(" 1 .. * "), { min: 1, max: null });
  assert.deepEqual(parseMultiplicity("2..12"), { min: 2, max: 12 });
  for (const any of ["", "  ", "*", undefined, null]) {
    assert.deepEqual(parseMultiplicity(any), { min: 0, max: null }, String(any));
  }
});

test("rejects what is not a multiplicity", () => {
  for (const bad of ["many", "1..", "..3", "3..1", "0", "0..0", "1-3", "1..n", "-1", "1.5", "*..1"]) {
    assert.equal(parseMultiplicity(bad), null, bad);
  }
});

test("formats canonically and describes in words", () => {
  const cases: Array<[string, string, string]> = [
    ["1..1", "1", "exactly 1"],
    ["0 .. 1", "0..1", "at most 1"],
    ["1..*", "1..*", "at least 1"],
    ["2..5", "2..5", "2 to 5"],
    ["0..*", "*", "any number"],
  ];
  for (const [input, formatted, words] of cases) {
    const parsed = parseMultiplicity(input)!;
    assert.equal(formatMultiplicity(parsed), formatted, input);
    assert.equal(describeMultiplicity(parsed), words, input);
  }
  assert.equal(isUnrestricted(parseMultiplicity("*")!), true);
  assert.equal(isUnrestricted(parseMultiplicity("0..1")!), false);
});
