import assert from "node:assert/strict";
import test from "node:test";
import {
  displayAttributeValue,
  formatMultiselectValue,
  keepExistingOptions,
  parseMultiselectValue,
} from "./attribute-values";

test("a multiselect value is stored as a JSON array, in the order of the options", () => {
  const options = ["PLA", "PETG", "ABS, food safe"];
  assert.equal(formatMultiselectValue(["ABS, food safe", "PLA"], options), '["PLA","ABS, food safe"]');
  assert.equal(formatMultiselectValue([], options), "", "nothing chosen is an empty value");
  assert.equal(formatMultiselectValue(["Nylon"], options), "", "an option that does not exist is dropped");
  assert.deepEqual(parseMultiselectValue('["PLA","ABS, food safe"]'), ["PLA", "ABS, food safe"]);
});

test("a multiselect value written by hand or by a list is read too", () => {
  assert.deepEqual(parseMultiselectValue("PLA, PETG"), ["PLA", "PETG"]);
  assert.deepEqual(parseMultiselectValue("PLA"), ["PLA"]);
  assert.deepEqual(parseMultiselectValue(""), []);
  assert.deepEqual(parseMultiselectValue('["PLA","PLA"," "]'), ["PLA"], "no duplicates, no blanks");
  assert.deepEqual(parseMultiselectValue("[not json"), ["[not json"]);
});

test("removing an option removes it from the chosen ones", () => {
  assert.equal(keepExistingOptions('["PLA","PETG"]', ["PETG", "ABS"]), '["PETG"]');
});

test("values are shown as people read them", () => {
  assert.equal(displayAttributeValue({ type: "multiselect", value: '["PLA","PETG"]' }), "PLA, PETG");
  assert.equal(displayAttributeValue({ type: "boolean", value: "true" }), "Yes");
  assert.equal(displayAttributeValue({ type: "number", value: "4.2" }), "4.2");
});
