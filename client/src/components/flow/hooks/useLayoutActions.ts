import { useCallback } from "react";
import { useReactFlow } from "@xyflow/react";
import { useDiagramStore, useDiagramStoreApi } from "../state/DiagramStoreProvider";
import { NODE_HEIGHT, NODE_WIDTH } from "../utils/node-size";
import { canvasFitOptions } from "../utils/fit-options";

/** Auto Layout, laying out the selection and aligning selected elements; all undoable. */
export function useLayoutActions() {
  const diagramStore = useDiagramStoreApi();
  const setNodes = useDiagramStore((state) => state.setNodes);
  const setEdges = useDiagramStore((state) => state.setEdges);
  const takeSnapshot = useDiagramStore((state) => state.takeSnapshot);
  const { fitView } = useReactFlow();

  const autoLayout = useCallback(async () => {
    if (diagramStore.getState().nodes.length === 0) return;
    // The layout engine (dagre) loads on first use.
    const { getAutoLayout } = await import("../utils/autolayout");
    const { nodes, edges } = diagramStore.getState();
    takeSnapshot();
    const result = getAutoLayout(nodes, edges);
    setNodes(result.nodes);
    setEdges(result.edges);
    // Fit after the new positions have rendered.
    requestAnimationFrame(() => {
      fitView(canvasFitOptions(800));
    });
  }, [diagramStore, fitView, setEdges, setNodes, takeSnapshot]);

  const layoutSelected = useCallback(
    async (direction: "TB" | "LR", selectedNodeIds: string[]) => {
      if (selectedNodeIds.length === 0) return;
      const { layoutSelectedNodesWithDagre } = await import("../utils/dagre-layout");
      const { nodes, edges } = diagramStore.getState();
      takeSnapshot();
      setNodes(layoutSelectedNodesWithDagre(nodes, edges, selectedNodeIds, direction));
    },
    [diagramStore, setNodes, takeSnapshot],
  );

  /** Aligns the selected elements' centres on one vertical ("x") or horizontal ("y") line. */
  const centerSelected = useCallback(
    (axis: "x" | "y", selectedNodeIds: string[]) => {
      const ids = new Set(selectedNodeIds);
      const nodes = diagramStore.getState().nodes;
      const selected = nodes.filter((node) => ids.has(node.id));
      if (selected.length === 0) return;
      takeSnapshot();
      const size = (node: (typeof nodes)[number]) =>
        axis === "x" ? (node.width ?? NODE_WIDTH) : (node.height ?? NODE_HEIGHT);
      const center =
        selected.reduce((sum, node) => sum + node.position[axis] + size(node) / 2, 0) / selected.length;
      setNodes(
        nodes.map((node) =>
          ids.has(node.id) ? { ...node, position: { ...node.position, [axis]: center - size(node) / 2 } } : node,
        ),
      );
    },
    [diagramStore, setNodes, takeSnapshot],
  );

  return { autoLayout, layoutSelected, centerSelected };
}
