import assert from "node:assert/strict";
import test from "node:test";
import { normalizeFlow } from "./useDiagramCanvas";
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