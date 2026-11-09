import assert from "node:assert/strict";
import test from "node:test";
import { diagramSignature, normalizeFlow, toCanvasGraph, toSavePayload } from "./diagram-serialization";
import { flowResponseSchema, flowSyncInputSchema } from "@shared/routes";
import type { MagicRelationType } from "@shared/metamodel-setup";

type PersistedNode = Parameters<typeof normalizeFlow>[0][number];
type PersistedEdge = Parameters<typeof normalizeFlow>[1][number];

const node = (overrides: Partial<PersistedNode> = {}): PersistedNode => ({
  id: "node-1",
  type: "part",
  position: { x: 10, y: 20 },
  data: { label: "System", type: "Part" },
  ...overrides,
});

const edge = (
  edgeType: MagicRelationType,
  overrides: Partial<PersistedEdge> = {},
): PersistedEdge => ({
  id: `${edgeType}-1`,
  source: "node-1",
  target: "node-2",
  edgeType,
  sourceHandle: "right",
  targetHandle: "left",
  data: {
    edgeType,
    label: "relationship",
    multiplicity: "1..*",
    description: `${edgeType} relationship`,
  },
  ...overrides,
});

test("normalizes legacy node type labels without changing node data", () => {
  const signature = normalizeFlow(
    [
      node({ id: "part", data: { label: "A", type: "Part", custom: true } }),
      node({ id: "action", data: { label: "B", type: "Action" } }),
      node({ id: "agent", data: { label: "C", type: "Agent" } }),
    ],
    [],
    "metamodel",
  );

  assert.deepEqual(JSON.parse(signature), {
    nodes: [
      {
        id: "action",
        type: "part",
        position: { x: 10, y: 20 },
        data: { label: "B", type: "Behavior" },
        parentId: null,
      },
      {
        id: "agent",
        type: "part",
        position: { x: 10, y: 20 },
        data: { label: "C", type: "Performer" },
        parentId: null,
      },
      {
        id: "part",
        type: "part",
        position: { x: 10, y: 20 },
        data: { label: "A", type: "Object", custom: true },
        parentId: null,
      },
    ],
    edges: [],
  });
});

test("normalizes malformed persisted data instead of throwing", () => {
  const malformedNodes: PersistedNode[] = [
    node({ id: "invalid-node-data", data: "not-an-object" }),
    node({ id: "null-node-data", data: null }),
    node({ id: "array-node-data", data: ["not", "an", "object"] }),
  ];
  const malformedEdges: PersistedEdge[] = [
    edge("association", {
      id: "invalid-edge-data",
      edgeType: "unsupported",
      data: "not-an-object",
    }),
    edge("association", {
      id: "array-edge-data",
      edgeType: null,
      data: ["not", "an", "object"],
    }),
  ];

  assert.doesNotThrow(() => {
    normalizeFlow(malformedNodes, malformedEdges, "instance");
  });

  assert.deepEqual(
    JSON.parse(normalizeFlow(malformedNodes, malformedEdges, "instance")),
    {
      nodes: [
        {
          id: "array-node-data",
          type: "part",
          position: { x: 10, y: 20 },
          data: {},
          parentId: null,
        },
        {
          id: "invalid-node-data",
          type: "part",
          position: { x: 10, y: 20 },
          data: {},
          parentId: null,
        },
        {
          id: "null-node-data",
          type: "part",
          position: { x: 10, y: 20 },
          data: {},
          parentId: null,
        },
      ],
      edges: [
        {
          id: "array-edge-data",
          source: "node-1",
          target: "node-2",
          edgeType: "association",
          sourceHandle: "right",
          targetHandle: "left",
          data: { edgeType: "association" },
        },
        {
          id: "invalid-edge-data",
          source: "node-1",
          target: "node-2",
          edgeType: "association",
          sourceHandle: "right",
          targetHandle: "left",
          data: { edgeType: "association" },
        },
      ],
    },
  );
});

test("preserves association, aggregation, and generalization edge metadata", () => {
  const signature = normalizeFlow(
    [],
    [
      edge("generalization"),
      edge("aggregation"),
      edge("association"),
    ],
    "instance",
  );
  const loaded = JSON.parse(signature);
  const roundTrippedSignature = normalizeFlow(
    loaded.nodes,
    loaded.edges,
    "instance",
  );

  assert.equal(roundTrippedSignature, signature);

  const { edges } = loaded;
  assert.deepEqual(
    edges.map((savedEdge: Record<string, unknown>) => ({
      id: savedEdge.id,
      edgeType: savedEdge.edgeType,
      sourceHandle: savedEdge.sourceHandle,
      targetHandle: savedEdge.targetHandle,
      data: savedEdge.data,
    })),
    [
      {
        id: "aggregation-1",
        edgeType: "aggregation",
        sourceHandle: "right",
        targetHandle: "left",
        data: {
          edgeType: "aggregation",
          label: "relationship",
          multiplicity: "1..*",
          description: "aggregation relationship",
        },
      },
      {
        id: "association-1",
        edgeType: "association",
        sourceHandle: "right",
        targetHandle: "left",
        data: {
          edgeType: "association",
          label: "relationship",
          multiplicity: "1..*",
          description: "association relationship",
        },
      },
      {
        id: "generalization-1",
        edgeType: "generalization",
        sourceHandle: "right",
        targetHandle: "left",
        data: {
          edgeType: "generalization",
          label: "relationship",
          multiplicity: "1..*",
          description: "generalization relationship",
        },
      },
    ],
  );
});

test("loading and serializing a saved diagram keeps the normalized signature", () => {
  const savedNodes = [
    node({ id: "z-node", type: null, data: { label: "Z", type: "Part" } }),
    node({ id: "a-node", type: "", data: { label: "A", type: "Action" } }),
  ];
  const savedEdges = [
    edge("aggregation", { id: "z-edge" }),
    edge("generalization", { id: "a-edge" }),
  ];

  const loadedSignature = normalizeFlow(
    savedNodes,
    savedEdges,
    "metamodel",
  );
  const loaded = JSON.parse(loadedSignature);
  const serializedAgain = normalizeFlow(
    loaded.nodes,
    loaded.edges,
    "metamodel",
  );

  assert.equal(serializedAgain, loadedSignature);
});

test("round-trips the expanded relationship vocabulary", () => {
  const savedEdges = ([
    "composition",
    "dependency",
    "realization",
  ] as MagicRelationType[]).map((edgeType) => edge(edgeType));
  const loaded = JSON.parse(normalizeFlow([], savedEdges, "metamodel"));
  const serializedAgain = normalizeFlow([], loaded.edges, "metamodel");

  assert.deepEqual(
    loaded.edges.map((savedEdge: Record<string, unknown>) => savedEdge.edgeType),
    ["composition", "dependency", "realization"],
  );
  assert.equal(serializedAgain, normalizeFlow([], savedEdges, "metamodel"));
});

test("rejects saved nodes with missing or non-finite positions before mapping", () => {
  const validFlow = {
    nodes: [
      {
        id: "node-1",
        projectId: 1,
        type: "part",
        data: {},
        createdAt: null,
        position: { x: 10, y: 20 },
      },
    ],
    edges: [],
  };

  assert.equal(flowResponseSchema.safeParse(validFlow).success, true);
  assert.equal(
    flowResponseSchema
      .safeParse({
        ...validFlow,
        nodes: [{ ...validFlow.nodes[0], position: undefined }],
      })
      .success,
    false,
  );
  assert.equal(
    flowResponseSchema
      .safeParse({
        ...validFlow,
        nodes: [{ ...validFlow.nodes[0], position: { x: NaN, y: 20 } }],
      })
      .success,
    false,
  );
});

test("rejects saved edges with missing identity or orphaned endpoints", () => {
  const validFlow = {
    nodes: [
      {
        id: "node-1",
        projectId: 1,
        type: "part",
        data: {},
        createdAt: null,
        position: { x: 10, y: 20 },
      },
      {
        id: "node-2",
        projectId: 1,
        type: "part",
        data: {},
        createdAt: null,
        position: { x: 30, y: 40 },
      },
    ],
    edges: [
      {
        id: "edge-1",
        source: "node-1",
        target: "node-2",
      },
    ],
  };

  assert.equal(flowResponseSchema.safeParse(validFlow).success, true);
  assert.equal(
    flowResponseSchema
      .safeParse({
        ...validFlow,
        edges: [{ ...validFlow.edges[0], source: "missing-node" }],
      })
      .success,
    false,
  );
  assert.equal(
    flowResponseSchema
      .safeParse({
        ...validFlow,
        edges: [{ ...validFlow.edges[0], id: "" }],
      })
      .success,
    false,
  );
});

test("rejects sync payloads with malformed geometry and endpoints", () => {
  const validPayload = {
    nodes: [
      {
        id: "node-1",
        position: { x: 10, y: 20 },
        data: {},
      },
      {
        id: "node-2",
        position: { x: 30, y: 40 },
        data: {},
      },
    ],
    edges: [
      {
        id: "edge-1",
        source: "node-1",
        target: "node-2",
      },
    ],
  };

  assert.equal(flowSyncInputSchema.safeParse(validPayload).success, true);
  assert.equal(
    flowSyncInputSchema
      .safeParse({
        ...validPayload,
        nodes: [{ ...validPayload.nodes[0], position: { x: 10 } }, validPayload.nodes[1]],
      })
      .success,
    false,
  );
  assert.equal(
    flowSyncInputSchema
      .safeParse({
        ...validPayload,
        edges: [{ ...validPayload.edges[0], target: "missing-node" }],
      })
      .success,
    false,
  );
});
test("loading and saving an unchanged diagram gives the same signature", () => {
  const stored = {
    nodes: [
      { id: "a", type: "part", projectId: 1, position: { x: 0, y: 0 }, data: { label: "A", type: "Part", _nodeStyle: { width: 320, height: 180 } }, createdAt: null },
      { id: "b", type: "part", projectId: 1, position: { x: 400, y: 0 }, data: { label: "B" }, createdAt: null },
    ],
    edges: [
      { id: "ab", source: "a", target: "b", edgeType: "composition", sourceHandle: "right", targetHandle: "left", data: { edgeType: "composition", label: "has" } },
      { id: "ba", source: "b", target: "a", edgeType: "association", sourceHandle: null, targetHandle: "right-target", data: null },
    ],
  };
  const canvas = toCanvasGraph(stored);
  const loaded = diagramSignature(canvas.nodes, canvas.edges, "instance");
  const payload = toSavePayload(canvas.nodes, canvas.edges, "instance");
  assert.equal(diagramSignature(payload.nodes, payload.edges, "instance"), loaded);

  // What the canvas restores from the stored form.
  assert.deepEqual(canvas.nodes[0].style, { width: 320, height: 180 }, "resized elements keep their size");
  assert.equal((canvas.nodes[0].data as { type?: string }).type, "Object", "old type labels are canonical");
  assert.deepEqual([canvas.edges[1].sourceHandle, canvas.edges[1].targetHandle], ["bottom", "right"]);
  // What is saved: sizes in data, relationships in canonical form.
  assert.deepEqual((payload.nodes[0].data as { _nodeStyle?: unknown })._nodeStyle, { width: 320, height: 180 });
  assert.equal(payload.edges[0].edgeType, "composition");
  assert.equal((payload.edges[0].data as { edgeType?: string }).edgeType, "composition");
  assert.ok(flowSyncInputSchema.safeParse(payload).success, "the save payload passes the save checks");
});

test("copying a type's style onto matching elements after loading is not an unsaved change", async () => {
  const { syncWithTypeStyle } = await import("@/lib/element-style");
  const typeStyle = { icon: "Cpu", color: "#3b82f6", borderStyle: "dashed" as const };
  // Stored without any style (e.g. created through the API, or before styles were copied).
  const stored = [node({ data: { label: "Sensor 1", type: "Sensor", typeId: "mm:2:sensor" } })];
  const loaded = stored.map((n) => ({ ...n, data: syncWithTypeStyle(n.data as Record<string, unknown>, typeStyle) }));
  assert.equal(loaded[0].data.borderStyle, "dashed");
  assert.equal(normalizeFlow(loaded, [], "instance"), normalizeFlow(stored, [], "instance"));
});

test("choosing an element's own style, or matching its type again, is an unsaved change", () => {
  const matching = [node({ data: { label: "S", typeId: "mm:2:sensor", inheritStyle: true, icon: "Cpu", color: "#3b82f6" } })];
  const own = [node({ data: { label: "S", typeId: "mm:2:sensor", inheritStyle: false, icon: "Cpu", color: "#3b82f6" } })];
  const ownRecoloured = [node({ data: { label: "S", typeId: "mm:2:sensor", inheritStyle: false, icon: "Cpu", color: "#f43f5e" } })];
  assert.notEqual(normalizeFlow(matching, [], "instance"), normalizeFlow(own, [], "instance"));
  assert.notEqual(normalizeFlow(own, [], "instance"), normalizeFlow(ownRecoloured, [], "instance"));
});

test("style changes on types in a metamodel are always unsaved changes", () => {
  const before = [node({ type: "partdef", data: { label: "Sensor", icon: "Cpu" } })];
  const after = [node({ type: "partdef", data: { label: "Sensor", icon: "Cpu", fill: "tint" } })];
  assert.notEqual(normalizeFlow(before, [], "metamodel"), normalizeFlow(after, [], "metamodel"));
});
