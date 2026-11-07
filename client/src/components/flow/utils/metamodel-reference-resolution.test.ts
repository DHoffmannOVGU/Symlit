import assert from "node:assert/strict";
import test from "node:test";
import {
  collectReferencedMetamodelIds,
  resolveReferencedMetamodelFlow,
} from "./metamodel-reference-resolution";

test("canonicalizes referenced metamodel nodes and relationships", () => {
  const resolved = resolveReferencedMetamodelFlow({
    metamodelId: 10,
    viewId: 4,
    nodes: [
      {
        id: "system",
        type: "partdef",
        data: { label: "System", icon: "Box" },
      },
      {
        id: "behavior",
        type: "actiondef",
        data: { label: "Behavior", typeId: "system" },
      },
      {
        id: "ignored",
        type: "part",
        data: { label: "Instance, not a type" },
      },
      {
        id: "unnamed",
        type: "partdef",
        data: {},
      },
    ],
    edges: [
      {
        id: "uses",
        source: "behavior",
        target: "system",
        edgeType: "dependency",
        data: { label: "uses" },
      },
      {
        id: "orphan",
        source: "behavior",
        target: "missing",
        edgeType: "association",
      },
    ],
  });

  assert.deepEqual(resolved.partDefs, [
    { id: "mm:10:system", label: "System" },
    { id: "mm:10:behavior", label: "Behavior" },
  ]);
  assert.equal(resolved.partDefNodes[1].data.typeId, "mm:10:system");
  assert.equal(resolved.partDefNodes[1].data._originTypeId, "behavior");
  assert.deepEqual(resolved.partDefEdges, [
    {
      id: "mm:10:4:uses",
      edgeType: "dependency",
      flowType: undefined,
      label: "uses",
      sourceTypeId: "mm:10:behavior",
      targetTypeId: "mm:10:system",
    },
  ]);
});

test("preserves owning project IDs for nested or cross-project type references", () => {
  const resolved = resolveReferencedMetamodelFlow({
    metamodelId: 20,
    viewId: 8,
    nodes: [
      {
        id: "base",
        projectId: 11,
        type: "partdef",
        data: { label: "Base" },
      },
      {
        id: "derived",
        projectId: 20,
        type: "partdef",
        data: { label: "Derived", typeId: "base" },
      },
    ],
    edges: [
      {
        id: "inherits",
        source: "derived",
        target: "base",
        type: "generalization",
      },
    ],
  });

  assert.equal(resolved.partDefNodes[0].id, "mm:11:base");
  assert.equal(resolved.partDefNodes[1].data.typeId, "mm:20:base");
  assert.deepEqual(resolved.partDefEdges[0], {
    id: "mm:20:8:inherits",
    edgeType: "generalization",
    flowType: undefined,
    label: undefined,
    sourceTypeId: "mm:20:derived",
    targetTypeId: "mm:11:base",
  });
});

test("traverses nested references once and reports missing projects", () => {
  const result = collectReferencedMetamodelIds(
    [1, 1, 0, -2, 3],
    new Map([
      [1, { referencedMetamodels: [2, 3, "4", 0] }],
      [2, { referencedMetamodels: [1, 4] }],
      [3, { referencedMetamodels: [] }],
    ]),
  );

  assert.deepEqual(result.loadedIds, [1, 3, 2, 4]);
  assert.deepEqual(result.missingIds, [4]);
});

test("ignores malformed nested reference lists", () => {
  const result = collectReferencedMetamodelIds(
    [5],
    new Map([[5, { referencedMetamodels: { nested: 6 } }]]),
  );

  assert.deepEqual(result, { loadedIds: [5], missingIds: [] });
});