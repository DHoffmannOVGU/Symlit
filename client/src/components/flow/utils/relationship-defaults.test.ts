import assert from "node:assert/strict";
import test from "node:test";
import type { PartDefEdge } from "../hooks/useMetamodelParts";
import type { DiagramNode } from "../types";
import { allowedRelations, defaultRelation, newRelationshipEdge, relationOptions, typeIdOf } from "./relationship-defaults";

// Metamodel: Drone --composition "powered by"--> Battery, Drone --association--> Payload,
// and Camera is a kind of Payload (generalization).
const relations: PartDefEdge[] = [
  { id: "r1", edgeType: "composition", label: "powered by", sourceTypeId: "drone", targetTypeId: "battery" },
  { id: "r2", edgeType: "association", sourceTypeId: "drone", targetTypeId: "payload" },
  { id: "r3", edgeType: "aggregation", label: "carries", sourceTypeId: "drone", targetTypeId: "payload" },
];
const parentMap = new Map([["camera", new Set(["payload"])]]);
const typeMeta = new Map([
  ["drone", { label: "Drone" }],
  ["battery", { label: "Battery" }],
  ["payload", { label: "Payload" }],
]);

test("finds the relationships the metamodel allows, including via supertypes", () => {
  assert.deepEqual(allowedRelations("drone", "battery", parentMap, relations).map((r) => r.id), ["r1"]);
  assert.deepEqual(allowedRelations("drone", "camera", parentMap, relations).map((r) => r.id), ["r2", "r3"]);
  assert.deepEqual(allowedRelations("battery", "drone", parentMap, relations), [], "direction matters");
  assert.deepEqual(allowedRelations(undefined, "drone", parentMap, relations), []);
});

test("suggests a named relationship first", () => {
  assert.equal(defaultRelation(allowedRelations("drone", "camera", parentMap, relations))?.id, "r3");
  assert.equal(defaultRelation([]), undefined);
});

test("labels the choices for the confirmation popover", () => {
  const options = relationOptions(allowedRelations("drone", "payload", parentMap, relations), typeMeta);
  assert.deepEqual(options.map((o) => o.displayLabel), ["Drone → Payload (association)", "carries"]);
});

test("an element's type is its typeId, or itself when it is a metamodel type", () => {
  const instance = { id: "x", position: { x: 0, y: 0 }, data: { typeId: "drone" } } as DiagramNode;
  const type = { id: "battery", position: { x: 0, y: 0 }, data: {} } as DiagramNode;
  const other = { id: "y", position: { x: 0, y: 0 }, data: {} } as DiagramNode;
  assert.equal(typeIdOf(instance, typeMeta), "drone");
  assert.equal(typeIdOf(type, typeMeta), "battery");
  assert.equal(typeIdOf(other, typeMeta), undefined);
});

test("new relationships carry their type, label and markers", () => {
  const edge = newRelationshipEdge({
    id: "e", source: "a", target: "b", sourceHandle: "right", targetHandle: "left", edgeType: "composition", label: "powered by",
  });
  assert.equal(edge.type, "composition");
  assert.equal(edge.data?.edgeType, "composition");
  assert.equal(edge.data?.label, "powered by");
  assert.ok(edge.markerStart, "composition has a diamond at the source");
});
