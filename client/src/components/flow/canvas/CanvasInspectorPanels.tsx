import { EdgeAttributePanel } from "../panels/EdgeAttributePanel";
import { NodeAttributePanel } from "../panels/NodeAttributePanel";
import type {
  CustomEdgeData,
  DiagramEdge,
  DiagramNode,
  NodeData,
} from "../types";
import type { MetamodelSetup, MagicRelationType } from "@shared/metamodel-setup";

export interface CanvasInspectorPanelsProps {
  node: DiagramNode | null;
  edge: DiagramEdge | null;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  nodePanelOpen: boolean;
  edgePanelOpen: boolean;
  availablePartDefs: Array<{ id: string; label: string }>;
  availablePartDefNodes: DiagramNode[];
  availablePartDefEdges: Array<{
    id: string;
    edgeType: CustomEdgeData["edgeType"];
    flowType?: "partflow" | "actionflow" | "informationflow";
    label?: string;
    sourceTypeId: string;
    targetTypeId: string;
  }>;
  parentNodes: DiagramNode[];
  referencedMetamodels: Array<{ id: number; name: string; metamodelSetup?: MetamodelSetup | null }>;
  allowedEdgeTypes?: MagicRelationType[];
  onCloseNodePanel: () => void;
  onCloseEdgePanel: () => void;
  onSaveNode: (nodeId: string, data: NodeData) => void;
  onDeleteNode: (nodeId: string) => void;
  onSaveEdge: (edgeId: string, data: CustomEdgeData) => void;
  onDeleteEdge: (edgeId: string) => void;
}

export function CanvasInspectorPanels({
  node,
  edge,
  nodes,
  edges,
  nodePanelOpen,
  edgePanelOpen,
  availablePartDefs,
  availablePartDefNodes,
  availablePartDefEdges,
  parentNodes,
  allowedEdgeTypes,
  onCloseNodePanel,
  onCloseEdgePanel,
  onSaveNode,
  onDeleteNode,
  onSaveEdge,
  onDeleteEdge,
}: CanvasInspectorPanelsProps) {
  return (
    <>
      {nodePanelOpen && node ? (
        <NodeAttributePanel
          node={node}
          open={nodePanelOpen}
          onClose={onCloseNodePanel}
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
          onClose={onCloseEdgePanel}
          onSave={onSaveEdge}
          onDelete={onDeleteEdge}
          allowedEdgeTypes={allowedEdgeTypes}
        />
      ) : null}
    </>
  );
}