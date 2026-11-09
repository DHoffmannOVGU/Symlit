import assert from "node:assert/strict";
import test from "node:test";
import {
  applyTypeStyle,
  elementCardAppearance,
  matchesTypeStyle,
  pickElementStyle,
  showsDescription,
  syncWithTypeStyle,
  typeStyle,
  withElementStyle,
} from "./element-style";

const OBJECT_DEFAULTS = { icon: "Box", color: "#22c55e" };

// A type in a metamodel with a full style, and an instance element of it.
const cameraType = {
  label: "Camera",
  icon: "Camera",
  color: "#3b82f6",
  borderWidth: 3,
  borderStyle: "dashed",
  shape: "pill",
  fill: "tint",
  showTypeLabel: false,
  descriptionOnCard: "show",
};
const cameraStyle = typeStyle(cameraType, OBJECT_DEFAULTS);
const newElement = { label: "Front camera", typeId: "camera", inheritStyle: true };

test("a type hands down every style setting, not only icon and colour", () => {
  assert.deepEqual(cameraStyle, {
    icon: "Camera",
    color: "#3b82f6",
    borderWidth: 3,
    borderStyle: "dashed",
    shape: "pill",
    fill: "tint",
    showTypeLabel: false,
    descriptionOnCard: "show",
  });
});

test("a type without its own icon or colour hands down its kind's defaults", () => {
  assert.deepEqual(typeStyle({ label: "Battery" }, OBJECT_DEFAULTS), OBJECT_DEFAULTS);
  assert.deepEqual(typeStyle({ label: "Battery", color: "" }, OBJECT_DEFAULTS), OBJECT_DEFAULTS);
});

test("a new typed element shows its type's style", () => {
  const synced = syncWithTypeStyle(newElement, cameraStyle);
  assert.deepEqual(pickElementStyle(synced), cameraStyle);
  assert.equal(synced.label, "Front camera");
  assert.equal(synced.inheritStyle, true);
});

test("changing the type restyles elements that match it", () => {
  const before = syncWithTypeStyle(newElement, cameraStyle);
  const changedType = typeStyle({ ...cameraType, borderStyle: "dotted", fill: "solid" }, OBJECT_DEFAULTS);
  const after = syncWithTypeStyle(before, changedType);
  assert.equal(after.borderStyle, "dotted");
  assert.equal(after.fill, "solid");
});

test("a setting removed from the type is removed from matching elements", () => {
  const before = syncWithTypeStyle(newElement, cameraStyle);
  const { shape: _shape, ...withoutShape } = cameraType;
  const after = syncWithTypeStyle(before, typeStyle(withoutShape, OBJECT_DEFAULTS));
  assert.equal("shape" in after, false);
});

test("an element with its own style keeps it when the type changes", () => {
  const own = withElementStyle(
    { label: "Thermal camera", typeId: "camera", inheritStyle: false },
    { icon: "Flame", color: "#f43f5e", borderStyle: "solid" },
  );
  const changedType = typeStyle({ ...cameraType, color: "#a855f7" }, OBJECT_DEFAULTS);
  assert.equal(syncWithTypeStyle(own, changedType), own);
});

test("matching the type again replaces the element's own style completely", () => {
  const own = withElementStyle(
    { label: "Thermal camera", typeId: "camera", inheritStyle: false },
    { icon: "Flame", color: "#f43f5e", fill: "solid" },
  );
  const matched = applyTypeStyle(own, typeStyle({ label: "Camera" }, OBJECT_DEFAULTS));
  assert.deepEqual(pickElementStyle(matched), OBJECT_DEFAULTS);
  assert.equal(matched.inheritStyle, true);
});

test("syncing an element that already matches returns the same object", () => {
  const synced = syncWithTypeStyle(newElement, cameraStyle);
  assert.equal(syncWithTypeStyle(synced, cameraStyle), synced);
});

test("untyped elements and elements of an unknown type are left alone", () => {
  const untyped = { label: "Sketch", icon: "Box", inheritStyle: true };
  assert.equal(matchesTypeStyle(untyped), false);
  assert.equal(syncWithTypeStyle(untyped, cameraStyle), untyped);
  assert.equal(syncWithTypeStyle(newElement, undefined), newElement);
});

test("elements saved before inheritStyle existed match their type unless they had an icon or colour", () => {
  assert.equal(matchesTypeStyle({ typeId: "camera" }), true);
  assert.equal(matchesTypeStyle({ typeId: "camera", color: "#f43f5e" }), false);
  assert.equal(matchesTypeStyle({ typeId: "camera", icon: "Flame" }), false);
});

test("malformed stored settings are dropped instead of rendered", () => {
  assert.deepEqual(
    pickElementStyle({ icon: "", color: "red", borderWidth: 9, borderStyle: "wavy", shape: 1, fill: "tint", showTypeLabel: "no" }),
    { fill: "tint" },
  );
});

test("card appearance: defaults look like before, solid fill uses the accent colour", () => {
  const plain = elementCardAppearance({}, "#22c55e");
  assert.equal(plain.borderWidth, 2);
  assert.equal(plain.borderStyle, "solid");
  assert.equal(plain.borderRadius, 12);
  assert.equal(plain.backgroundColor, undefined);
  assert.equal(plain.showTypeLabel, true);

  const solid = elementCardAppearance({ fill: "solid", shape: "square" }, "#22c55e");
  assert.equal(solid.backgroundColor, "#22c55e");
  assert.equal(solid.onSolid, true);
  assert.equal(solid.borderRadius, 4);
  assert.equal(elementCardAppearance({ fill: "tint" }, "#22c55e").backgroundColor, "#22c55e1A");
});

test("an element's description setting overrides the canvas setting; unset follows it", () => {
  assert.equal(showsDescription({ descriptionOnCard: "show" }, false), true);
  assert.equal(showsDescription({ descriptionOnCard: "hide" }, true), false);
  assert.equal(showsDescription({}, true), true);
  assert.equal(showsDescription({}, false), false);
  assert.deepEqual(pickElementStyle({ descriptionOnCard: "always" }), {});
});

test("requirements typed by a type that shows descriptions show theirs, until they choose otherwise", () => {
  const requirementType = typeStyle({ label: "Safety requirement", descriptionOnCard: "show" }, OBJECT_DEFAULTS);
  const requirement = syncWithTypeStyle({ label: "REQ-1", typeId: "req" }, requirementType);
  assert.equal(showsDescription(pickElementStyle(requirement), false), true);

  const hidden = withElementStyle({ ...requirement, inheritStyle: false }, { ...requirementType, descriptionOnCard: "hide" });
  assert.equal(showsDescription(pickElementStyle(syncWithTypeStyle(hidden, requirementType)), true), false);
});
