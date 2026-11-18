import assert from "node:assert/strict";
import test from "node:test";
import { buildParentMapFromNodes } from "@shared/metamodel-inheritance";
import { validateInstanceModel } from "@shared/model-validation";

const metamodel = {
  typeNodes: [
    { id: "component", label: "Component" },
    { id: "sensor", label: "Sensor" },
    { id: "device", label: "Device" },
  ],
  relationEdges: [
    {
      sourceTypeId: "component",
      targetTypeId: "sensor",
      edgeType: "association",
      label: "observes",
    },
  ],
  parentMap: new Map<string, Set<string>>([
    ["sensor", new Set(["device"])],
  ]),
};

test("accepts relationships inherited from a parent type", () => {
  const issues = validateInstanceModel(
    {
      nodes: [
        { id: "c", type: "part", data: { label: "Controller", typeId: "component" } },
        { id: "s", type: "part", data: { label: "Thermometer", typeId: "sensor" } },
      ],
      edges: [
        {
          id: "observes",
          source: "c",
          target: "s",
          edgeType: "association",
          data: { label: " observes " },
        },
      ],
    },
    metamodel,
  );

  assert.deepEqual(issues, []);
});

test("reports missing instance types and unknown type references", () => {
  const issues = validateInstanceModel(
    {
      nodes: [
        { id: "untyped", type: "part", data: { label: "Untyped" } },
        {
          id: "stale",
          type: "part",
          data: { label: "Stale", typeId: "removed-type" },
        },
      ],
      edges: [],
    },
    metamodel,
  );

  assert.deepEqual(
    issues.map(({ id, message }) => ({ id, message })),
    [
      { id: "untyped", message: 'Node "Untyped" has no type selected.' },
      {
        id: "stale",
        message: 'Node "Stale" references missing type "removed-type".',
      },
    ],
  );
});

test("reports missing endpoints, unsupported relations, and invalid labels", () => {
  const issues = validateInstanceModel(
    {
      nodes: [
        { id: "c", type: "part", data: { label: "Controller", typeId: "component" } },
        { id: "s", type: "part", data: { label: "Thermometer", typeId: "sensor" } },
      ],
      edges: [
        {
          id: "missing-target",
          source: "c",
          target: "gone",
          edgeType: "association",
          data: { label: "observes" },
        },
        {
          id: "wrong-kind",
          source: "c",
          target: "s",
          edgeType: "composition",
          data: { label: "observes" },
        },
        {
          id: "wrong-label",
          source: "c",
          target: "s",
          edgeType: "association",
          data: { label: "controls" },
        },
      ],
    },
    metamodel,
  );

  assert.deepEqual(
    issues.map(({ id, message }) => ({ id, message })),
    [
      {
        id: "missing-target",
        message: 'Edge "missing-target" references a missing target "gone" node.',
      },
      {
        id: "wrong-kind",
        message: 'Edge "observes" is not allowed for Component → Sensor.',
      },
      {
        id: "wrong-label",
        message: 'Edge "controls" has an invalid label. Allowed: observes.',
      },
    ],
  );
});

test("builds a usable parent map from type nodes", () => {
  const parentMap = buildParentMapFromNodes([
    { id: "sensor", data: { typeId: "device" } },
    { id: "device", data: { typeId: "component" } },
    { id: "component", data: { typeId: "component" } },
  ]);

  assert.deepEqual(parentMap.get("sensor"), new Set(["device"]));
  assert.deepEqual(parentMap.get("device"), new Set(["component"]));
  assert.equal(parentMap.has("component"), false);
});
test("a relationship that records its metamodel relationship passes with the label it had before a rename", () => {
  // "observes" was renamed to "watches" in the metamodel.
  const renamed = {
    ...metamodel,
    relationEdges: [{ ...metamodel.relationEdges[0], id: "mm:3:7:observes-edge", label: "watches" }],
  };
  const model = (data: { label: string; relationId?: string }, edgeType = "association") => ({
    nodes: [
      { id: "c", type: "part", data: { label: "Controller", typeId: "component" } },
      { id: "s", type: "part", data: { label: "Thermometer", typeId: "sensor" } },
    ],
    edges: [{ id: "e", source: "c", target: "s", edgeType, data }],
  });
  // Drawn before the rename, recording which relationship it is: valid.
  assert.deepEqual(validateInstanceModel(model({ label: "observes", relationId: "observes-edge" }), renamed), []);
  // Without the record, the old label no longer fits.
  assert.match(validateInstanceModel(model({ label: "observes" }), renamed)[0].message, /invalid label. Allowed: watches/);
  // A record of another relationship does not make it valid.
  assert.equal(validateInstanceModel(model({ label: "observes", relationId: "other-edge" }), renamed).length, 1);
  // The kind and the types are still checked.
  assert.match(
    validateInstanceModel(model({ label: "observes", relationId: "observes-edge" }, "composition"), renamed)[0].message,
    /not allowed/,
  );
});
