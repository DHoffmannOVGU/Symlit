import { useMemo } from "react";
import { lazyNamed, MountWhenOpened } from "@/lib/lazy";

// The panels load when first opened.
const NodeAttributePanel = lazyNamed(() => import("../panels/NodeAttributePanel"), "NodeAttributePanel");
const EdgeAttributePanel = lazyNamed(() => import("../panels/EdgeAttributePanel"), "EdgeAttributePanel");
import type { CustomEdgeData, NodeData } from "../types";
import { useDiagramStore } from "../state/DiagramStoreProvider";
import { getTypeAncestors } from "@shared/metamodel-inheritance";
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
  const {
    availablePartDefs,
    availablePartDefNodes,
    availablePartDefEdges,
    configuredRelationTypes,
    projectType,
    relationEdges,
    parentMap,
  } = useDiagramModel();

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

  // In a model: what the metamodel says about how often the selected relationship may occur.
  const metamodelMultiplicity = useMemo(() => {
    if (projectType !== "instance" || !edge) return null;
    const typeIdOf = (nodeId: string) =>
      (nodes.find((candidate) => candidate.id === nodeId)?.data as NodeData | undefined)?.typeId;
    const sourceTypeId = typeIdOf(edge.source);
    const targetTypeId = typeIdOf(edge.target);
    if (!sourceTypeId || !targetTypeId) return null;
    const data = edge.data as CustomEdgeData | undefined;
    const edgeType = edge.type || data?.edgeType || "association";
    const sourceAncestors = getTypeAncestors(sourceTypeId, parentMap);
    const targetAncestors = getTypeAncestors(targetTypeId, parentMap);
    const meta = relationEdges.find(
      (candidate) =>
        candidate.edgeType === edgeType &&
        (candidate.label || "").trim() === (data?.label || "").trim() &&
        sourceAncestors.has(candidate.sourceTypeId) &&
        targetAncestors.has(candidate.targetTypeId) &&
        !!candidate.multiplicity?.trim(),
    );
    if (!meta?.multiplicity) return null;
    const typeName = (id: string) =>
      (availablePartDefNodes.find((candidate) => candidate.id === id)?.data as NodeData | undefined)?.label || "element";
    return {
      text: meta.multiplicity,
      sourceType: typeName(meta.sourceTypeId),
      targetType: typeName(meta.targetTypeId),
    };
  }, [availablePartDefNodes, edge, nodes, parentMap, projectType, relationEdges]);

  return (
    <>
      <MountWhenOpened open={nodePanelOpen && !!node}>
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
      </MountWhenOpened>

      <MountWhenOpened open={edgePanelOpen && !!edge}>
      {edgePanelOpen && edge ? (
        <EdgeAttributePanel
          edge={edge}
          nodes={nodes}
          isOpen={edgePanelOpen}
          onClose={closeEdgePanel}
          onSave={onSaveEdge}
          onDelete={onDeleteEdge}
          allowedEdgeTypes={configuredRelationTypes}
          projectType={projectType}
          metamodelMultiplicity={metamodelMultiplicity}
        />
      ) : null}
      </MountWhenOpened>
    </>
  );
}
