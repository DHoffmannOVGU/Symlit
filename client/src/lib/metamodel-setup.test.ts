import { test } from "node:test";
import assert from "node:assert/strict";
import { insertProjectSchema } from "@shared/schema";
import {
  getConfiguredMagicNodeTypes,
  getConfiguredMagicRelationTypes,
  getMetamodelPurposeRecommendation,
  normalizeMetamodelSetup,
} from "@shared/metamodel-setup";

test("purpose recommendations provide focused node and relation vocabularies", () => {
  const requirements = getMetamodelPurposeRecommendation("requirements");

  assert.deepEqual(requirements.nodeTypes, [
    "requirementdef",
    "partdef",
    "agentdef",
    "capabilitydef",
  ]);
  assert.deepEqual(requirements.relationTypes, [
    "association",
    "generalization",
  ]);
});

test("setup normalization removes duplicate selections and keeps a node fallback", () => {
  const normalized = normalizeMetamodelSetup({
    version: 1,
    purpose: "custom",
    description: "  A focused language  ",
    nodeTypes: ["partdef", "partdef"],
    relationTypes: ["association", "association"],
  });

  assert.deepEqual(normalized, {
    version: 1,
    purpose: "custom",
    description: "A focused language",
    nodeTypes: ["partdef"],
    relationTypes: ["association"],
  });

  const emptyNodes = normalizeMetamodelSetup({
    version: 1,
    purpose: "custom",
    nodeTypes: [],
    relationTypes: [],
  });
  assert.deepEqual(emptyNodes?.nodeTypes, ["partdef"]);
  assert.deepEqual(emptyNodes?.relationTypes, []);
});

test("legacy projects expose every built-in type while configured projects stay focused", () => {
  assert.deepEqual(getConfiguredMagicNodeTypes(undefined), [
    "partdef",
    "actiondef",
    "concerndef",
    "agentdef",
    "requirementdef",
    "eventdef",
    "capabilitydef",
  ]);
  assert.deepEqual(
    getConfiguredMagicRelationTypes(undefined),
    ["association", "aggregation", "generalization"],
  );

  const setup = getMetamodelPurposeRecommendation("behavior");
  assert.deepEqual(getConfiguredMagicNodeTypes(setup), [
    "actiondef",
    "eventdef",
    "agentdef",
    "partdef",
  ]);
  assert.deepEqual(getConfiguredMagicRelationTypes(setup), [
    "association",
    "aggregation",
  ]);
});

test("project persistence accepts configured setup and keeps setup optional for legacy projects", () => {
  const setup = getMetamodelPurposeRecommendation("architecture");
  const configuredProject = insertProjectSchema.parse({
    userId: 42,
    name: "Architecture language",
    projectType: "metamodel",
    metamodelSetup: setup,
  });
  assert.deepEqual(configuredProject.metamodelSetup, setup);

  const legacyProject = insertProjectSchema.parse({
    userId: 42,
    name: "Legacy language",
    projectType: "metamodel",
  });
  assert.equal(legacyProject.metamodelSetup, undefined);
});
test("the built-in Requirement kind is called Need; old diagrams are read with the new name", async () => {
  const { currentKindLabel, isNeedKindLabel, magicNodeTypeCatalog } = await import("@shared/metamodel-setup");
  assert.equal(magicNodeTypeCatalog.find((kind) => kind.id === "requirementdef")?.label, "Need");
  // A metamodel element of the kind, and an untyped instance element.
  assert.equal(currentKindLabel("Requirement", { nodeType: "requirementdef" }), "Need");
  assert.equal(currentKindLabel("Requirement", { nodeType: "part" }), "Need");
  // An instance element typed by someone's own "Requirement" type keeps it.
  assert.equal(currentKindLabel("Requirement", { nodeType: "part", typeId: "mm:2:req" }), "Requirement");
  // A metamodel element of another kind that someone labelled "Requirement" keeps it.
  assert.equal(currentKindLabel("Requirement", { nodeType: "partdef" }), "Requirement");
  // Earlier renames are unchanged.
  assert.equal(currentKindLabel("Part", { nodeType: "part", typeId: "x" }), "Object");
  assert.equal(currentKindLabel("Sensor", { nodeType: "part" }), "Sensor");
  assert.equal(isNeedKindLabel("Requirement"), true);
  assert.equal(isNeedKindLabel("Need"), true);
});
