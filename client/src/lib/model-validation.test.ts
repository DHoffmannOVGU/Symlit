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
// --- Multiplicities -------------------------------------------------------

const droneMetamodel = (multiplicity?: string) => ({
  typeNodes: [
    { id: "drone", label: "Drone" },
    { id: "battery", label: "Battery" },
    { id: "cargo-drone", label: "Cargo drone" },
  ],
  relationEdges: [
    { sourceTypeId: "drone", targetTypeId: "battery", edgeType: "composition", label: "powered by", multiplicity },
  ],
  parentMap: new Map<string, Set<string>>([["cargo-drone", new Set(["drone"])]]),
});

const droneModel = (batteries: number, droneType = "drone") => ({
  nodes: [
    { id: "d", type: "part", data: { label: "Courier X1", typeId: droneType } },
    ...Array.from({ length: batteries }, (_, index) => ({
      id: `b${index}`,
      type: "part",
      data: { label: `Pack ${index}`, typeId: "battery" },
    })),
  ],
  edges: Array.from({ length: batteries }, (_, index) => ({
    id: `e${index}`,
    source: "d",
    target: `b${index}`,
    edgeType: "composition",
    data: { label: "powered by" },
  })),
});

test("a multiplicity is checked per source element", () => {
  const within = validateInstanceModel(droneModel(2), droneMetamodel("1..2"));
  assert.deepEqual(within, []);

  const tooFew = validateInstanceModel(droneModel(0), droneMetamodel("1..2"));
  assert.equal(tooFew.length, 1);
  assert.equal(tooFew[0].type, "node");
  assert.equal(tooFew[0].id, "d");
  assert.equal(tooFew[0].message, '"Courier X1" needs 1 to 2 "powered by" relationships to Battery, but has none.');

  const tooMany = validateInstanceModel(droneModel(3), droneMetamodel("1..2"));
  assert.equal(tooMany.length, 1);
  assert.match(tooMany[0].message, /but has 3\.$/);
  assert.deepEqual(tooMany[0].relatedNodeIds, ["b0", "b1", "b2"]);

  assert.match(
    validateInstanceModel(droneModel(2), droneMetamodel("1"))[0].message,
    /needs exactly 1 "powered by" relationship to Battery, but has 2\./,
  );
});

test("subtypes inherit a multiplicity; the target type is not required to have anything", () => {
  const issues = validateInstanceModel(droneModel(0, "cargo-drone"), droneMetamodel("1..*"));
  assert.equal(issues.length, 1);
  assert.match(issues[0].message, /needs at least 1/);
  // A battery on its own violates nothing: the multiplicity is about drones.
  const lonelyBattery = validateInstanceModel(
    { nodes: [{ id: "b", type: "part", data: { label: "Spare", typeId: "battery" } }], edges: [] },
    droneMetamodel("1"),
  );
  assert.deepEqual(lonelyBattery, []);
});

test("no multiplicity, `*`, or unreadable text restricts nothing", () => {
  for (const multiplicity of [undefined, "", "*", "0..*", "lots"]) {
    assert.deepEqual(validateInstanceModel(droneModel(0), droneMetamodel(multiplicity)), [], String(multiplicity));
    assert.deepEqual(validateInstanceModel(droneModel(5), droneMetamodel(multiplicity)), [], String(multiplicity));
  }
});

test("the source end limits how many sources a target has", () => {
  const metamodel = {
    ...droneMetamodel("1..*"),
    relationEdges: [{ ...droneMetamodel("1..*").relationEdges[0], sourceMultiplicity: "0..1" }],
  };
  // Two drones share one battery: each drone is fine, the battery has too many.
  const model = {
    nodes: [
      { id: "d1", type: "part", data: { label: "Courier X1", typeId: "drone" } },
      { id: "d2", type: "part", data: { label: "Courier X2", typeId: "cargo-drone" } },
      { id: "b", type: "part", data: { label: "Pack A", typeId: "battery" } },
    ],
    edges: ["d1", "d2"].map((source) => ({
      id: `${source}-b`,
      source,
      target: "b",
      edgeType: "composition",
      data: { label: "powered by" },
    })),
  };
  const issues = validateInstanceModel(model, metamodel);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].id, "b");
  assert.equal(issues[0].message, '"Pack A" needs at most 1 "powered by" relationship from Drone, but has 2.');
  assert.deepEqual(issues[0].relatedNodeIds, ["d1", "d2"]);
});

test("relationships in other diagrams count, the same one drawn twice counts once", () => {
  const metamodel = droneMetamodel("1");
  const drone = { id: "d", type: "part", data: { label: "Courier X1", typeId: "drone" } };
  const battery = { id: "b0", type: "part", data: { label: "Pack 0", typeId: "battery" } };
  const powered = (id: string, target = "b0") => ({
    id,
    source: "d",
    target,
    edgeType: "composition",
    data: { label: "powered by" },
  });

  // This diagram shows the drone alone; its battery is connected in another diagram.
  const alone = { nodes: [drone], edges: [] };
  assert.equal(validateInstanceModel(alone, metamodel).length, 1, "without context: counted here only");
  assert.deepEqual(
    validateInstanceModel(alone, metamodel, { nodes: [drone, battery], edges: [powered("elsewhere")] }),
    [],
  );

  // The same relationship drawn here and elsewhere is one relationship.
  const here = { nodes: [drone, battery], edges: [powered("here")] };
  assert.deepEqual(
    validateInstanceModel(here, metamodel, { nodes: [drone, battery], edges: [powered("elsewhere")] }),
    [],
  );

  // A second battery connected elsewhere is one too many.
  const second = { id: "b1", type: "part", data: { label: "Pack 1", typeId: "battery" } };
  const tooMany = validateInstanceModel(here, metamodel, { nodes: [second], edges: [powered("elsewhere", "b1")] });
  assert.equal(tooMany.length, 1);
  assert.match(tooMany[0].message, /needs exactly 1 "powered by" relationship to Battery, but has 2\./);

  // Elements that are only in other diagrams are not reported here.
  const otherDrone = { id: "d9", type: "part", data: { label: "Elsewhere", typeId: "drone" } };
  assert.deepEqual(validateInstanceModel(here, metamodel, { nodes: [otherDrone], edges: [] }), []);
});

test("a large model validates quickly", () => {
  const metamodel = {
    ...droneMetamodel("1..2"),
    relationEdges: [{ ...droneMetamodel("1..2").relationEdges[0], sourceMultiplicity: "1" }],
  };
  const drones = 5000;
  const nodes = [];
  const edges = [];
  for (let index = 0; index < drones; index += 1) {
    nodes.push({ id: `d${index}`, type: "part", data: { label: `Drone ${index}`, typeId: "drone" } });
    for (const pack of [0, 1]) {
      nodes.push({ id: `b${index}-${pack}`, type: "part", data: { label: `Pack ${index}-${pack}`, typeId: "battery" } });
      edges.push({
        id: `e${index}-${pack}`,
        source: `d${index}`,
        target: `b${index}-${pack}`,
        edgeType: "composition",
        data: { label: "powered by" },
      });
    }
  }
  const started = performance.now();
  // Half the model as the open diagram, half as the rest of the project.
  const half = nodes.length / 2;
  const issues = validateInstanceModel(
    { nodes: nodes.slice(0, half), edges: edges.filter((_, index) => index < edges.length / 2) },
    metamodel,
    { nodes: nodes.slice(half), edges: edges.filter((_, index) => index >= edges.length / 2) },
  );
  const elapsed = performance.now() - started;
  assert.deepEqual(issues, []);
  assert.ok(elapsed < 1500, `15,000 elements and 10,000 relationships took ${Math.round(elapsed)} ms`);
});
