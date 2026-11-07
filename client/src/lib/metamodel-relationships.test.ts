import assert from "node:assert/strict";
import test from "node:test";
import {
  getConfiguredMagicRelationTypes,
  magicRelationTypeCatalog,
  magicRelationTypeEnum,
  normalizeMetamodelSetup,
} from "@shared/metamodel-setup";
import {
  getEdgeMarkers,
  getRelationSemantics,
  RELATION_MARKER_IDS,
} from "../components/flow/utils/edge-utils";
import { validateInstanceModel } from "@shared/model-validation";

test("documents rendering semantics for every supported relationship", () => {
  assert.deepEqual(magicRelationTypeCatalog.map((relation) => relation.id), [
    ...magicRelationTypeEnum,
  ]);
  assert.equal(getRelationSemantics("composition").sourceMarker, "composition");
  assert.equal(getRelationSemantics("dependency").lineStyle, "dashed");
  assert.equal(getRelationSemantics("realization").targetMarker, "generalization");
});

test("setup can opt into new relationship types without changing legacy defaults", () => {
  assert.deepEqual(getConfiguredMagicRelationTypes(undefined), [
    "association",
    "aggregation",
    "generalization",
  ]);
  const setup = normalizeMetamodelSetup({
    version: 1,
    purpose: "custom",
    nodeTypes: ["partdef"],
    relationTypes: ["composition", "dependency", "realization"],
  });
  assert.deepEqual(setup?.relationTypes, [
    "composition",
    "dependency",
    "realization",
  ]);
});

test("new relationship markers and line styles survive edge normalization", () => {
  const composition = getEdgeMarkers({ edgeType: "composition" });
  assert.equal(
    composition.markerStart,
    `url(#${RELATION_MARKER_IDS.composition})`,
  );
  assert.equal(composition.data.lineStyle, "solid");

  const dependency = getEdgeMarkers({ edgeType: "dependency" });
  assert.equal(dependency.markerStart, undefined);
  assert.deepEqual(dependency.markerEnd, {
    type: "arrow",
    color: "hsl(var(--muted-foreground))",
    strokeWidth: 2,
  });
  assert.equal(dependency.data.lineStyle, "dashed");

  const realization = getEdgeMarkers({ edgeType: "realization" });
  assert.equal(
    realization.markerEnd,
    `url(#${RELATION_MARKER_IDS.generalization})`,
  );
  assert.equal(realization.data.targetArrow, "none");
});

test("validation matches configured relationships by their selected type", () => {
  const model = {
    nodes: [
      { id: "whole", type: "part", data: { label: "Whole", typeId: "whole-type" } },
      { id: "part", type: "part", data: { label: "Part", typeId: "part-type" } },
    ],
    edges: [
      {
        id: "contains",
        source: "whole",
        target: "part",
        edgeType: "composition",
        data: { label: "contains" },
      },
    ],
  };
  const metamodel = {
    typeNodes: [
      { id: "whole-type", label: "Whole" },
      { id: "part-type", label: "Part" },
    ],
    relationEdges: [
      {
        sourceTypeId: "whole-type",
        targetTypeId: "part-type",
        edgeType: "composition",
        label: "contains",
      },
    ],
    parentMap: new Map<string, Set<string>>(),
  };
  assert.deepEqual(validateInstanceModel(model, metamodel), []);
  assert.equal(
    validateInstanceModel(
      {
        ...model,
        edges: [{ ...model.edges[0], edgeType: "association" }],
      },
      metamodel,
    ).length,
    1,
  );
});