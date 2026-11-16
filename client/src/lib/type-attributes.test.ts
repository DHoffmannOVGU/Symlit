import assert from "node:assert/strict";
import test from "node:test";
import type { NodeAttribute } from "@/components/flow/types";
import { attributesForElementOfType, attributesFromType, missingTypeAttributes } from "./type-attributes";

const attr = (id: string, name: string, extra: Partial<NodeAttribute> = {}): NodeAttribute => ({
  id,
  name,
  value: "",
  unit: "",
  type: "number",
  ...extra,
});

const cameraType = "mm:2:camera";
const NO_PARENTS = new Map<string, Set<string>>();
/** The metamodel as the diagram knows it: one type, Camera. */
const cameraOnly = () => [{ id: cameraType, data: { attributes: typeAttributes } }];
const typeAttributes = [
  attr("res", "resolution", { unit: "MP", description: "Sensor resolution", value: "12" }),
  attr("fps", "frame rate", { unit: "Hz" }),
  attr("pixels", "pixels", { type: "derived", formula: "[attr:res] * 1000000" }),
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
  assert.equal(copies[2].formula, "[attr:res] * 1000000");
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
  assert.deepEqual(missingTypeAttributes(element, cameraType, cameraOnly(), NO_PARENTS).map((a) => a.name), ["pixels"]);
});

test("an attribute the element renamed is not offered again", () => {
  const element = attributesFromType(cameraType, typeAttributes).map((a) =>
    a.id === "fps" ? { ...a, id: "fps-copy", name: "fps" } : a,
  );
  assert.deepEqual(missingTypeAttributes(element, cameraType, cameraOnly(), NO_PARENTS), []);
});

// --- attributes along a Generalization --------------------------------------------

const deviceType = "mm:2:device";
const thermalType = "mm:2:thermal-camera";
const metamodel = [
  { id: deviceType, data: { attributes: [attr("mass", "mass", { unit: "g", value: "100" }), attr("res-d", "resolution", { unit: "px" })] } },
  { id: cameraType, data: { attributes: typeAttributes } },
  { id: thermalType, data: { attributes: [attr("range", "temperature range", { unit: "K" })] } },
];
// Thermal camera is a Camera, and a Camera is a Device.
const parents = new Map([
  [thermalType, new Set([cameraType])],
  [cameraType, new Set([deviceType])],
]);

test("an element also gets the attributes of the types its type specializes, nearest first", () => {
  const copies = attributesForElementOfType(thermalType, metamodel, parents);
  assert.deepEqual(copies.map((a) => a.name), ["temperature range", "resolution", "frame rate", "pixels", "mass"]);
  // Each copy says which type it came from.
  assert.deepEqual(copies.map((a) => a.inheritedFrom?.nodeId), [thermalType, cameraType, cameraType, cameraType, deviceType]);
});

test("an attribute defined closer to the type wins over one of the same name further up", () => {
  const copies = attributesForElementOfType(cameraType, metamodel, parents);
  const resolution = copies.filter((a) => a.name === "resolution");
  assert.equal(resolution.length, 1);
  assert.equal(resolution[0].unit, "MP", "Camera's own resolution, not Device's");
});

test("calculated values of a new element are worked out from its own starting values", () => {
  const copies = attributesForElementOfType(cameraType, metamodel, parents);
  assert.equal(copies.find((a) => a.name === "pixels")?.value, "12000000");
});

test("an element is offered what its type gained further up, too", () => {
  const element = attributesFromType(cameraType, typeAttributes);
  assert.deepEqual(missingTypeAttributes(element, cameraType, metamodel, parents).map((a) => a.name), ["mass"]);
});

test("a type that specializes nothing gives only its own attributes", () => {
  assert.deepEqual(
    attributesForElementOfType(deviceType, metamodel, parents).map((a) => a.name),
    ["mass", "resolution"],
  );
  assert.deepEqual(attributesForElementOfType("mm:2:unknown", metamodel, parents), []);
});
