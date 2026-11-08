import assert from "node:assert/strict";
import test from "node:test";
import { createDiagramStore, HISTORY_LIMIT } from "./diagramStore";
import type { DiagramNode } from "../types";

const node = (id: string, x = 0): DiagramNode => ({ id, position: { x, y: 0 }, data: {} }) as DiagramNode;

test("undo and redo restore the graph around a snapshot", () => {
  const store = createDiagramStore();
  const { setNodes, takeSnapshot } = store.getState();
  setNodes([node("a")]);
  takeSnapshot();
  setNodes((current) => [...current, node("b")]);

  store.getState().undo();
  assert.deepEqual(store.getState().nodes.map((n) => n.id), ["a"]);
  assert.equal(store.getState().future.length, 1);

  store.getState().redo();
  assert.deepEqual(store.getState().nodes.map((n) => n.id), ["a", "b"]);
  assert.equal(store.getState().past.length, 1);
});

test("a new snapshot clears redo, identical snapshots are stored once, history is capped", () => {
  const store = createDiagramStore();
  const s = () => store.getState();
  s().setNodes([node("a")]);
  s().takeSnapshot();
  s().takeSnapshot();
  assert.equal(s().past.length, 1);

  s().setNodes([node("a", 10)]);
  s().undo();
  assert.equal(s().future.length, 1);
  s().takeSnapshot();
  assert.equal(s().future.length, 0);

  for (let i = 0; i < HISTORY_LIMIT + 10; i += 1) {
    s().setNodes([node("a", i + 100)]);
    s().takeSnapshot();
  }
  assert.equal(s().past.length, HISTORY_LIMIT);
  s().resetHistory();
  assert.equal(s().past.length, 0);
});

test("undo with no history does nothing", () => {
  const store = createDiagramStore();
  store.getState().setNodes([node("a")]);
  store.getState().undo();
  store.getState().redo();
  assert.deepEqual(store.getState().nodes.map((n) => n.id), ["a"]);
});

test("only one delete confirmation is pending at a time", () => {
  const store = createDiagramStore();
  store.getState().requestDelete({ nodeIds: ["a"], edgeIds: [] });
  store.getState().requestDelete({ nodeIds: ["b"], edgeIds: [] });
  assert.deepEqual(store.getState().pendingDelete?.nodeIds, ["a"]);
  store.getState().cancelDelete();
  assert.equal(store.getState().pendingDelete, null);
});

test("confirming a delete removes elements with their relationships and clears their selection", () => {
  const store = createDiagramStore();
  const s = () => store.getState();
  s().setNodes([node("a"), node("b"), node("c")]);
  s().setEdges([
    { id: "ab", source: "a", target: "b" },
    { id: "bc", source: "b", target: "c" },
  ] as never);
  s().setSelectedNodeId("a");
  s().setNodePanelOpen(true);
  s().requestDelete({ nodeIds: ["a"], edgeIds: [] });
  s().confirmDelete();
  assert.deepEqual(s().nodes.map((n) => n.id), ["b", "c"]);
  assert.deepEqual(s().edges.map((e) => e.id), ["bc"]);
  assert.equal(s().selectedNodeId, null);
  assert.equal(s().nodePanelOpen, false);
  assert.equal(s().pendingDelete, null);
  s().undo();
  assert.deepEqual(s().nodes.map((n) => n.id), ["a", "b", "c"]);
});

test("selecting and opening panels keeps canvas selection and panels consistent", () => {
  const store = createDiagramStore();
  const s = () => store.getState();
  s().setNodes([node("a"), node("b")]);
  s().setEdges([{ id: "ab", source: "a", target: "b" }] as never);
  s().openNodePanel("a");
  assert.deepEqual(s().nodes.map((n) => !!n.selected), [true, false]);
  assert.equal(s().nodePanelOpen, true);
  s().openEdgePanel("ab");
  assert.equal(s().selectedNodeId, null);
  assert.equal(s().nodePanelOpen, false);
  assert.equal(s().edgePanelOpen, true);
  assert.deepEqual(s().nodes.map((n) => !!n.selected), [false, false]);
  s().closeEdgePanel();
  assert.equal(s().selectedEdgeId, null);
  assert.equal(s().edgePanelOpen, false);
});
