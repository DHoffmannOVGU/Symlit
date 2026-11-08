import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { withTestDatabase } from "../testing/test-db";
import { edges, nodeViews, nodes, projects, users, views } from "@shared/schema";
import {
  assignFreshStarterIds,
  buildStarterViewRecords,
  getFlow,
  getFlowRecovery,
  syncFlow,
  validateFlowRecords,
  validateStarterTemplate,
} from "./flow-mutations";

withTestDatabase();

test("associates starter nodes, node views, and edges with the created view", () => {
  const records = buildStarterViewRecords(501, 601, {
    nodes: [
      {
        id: "alpha",
        type: "part",
        position: { x: 10, y: 20 },
        data: { label: "Alpha" },
      },
      {
        id: "beta",
        type: "part",
        position: { x: 30, y: 40 },
        data: { label: "Beta" },
        parentId: "alpha",
      },
    ],
    edges: [
      {
        id: "alpha-beta",
        source: "alpha",
        target: "beta",
        edgeType: "association",
        sourceHandle: null,
        targetHandle: null,
        data: { label: "contains" },
      },
    ],
  });

  assert.deepEqual(records.nodes, [
    {
      id: "alpha",
      projectId: 501,
      type: "part",
      data: { label: "Alpha" },
    },
    {
      id: "beta",
      projectId: 501,
      type: "part",
      data: { label: "Beta" },
    },
  ]);
  assert.deepEqual(records.nodeViews, [
    {
      nodeId: "alpha",
      viewId: 601,
      position: { x: 10, y: 20 },
      parentId: null,
    },
    {
      nodeId: "beta",
      viewId: 601,
      position: { x: 30, y: 40 },
      parentId: "alpha",
    },
  ]);
  assert.deepEqual(records.edges, [
    {
      id: "alpha-beta",
      source: "alpha",
      target: "beta",
      edgeType: "association",
      // Stored in canonical form (shared/relationships.ts).
      sourceHandle: "bottom",
      targetHandle: "top",
      data: { label: "contains", edgeType: "association" },
      viewId: 601,
    },
  ]);
});

test("keeps records isolated when two starter views are created", () => {
  const first = buildStarterViewRecords(700, 701, {
    nodes: [
      {
        id: "first-node",
        position: { x: 0, y: 0 },
        data: { label: "First" },
      },
    ],
    edges: [],
  });
  const second = buildStarterViewRecords(700, 702, {
    nodes: [
      {
        id: "second-node",
        position: { x: 0, y: 0 },
        data: { label: "Second" },
      },
    ],
    edges: [],
  });

  assert.equal(first.nodeViews[0]?.viewId, 701);
  assert.equal(second.nodeViews[0]?.viewId, 702);
  assert.equal(first.nodes[0]?.projectId, 700);
  assert.equal(second.nodes[0]?.projectId, 700);
});

test("rejects duplicate IDs before a malformed starter can be persisted", () => {
  assert.throws(
    () =>
      validateStarterTemplate([
        {
          name: "First",
          nodes: [
            {
              id: "duplicate-node",
              position: { x: 0, y: 0 },
              data: {},
            },
          ],
          edges: [],
        },
        {
          name: "Second",
          nodes: [
            {
              id: "duplicate-node",
              position: { x: 0, y: 0 },
              data: {},
            },
          ],
          edges: [],
        },
      ]),
    /duplicate node IDs/,
  );

  assert.throws(
    () =>
      validateStarterTemplate([
        {
          name: "First",
          nodes: [],
          edges: [
            {
              id: "duplicate-edge",
              source: "a",
              target: "b",
              edgeType: "association",
              data: {},
            },
          ],
        },
        {
          name: "Second",
          nodes: [],
          edges: [
            {
              id: "duplicate-edge",
              source: "c",
              target: "d",
              edgeType: "association",
              data: {},
            },
          ],
        },
      ]),
    /duplicate edge IDs/,
  );
});

test("rejects malformed flow records before persistence", () => {
  assert.throws(
    () =>
      validateFlowRecords(
        [
          {
            id: "node-1",
            position: { x: Number.NaN, y: 20 },
            data: {},
          },
        ],
        [],
      ),
    /Expected number, received nan/,
  );

  assert.throws(
    () =>
      validateFlowRecords(
        [
          { id: "node-1", position: { x: 0, y: 0 }, data: {} },
        ],
        [
          {
            id: "edge-1",
            source: "node-1",
            target: "missing-node",
          },
        ],
      ),
    /does not reference a node/,
  );
});

test("recovers a corrupted saved view without losing valid nodes or relationships", async () => {
  const suffix = randomUUID();
  const username = `flow-recovery-${suffix}`;
  const validNodeIds = [`${suffix}-source`, `${suffix}-target`];
  const malformedNodeId = `${suffix}-bad-position`;
  const validEdgeId = `${suffix}-valid-edge`;
  const orphanEdgeId = `${suffix}-orphan-edge`;

  const [user] = await db.insert(users).values({ username }).returning();
  const [project] = await db
    .insert(projects)
    .values({
      userId: user.id,
      name: "Recovery integration fixture",
      projectType: "metamodel",
    })
    .returning();
  const [view] = await db
    .insert(views)
    .values({
      projectId: project.id,
      name: "Corrupted recovery fixture",
    })
    .returning();

  try {
    await db.insert(nodes).values([
      {
        id: validNodeIds[0],
        projectId: project.id,
        type: "part",
        data: { label: "Valid source" },
      },
      {
        id: validNodeIds[1],
        projectId: project.id,
        type: "part",
        data: { label: "Valid target" },
      },
      {
        id: malformedNodeId,
        projectId: project.id,
        type: "part",
        data: { label: "Invalid position" },
      },
      // Exists, but is not placed in this view: the relationship below is
      // dangling from the diagram's point of view. (Edges to elements that do
      // not exist at all are rejected by foreign keys.)
      {
        id: `${suffix}-missing-node`,
        projectId: project.id,
        type: "part",
        data: { label: "Not in this diagram" },
      },
    ]);
    await db.insert(nodeViews).values([
      {
        nodeId: validNodeIds[0],
        viewId: view.id,
        position: { x: 40, y: 80 },
      },
      {
        nodeId: validNodeIds[1],
        viewId: view.id,
        position: { x: 240, y: 80 },
      },
      {
        nodeId: malformedNodeId,
        viewId: view.id,
        position: { x: "not-a-number", y: 160 },
      },
    ]);
    await db.insert(edges).values([
      {
        id: validEdgeId,
        viewId: view.id,
        source: validNodeIds[0],
        target: validNodeIds[1],
        edgeType: "association",
        data: { label: "valid relationship" },
      },
      {
        id: orphanEdgeId,
        viewId: view.id,
        source: validNodeIds[0],
        target: `${suffix}-missing-node`,
        edgeType: "association",
        data: { label: "orphan relationship" },
      },
    ]);

    await assert.rejects(
      () => getFlow(view.id),
      /Expected number, received string/,
    );

    const recovery = await getFlowRecovery(view.id);
    assert.ok(recovery);
    assert.equal(recovery.issues.length, 2);
    assert.deepEqual(
      recovery.issues.map((issue) => [issue.type, issue.id, issue.field]),
      [
        ["node", malformedNodeId, "position.x"],
        ["edge", orphanEdgeId, "target"],
      ],
    );

    const repairedNodes = recovery.nodes
      .filter((node) => node.id !== malformedNodeId)
      .map((node) => ({
        id: node.id,
        type: node.type,
        position: node.position as { x: number; y: number },
        data: node.data,
        parentId: node.parentId ?? null,
      }));
    const repairedEdges = recovery.edges.filter(
      (edge) => edge.id === validEdgeId,
    );

    await syncFlow(view.id, repairedNodes, repairedEdges);

    const repairedFlow = await getFlow(view.id);
    assert.deepEqual(
      repairedFlow.nodes.map((node) => ({
        id: node.id,
        position: node.position,
        data: node.data,
      })),
      [
        {
          id: validNodeIds[0],
          position: { x: 40, y: 80 },
          data: { label: "Valid source" },
        },
        {
          id: validNodeIds[1],
          position: { x: 240, y: 80 },
          data: { label: "Valid target" },
        },
      ],
    );
    assert.deepEqual(
      repairedFlow.edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        data: edge.data,
      })),
      [
        {
          id: validEdgeId,
          source: validNodeIds[0],
          target: validNodeIds[1],
          data: { label: "valid relationship", edgeType: "association" },
        },
      ],
    );
  } finally {
    await db.delete(nodeViews).where(eq(nodeViews.viewId, view.id));
    await db.delete(edges).where(eq(edges.viewId, view.id));
    await db.delete(nodes).where(
      inArray(nodes.id, [...validNodeIds, malformedNodeId]),
    );
    await db.delete(views).where(eq(views.id, view.id));
    await db.delete(projects).where(eq(projects.id, project.id));
    await db.delete(users).where(and(eq(users.id, user.id), eq(users.username, username)));
  }
});
test("assigns fresh ids to template elements and keeps shared elements shared", () => {
  let counter = 0;
  const [first, second] = assignFreshStarterIds(
    [
      {
        name: "One",
        nodes: [
          { id: "a", position: { x: 0, y: 0 }, data: {} },
          { id: "b", position: { x: 1, y: 1 }, data: {}, parentId: "a" },
        ],
        edges: [{ id: "ab", source: "a", target: "b", edgeType: "association", sourceHandle: null, targetHandle: null }],
      },
      {
        name: "Two",
        nodes: [{ id: "a", position: { x: 5, y: 5 }, data: {} }],
        edges: [],
      },
    ],
    (kind) => `${kind}-${++counter}`,
  );
  const [a, b] = first.nodes;
  assert.notEqual(a.id, "a");
  assert.equal(b.parentId, a.id, "parent references follow the new id");
  assert.equal(first.edges[0].source, a.id);
  assert.equal(first.edges[0].target, b.id);
  assert.notEqual(first.edges[0].id, "ab");
  assert.equal(second.nodes[0].id, a.id, "the same template element stays one element");
  assert.equal(new Set([a.id, b.id, first.edges[0].id]).size, 3);
});
