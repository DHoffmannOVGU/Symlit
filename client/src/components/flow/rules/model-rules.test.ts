import assert from "node:assert/strict";
import test from "node:test";
import type { Edge, Node } from "@xyflow/react";
import { modelRuleSchema, type ModelRule } from "@shared/schema";
import { canonicalizeReferencedModelRule, evaluateModelRuleResults, evaluateModelRules, getModelRuleTargetOptions, supportsModelRules } from "./model-rules";

const nodes = [
  {
    id: "object-1",
    type: "part",
    position: { x: 0, y: 0 },
    data: {
      label: "Crate",
      typeId: "crate-type",
      attributes: [{ id: "weight", name: "Weight", type: "number", value: "125", unit: "kg" }],
    },
  },
  {
    id: "concern-1",
    type: "part",
    position: { x: 0, y: 0 },
    data: {
      label: "Handling safety",
      typeId: "concern-type",
      attributes: [{ id: "risk", name: "Risk", type: "string", value: "At risk", unit: "" }],
    },
  },
  {
    id: "object-2",
    type: "part",
    position: { x: 0, y: 0 },
    data: {
      label: "Envelope",
      typeId: "crate-type",
      attributes: [{ id: "weight", name: "Weight", type: "number", value: "0.2", unit: "kg" }],
    },
  },
] as Node[];

const edges = [{ id: "edge-1", source: "object-1", target: "concern-1" }] as Edge[];

test("makes the shared rules workspace available to metamodel and instance editors", () => {
  assert.equal(supportsModelRules("metamodel"), true);
  assert.equal(supportsModelRules("instance"), true);
  assert.equal(supportsModelRules("method"), false);
});

test("classifies an object from a numeric attribute", () => {
  const rule: ModelRule = {
    id: "heavy", name: "Heavy objects", enabled: true, targetType: "node:crate-type",
    condition: { kind: "comparison", source: "self", field: "attribute", attribute: "Weight", operator: "greater-than", value: "100" },
    outcome: { kind: "tag", label: "Heavy" },
  };
  const matches = evaluateModelRuleResults([rule], nodes, edges);
  assert.deepEqual(matches.map((match) => match.nodeId), ["object-1"]);
  assert.equal(matches[0]?.outcome.kind, "tag");
});

test("classifies an object when at least one connected concern is at risk", () => {
  const rule: ModelRule = {
    id: "risk", name: "Risk exposure", enabled: true, targetType: "node:crate-type",
    condition: {
      kind: "comparison", source: "connected", quantifier: "any", direction: "any",
      targetType: "node:concern-type", field: "attribute", attribute: "Risk", operator: "equals", value: "at risk",
    },
    outcome: { kind: "tag", label: "Risk exposed", color: "#dc2626" },
  };
  assert.deepEqual(evaluateModelRuleResults([rule], nodes, edges).map((match) => match.nodeId), ["object-1"]);
});

test("supports nested all/any condition groups and diagnostic outcomes", () => {
  const rule: ModelRule = {
    id: "review", name: "Review heavy risks", enabled: true, targetType: "node:crate-type",
    condition: {
      kind: "group", combinator: "all", conditions: [
        { kind: "comparison", source: "self", field: "attribute", attribute: "weight", operator: "greater-than", value: "100" },
        { kind: "group", combinator: "any", conditions: [
          { kind: "comparison", source: "connected", quantifier: "any", targetType: "node:concern-type", field: "attribute", attribute: "risk", operator: "equals", value: "At Risk" },
          { kind: "comparison", source: "self", field: "name", operator: "contains", value: "urgent" },
        ] },
      ],
    },
    outcome: { kind: "issue", severity: "warning", message: "Needs handling review." },
  };
  const violations = evaluateModelRules([rule], nodes, edges);
  assert.equal(violations.length, 1);
  assert.equal(violations[0]?.message, "Needs handling review.");
});

test("continues to evaluate rules saved by the original MVP", () => {
  const legacy: ModelRule = {
    id: "description", name: "Descriptions", enabled: true, targetType: "all",
    check: "missing-description", severity: "error",
  };
  const violations = evaluateModelRules([legacy], nodes, edges);
  assert.equal(violations.length, 3);
  assert.ok(violations.every((violation) => violation.severity === "error"));
});

test("canonicalizes metamodel type targets before evaluating instance objects", () => {
  const authoredRule: ModelRule = {
    id: "risk", name: "Risk exposure", enabled: true, targetType: "node:crate-type",
    condition: {
      kind: "comparison", source: "connected", targetType: "node:concern-type",
      field: "attribute", attribute: "risk", operator: "equals", value: "At risk",
    },
    outcome: { kind: "tag", label: "Risk exposed" },
  };
  const loadedRule = canonicalizeReferencedModelRule(authoredRule, 42, 7);
  assert.equal(loadedRule.targetType, "node:mm:42:crate-type");
  assert.equal(loadedRule.condition?.kind === "comparison" && loadedRule.condition.targetType, "node:mm:42:concern-type");
  const instanceNodes = nodes.map((node) => ({
    ...node,
    data: {
      ...node.data,
      typeId: node.id === "concern-1" ? "mm:42:concern-type" : "mm:42:crate-type",
    },
  })) as Node[];
  assert.deepEqual(evaluateModelRuleResults([loadedRule], instanceNodes, edges).map((match) => match.nodeId), ["object-1"]);
});

test("accepts complete flexible rules in the persistence contract and rejects unfinished ones", () => {
  const complete = {
    id: "heavy", name: "Heavy objects", enabled: true, targetType: "all",
    condition: { kind: "comparison", source: "self", field: "attribute", attribute: "Weight", operator: "greater-than", value: "100" },
    outcome: { kind: "tag", label: "Heavy" },
  };
  assert.equal(modelRuleSchema.safeParse(complete).success, true);
  assert.equal(modelRuleSchema.safeParse({
    ...complete,
    condition: { ...complete.condition, attribute: "", value: "" },
  }).success, false);
});

test("combines inherited meta rules and instance-local rules against instance objects", () => {
  const metaRule = canonicalizeReferencedModelRule({
    id: "heavy", name: "Heavy objects", enabled: true, targetType: "node:crate-type",
    condition: { kind: "comparison", source: "self", field: "attribute", attribute: "Weight", operator: "greater-than", value: "100" },
    outcome: { kind: "tag", label: "Heavy" },
  }, 42, 7);
  const instanceRule: ModelRule = {
    id: "local-envelope", name: "Local handling", enabled: true, targetType: "all",
    condition: { kind: "comparison", source: "self", field: "name", operator: "equals", value: "Envelope" },
    outcome: { kind: "issue", severity: "warning", message: "Handle locally." },
  };
  const instanceNodes = nodes.map((node) => ({
    ...node,
    data: { ...node.data, typeId: node.id === "concern-1" ? "mm:42:concern-type" : "mm:42:crate-type" },
  })) as Node[];
  const results = evaluateModelRuleResults([metaRule, instanceRule], instanceNodes, edges);
  assert.deepEqual(results.map((result) => [result.ruleId, result.nodeId]), [
    ["mm:42:7:heavy", "object-1"],
    ["local-envelope", "object-2"],
  ]);
  assert.deepEqual(getModelRuleTargetOptions(instanceNodes).builtInTypes.find((option) => option.value === "mm:42:crate-type"), {
    value: "mm:42:crate-type",
    label: "mm:42:crate-type",
  });
});
