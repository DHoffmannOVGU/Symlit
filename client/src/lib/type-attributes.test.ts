import assert from "node:assert/strict";
import test from "node:test";
import type { NodeAttribute } from "@/components/flow/types";
import { attributesFromType, missingTypeAttributes } from "./type-attributes";

const attr = (id: string, name: string, extra: Partial<NodeAttribute> = {}): NodeAttribute => ({
  id,
  name,
  value: "",
  unit: "",
  type: "number",
  ...extra,
});

const cameraType = "mm:2:camera";
const typeAttributes = [
  attr("res", "resolution", { unit: "MP", description: "Sensor resolution", value: "12" }),
  attr("fps", "frame rate", { unit: "Hz" }),
  attr("pixels", "pixels", { type: "derived", formula: "[res] * 1000000" }),
];

test("a new typed element gets copies of its type's attributes, with definition and default value", () => {
  const copies = attributesFromType(cameraType, typeAttributes);
  assert.deepEqual(copies.map((a) => a.name), ["resolution", "frame rate", "pixels"]);
  assert.equal(copies[0].unit, "MP");
  assert.equal(copies[0].description, "Sensor resolution");
  assert.equal(copies[0].value, "12");
  assert.deepEqual(copies[0].inheritedFrom, { nodeId: cameraType, attrId: "res" });
});

test("copies keep the type attribute ids, so derived formulas still find what they refer to", () => {
  const copies = attributesFromType(cameraType, typeAttributes);
  assert.equal(copies[2].formula, "[res] * 1000000");
  assert.ok(copies.some((a) => a.id === "res"));
});

test("copies are independent of the type", () => {
  const typeList = [attr("opt", "mode", { type: "list", options: ["day", "night"] })];
  const [copy] = attributesFromType(cameraType, typeList);
  copy.options!.push("thermal");
  assert.deepEqual(typeList[0].options, ["day", "night"]);
});

test("unnamed or malformed type attributes are not copied", () => {
  assert.deepEqual(attributesFromType(cameraType, [attr("x", "  "), null, { name: "no id" }]), []);
  assert.deepEqual(attributesFromType(cameraType, undefined), []);
});

test("missing attributes: the ones the element has neither by id nor by name", () => {
  const element = [
    attr("res", "resolution"),
    attr("own", "Frame Rate"), // the element defined it itself, under another id
  ];
  assert.deepEqual(missingTypeAttributes(element, cameraType, typeAttributes).map((a) => a.name), ["pixels"]);
});

test("an attribute the element renamed is not offered again", () => {
  const element = attributesFromType(cameraType, typeAttributes).map((a) =>
    a.id === "fps" ? { ...a, id: "fps-copy", name: "fps" } : a,
  );
  assert.deepEqual(missingTypeAttributes(element, cameraType, typeAttributes), []);
});
