import { applyEdgeChanges, applyNodeChanges, type EdgeChange, type NodeChange } from "@xyflow/react";
import { createStore } from "zustand/vanilla";
import type { DiagramEdge, DiagramNode } from "../types";

/**
 * Editor state of one open diagram: the graph, undo history, selection and
 * open panels/dialogs. One store exists per mounted diagram (see
 * `DiagramStoreProvider`); hooks and panels read and write it directly instead
 * of passing state through `DiagramCanvas` props.
 *
 * Derived, read-only model information (metamodel types, rules, …) lives in
 * `DiagramModelContext`, not here.
 */

type Updater<T> = T | ((previous: T) => T);
const resolve = <T,>(updater: Updater<T>, previous: T): T =>
  typeof updater === "function" ? (updater as (p: T) => T)(previous) : updater;

export type PendingDelete = { nodeIds: string[]; edgeIds: string[]; label?: string };

type Snapshot = { nodes: DiagramNode[]; edges: DiagramEdge[] };

/** Undo steps kept per diagram. */
export const HISTORY_LIMIT = 50;

export interface DiagramState {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  setNodes: (updater: Updater<DiagramNode[]>) => void;
  setEdges: (updater: Updater<DiagramEdge[]>) => void;
  onNodesChange: (changes: NodeChange<DiagramNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<DiagramEdge>[]) => void;

  past: Snapshot[];
  future: Snapshot[];
  /** Records the graph before a change so it can be undone. Defaults to the current graph. */
  takeSnapshot: (nodes?: DiagramNode[], edges?: DiagramEdge[]) => void;
  undo: () => void;
  redo: () => void;
  /** Forgets the undo history (e.g. after loading a diagram). */
  resetHistory: () => void;

  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  setSelectedNodeId: (updater: Updater<string | null>) => void;
  setSelectedEdgeId: (updater: Updater<string | null>) => void;

  /** Selects exactly this element on the canvas (and nothing else); closes the relationship panel. */
  selectNode: (nodeId: string) => void;
  /** Selects exactly this relationship on the canvas (and nothing else); closes the element panel. */
  selectEdge: (edgeId: string) => void;
  /** Selects the relationship and opens its panel. */
  openEdgePanel: (edgeId: string) => void;
  /** Selects the element and opens its panel (callers check read-only elements first). */
  openNodePanel: (nodeId: string) => void;
  closeNodePanel: () => void;
  closeEdgePanel: () => void;

  nodePanelOpen: boolean;
  edgePanelOpen: boolean;
  setNodePanelOpen: (updater: Updater<boolean>) => void;
  setEdgePanelOpen: (updater: Updater<boolean>) => void;

  /** Elements waiting for the user to confirm their deletion. */
  pendingDelete: PendingDelete | null;
  requestDelete: (payload: PendingDelete) => void;
  cancelDelete: () => void;
  /** Deletes the pending elements (and relationships attached to deleted elements), undoably. */
  confirmDelete: () => void;

  helpDialogOpen: boolean;
  setHelpDialogOpen: (updater: Updater<boolean>) => void;

  /** Signature of the diagram as last loaded or saved (see diagram-serialization.ts); "" before loading. */
  savedSignature: string;
  setSavedSignature: (signature: string) => void;

  nodeTableFilter: string;
  edgeTableFilter: string;
  setNodeTableFilter: (value: string) => void;
  setEdgeTableFilter: (value: string) => void;
}

const sameGraph = (a: Snapshot, b: Snapshot) =>
  JSON.stringify(a.nodes) === JSON.stringify(b.nodes) &&
  JSON.stringify(a.edges) === JSON.stringify(b.edges);

export function createDiagramStore() {
  return createStore<DiagramState>()((set, get) => ({
    nodes: [],
    edges: [],
    setNodes: (updater) => set((state) => ({ nodes: resolve(updater, state.nodes) })),
    setEdges: (updater) => set((state) => ({ edges: resolve(updater, state.edges) })),
    onNodesChange: (changes) => set((state) => ({ nodes: applyNodeChanges(changes, state.nodes) })),
    onEdgesChange: (changes) => set((state) => ({ edges: applyEdgeChanges(changes, state.edges) })),

    past: [],
    future: [],
    takeSnapshot: (nodes, edges) =>
      set((state) => {
        const snapshot = { nodes: nodes ?? state.nodes, edges: edges ?? state.edges };
        const last = state.past[state.past.length - 1];
        if (last && sameGraph(last, snapshot)) return { future: [] };
        return { past: [...state.past.slice(-(HISTORY_LIMIT - 1)), snapshot], future: [] };
      }),
    undo: () => {
      const { past, future, nodes, edges } = get();
      const previous = past[past.length - 1];
      if (!previous) return;
      set({
        past: past.slice(0, -1),
        future: [{ nodes, edges }, ...future.slice(0, HISTORY_LIMIT - 1)],
        nodes: previous.nodes,
        edges: previous.edges,
      });
    },
    redo: () => {
      const { past, future, nodes, edges } = get();
      const next = future[0];
      if (!next) return;
      set({
        past: [...past, { nodes, edges }],
        future: future.slice(1),
        nodes: next.nodes,
        edges: next.edges,
      });
    },
    resetHistory: () => set({ past: [], future: [] }),

    selectedNodeId: null,
    selectedEdgeId: null,
    setSelectedNodeId: (updater) =>
      set((state) => ({ selectedNodeId: resolve(updater, state.selectedNodeId) })),
    setSelectedEdgeId: (updater) =>
      set((state) => ({ selectedEdgeId: resolve(updater, state.selectedEdgeId) })),

    selectNode: (nodeId) =>
      set((state) => ({
        nodes: state.nodes.map((node) => ({ ...node, selected: node.id === nodeId })),
        edges: state.edges.map((edge) => ({ ...edge, selected: false })),
        selectedNodeId: nodeId,
        selectedEdgeId: null,
        edgePanelOpen: false,
      })),
    selectEdge: (edgeId) =>
      set((state) => ({
        edges: state.edges.map((edge) => ({ ...edge, selected: edge.id === edgeId })),
        nodes: state.nodes.map((node) => ({ ...node, selected: false })),
        selectedEdgeId: edgeId,
        selectedNodeId: null,
        nodePanelOpen: false,
      })),
    openEdgePanel: (edgeId) => {
      get().selectEdge(edgeId);
      set({ edgePanelOpen: true });
    },
    openNodePanel: (nodeId) => {
      get().selectNode(nodeId);
      set({ nodePanelOpen: true });
    },
    closeNodePanel: () => set({ nodePanelOpen: false, selectedNodeId: null }),
    closeEdgePanel: () => set({ edgePanelOpen: false, selectedEdgeId: null }),

    nodePanelOpen: false,
    edgePanelOpen: false,
    setNodePanelOpen: (updater) => set((state) => ({ nodePanelOpen: resolve(updater, state.nodePanelOpen) })),
    setEdgePanelOpen: (updater) => set((state) => ({ edgePanelOpen: resolve(updater, state.edgePanelOpen) })),

    pendingDelete: null,
    requestDelete: (payload) => {
      if (get().pendingDelete) return;
      set({ pendingDelete: payload });
    },
    cancelDelete: () => set({ pendingDelete: null }),
    confirmDelete: () => {
      const { pendingDelete, takeSnapshot } = get();
      if (!pendingDelete) return;
      const nodeIds = new Set(pendingDelete.nodeIds);
      const edgeIds = new Set(pendingDelete.edgeIds);
      if (nodeIds.size === 0 && edgeIds.size === 0) {
        set({ pendingDelete: null });
        return;
      }
      takeSnapshot();
      set((state) => {
        const nodeDeleted = state.selectedNodeId !== null && nodeIds.has(state.selectedNodeId);
        const edgeDeleted = state.selectedEdgeId !== null && edgeIds.has(state.selectedEdgeId);
        return {
          nodes: state.nodes.filter((node) => !nodeIds.has(node.id)),
          edges: state.edges.filter(
            (edge) => !edgeIds.has(edge.id) && !nodeIds.has(edge.source) && !nodeIds.has(edge.target),
          ),
          pendingDelete: null,
          ...(nodeDeleted ? { selectedNodeId: null, nodePanelOpen: false } : {}),
          ...(edgeDeleted ? { selectedEdgeId: null, edgePanelOpen: false } : {}),
        };
      });
    },

    helpDialogOpen: false,
    setHelpDialogOpen: (updater) => set((state) => ({ helpDialogOpen: resolve(updater, state.helpDialogOpen) })),

    savedSignature: "",
    setSavedSignature: (signature) => set({ savedSignature: signature }),

    nodeTableFilter: "",
    edgeTableFilter: "",
    setNodeTableFilter: (value) => set({ nodeTableFilter: value }),
    setEdgeTableFilter: (value) => set({ edgeTableFilter: value }),
  }));
}

export type DiagramStore = ReturnType<typeof createDiagramStore>;
