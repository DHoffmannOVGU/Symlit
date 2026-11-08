import assert from "node:assert/strict";
import test from "node:test";
import type { Node } from "@xyflow/react";
import {
  aiMetamodelProposalSchema,
  type AiMetamodelProposal,
} from "@shared/ai-metamodel";
import {
  buildMetamodelProposalElements,
  chooseMetamodelProposalLayoutDirection,
} from "./ai-metamodel-apply";
import {
  filterAiMetamodelProposal,
  reviewAiMetamodelProposal,
} from "./ai-metamodel-review";

test("turns a validated AI proposal into canvas-native metamodel elements", () => {
  const proposal: AiMetamodelProposal = {
    summary: "Add a sensor and its concern.",
    nodes: [
      { id: "sensor", kind: "object", name: "Sensor", description: "Measures temperature", attributes: [{ name: "Accuracy", description: "Measurement accuracy", type: "number", unit: "%", options: [] }] },
      { id: "privacy", kind: "concern", name: "Privacy", description: "Privacy exposure", attributes: [] },
    ],
    edges: [{ source: "sensor", target: "privacy", relation: "association", label: "raises", description: "Sensor data raises a concern" }],
  };
  const existing = [{ id: "existing", type: "partdef", position: { x: 10, y: 20 }, data: { label: "Existing" } }] as Node[];
  const result = buildMetamodelProposalElements(proposal, existing, [], (kind, index) => `${kind}_${index}`);
  assert.deepEqual(result.nodes.map((node) => [node.id, node.type, node.data.label]), [
    ["node_0", "partdef", "Sensor"],
    ["node_1", "concerndef", "Privacy"],
  ]);
  assert.equal((result.nodes[0]?.data.attributes as Array<{ unit?: string }>)[0]?.unit, "%");
  assert.deepEqual([result.edges[0]?.source, result.edges[0]?.target, result.edges[0]?.type], ["node_0", "node_1", "association"]);
});

test("allows proposals to connect a new element to an existing canvas element", () => {
  const proposal: AiMetamodelProposal = {
    summary: "Connect an event.",
    nodes: [{ id: "alarm", kind: "event", name: "Alarm", description: "", attributes: [] }],
    edges: [{ source: "alarm", target: "existing", relation: "association", label: "notifies", description: "" }],
  };
  const existing = [{ id: "existing", position: { x: 0, y: 0 }, data: {} }] as Node[];
  const result = buildMetamodelProposalElements(proposal, existing, [], (kind, index) => `${kind}_${index}`);
  assert.deepEqual([result.edges[0]?.source, result.edges[0]?.target], ["node_0", "existing"]);
});

test("chooses a vertical layout for hierarchical proposals", () => {
  const proposal: AiMetamodelProposal = {
    summary: "Add a component hierarchy.",
    nodes: [
      { id: "system", kind: "object", name: "System", description: "", attributes: [] },
      { id: "component", kind: "object", name: "Component", description: "", attributes: [] },
    ],
    edges: [{ source: "system", target: "component", relation: "aggregation", label: "contains", description: "" }],
  };

  assert.equal(chooseMetamodelProposalLayoutDirection(proposal), "TB");
});

test("chooses a horizontal layout for process-oriented proposals", () => {
  const proposal: AiMetamodelProposal = {
    summary: "Add an operating sequence.",
    nodes: [
      { id: "trigger", kind: "event", name: "Trigger", description: "", attributes: [] },
      { id: "respond", kind: "behavior", name: "Respond", description: "", attributes: [] },
    ],
    edges: [{ source: "trigger", target: "respond", relation: "association", label: "starts", description: "" }],
  };

  assert.equal(chooseMetamodelProposalLayoutDirection(proposal), "LR");
});

test("marks overlaps and invalid endpoints before anything can be applied", () => {
  const proposal: AiMetamodelProposal = {
    summary: "Review a proposal",
    nodes: [
      { id: "existing-sensor", kind: "object", name: "Sensor", description: "", attributes: [] },
      { id: "room", kind: "object", name: "Room", description: "", attributes: [] },
    ],
    edges: [
      { source: "room", target: "missing", relation: "association", label: "", description: "" },
      { source: "room", target: "room", relation: "association", label: "", description: "" },
    ],
    warnings: [],
  };
  const review = reviewAiMetamodelProposal(
    proposal,
    {
      nodes: [{ id: "existing", name: "Sensor", kind: "object", description: "", attributes: [] }],
      edges: [],
    },
    ["object"],
    ["association"],
  );

  assert.equal(review.nodes[0]?.status, "overlap");
  assert.equal(review.nodes[1]?.status, "new");
  assert.equal(review.edges[0]?.status, "invalid");
  assert.equal(review.edges[1]?.status, "invalid");
  assert.deepEqual(review.defaultSelectedNodeIds, ["room"]);
  assert.deepEqual(review.defaultSelectedEdgeIndexes, []);
  assert.ok(review.warnings.some((warning) => warning.includes("Overlaps")));
  assert.ok(review.warnings.some((warning) => warning.includes("not in the current")));
});

test("filters an explicitly approved subset without retaining orphan relationships", () => {
  const proposal: AiMetamodelProposal = {
    summary: "Add two related elements",
    nodes: [
      { id: "sensor", kind: "object", name: "Sensor", description: "", attributes: [] },
      { id: "room", kind: "object", name: "Room", description: "", attributes: [] },
    ],
    edges: [
      { source: "sensor", target: "existing", relation: "association", label: "", description: "" },
      { source: "sensor", target: "room", relation: "association", label: "", description: "" },
    ],
    warnings: [],
  };
  const filtered = filterAiMetamodelProposal(
    proposal,
    {
      nodes: [{ id: "existing", name: "Existing", kind: "object", description: "", attributes: [] }],
      edges: [],
    },
    new Set(["sensor"]),
    new Set([0, 1]),
  );

  assert.deepEqual(filtered.nodes.map((node) => node.id), ["sensor"]);
  assert.deepEqual(
    filtered.edges.map((edge) => [edge.source, edge.target]),
    [["sensor", "existing"]],
  );
});

test("rejects duplicate proposal identifiers at the shared boundary", () => {
  const parsed = aiMetamodelProposalSchema.safeParse({
    summary: "Duplicate nodes",
    nodes: [
      { id: "same", kind: "object", name: "One", description: "", attributes: [] },
      { id: "same", kind: "object", name: "Two", description: "", attributes: [] },
    ],
    edges: [],
  });

  assert.equal(parsed.success, false);
  if (!parsed.success) {
    assert.match(parsed.error.issues[0]?.message ?? "", /Duplicate proposed node id/);
  }
});
