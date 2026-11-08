import { useMemo } from "react";
import { EdgeAttributePanel } from "../panels/EdgeAttributePanel";
import { NodeAttributePanel } from "../panels/NodeAttributePanel";
import type { CustomEdgeData, NodeData } from "../types";
import { useDiagramStore } from "../state/DiagramStoreProvider";
import { useDiagramModel } from "../state/DiagramModelProvider";

export interface CanvasInspectorPanelsProps {
  onSaveNode: (nodeId: string, data: NodeData) => void;
  onDeleteNode: (nodeId: string) => void;
  onSaveEdge: (edgeId: string, data: CustomEdgeData) => void;
  onDeleteEdge: (edgeId: string) => void;
}

/** The attribute panels for the selected element or relationship. */
export function CanvasInspectorPanels({
  onSaveNode,
  onDeleteNode,
  onSaveEdge,
  onDeleteEdge,
}: CanvasInspectorPanelsProps) {
  const nodes = useDiagramStore((state) => state.nodes);
  const edges = useDiagramStore((state) => state.edges);
  const selectedNodeId = useDiagramStore((state) => state.selectedNodeId);
  const selectedEdgeId = useDiagramStore((state) => state.selectedEdgeId);
  const nodePanelOpen = useDiagramStore((state) => state.nodePanelOpen);
  const edgePanelOpen = useDiagramStore((state) => state.edgePanelOpen);
  const closeNodePanel = useDiagramStore((state) => state.closeNodePanel);
  const closeEdgePanel = useDiagramStore((state) => state.closeEdgePanel);
  const { availablePartDefs, availablePartDefNodes, availablePartDefEdges, configuredRelationTypes } =
    useDiagramModel();

  const node = selectedNodeId ? (nodes.find((n) => n.id === selectedNodeId) ?? null) : null;
  const edge = selectedEdgeId ? (edges.find((e) => e.id === selectedEdgeId) ?? null) : null;

  // The type the selected element is an instance of, for inherited attributes.
  const parentNodes = useMemo(() => {
    const typeId = (node?.data as NodeData | undefined)?.typeId;
    if (!typeId) return [];
    const parent =
      availablePartDefNodes.find((candidate) => candidate.id === typeId) ||
      nodes.find((candidate) => candidate.id === typeId);
    return parent ? [parent] : [];
  }, [node, nodes, availablePartDefNodes]);

  return (
    <>
      {nodePanelOpen && node ? (
        <NodeAttributePanel
          node={node}
          open={nodePanelOpen}
          onClose={closeNodePanel}
          onSave={onSaveNode}
          onDelete={onDeleteNode}
          availablePartDefs={availablePartDefs}
          availablePartDefNodes={availablePartDefNodes}
          availablePartDefEdges={availablePartDefEdges}
          allNodes={nodes}
          allEdges={edges}
          parentNodes={parentNodes}
        />
      ) : null}

      {edgePanelOpen && edge ? (
        <EdgeAttributePanel
          edge={edge}
          nodes={nodes}
          isOpen={edgePanelOpen}
          onClose={closeEdgePanel}
          onSave={onSaveEdge}
          onDelete={onDeleteEdge}
          allowedEdgeTypes={configuredRelationTypes}
        />
      ) : null}
    </>
  );
}
