import type { ReactFlowInstance } from "@xyflow/react";
import type { DiagramEdge } from "../types";
import { randomId } from "@/lib/ids";
import { useCallback, useEffect } from "react";
import { AI_ASSISTANT_ENABLED } from "@/lib/feature-flags";
import type { DiagramNode as Node } from "../types";
import {
  buildMetamodelProposalElements,
  chooseMetamodelProposalLayoutDirection,
} from "../utils/ai-metamodel-apply";
import { layoutSelectedNodesWithDagre } from "../utils/dagre-layout";
import type { AiMetamodelProposal } from "@shared/ai-metamodel";
import { useToast } from "@/hooks/use-toast";
import { subscribeDiagramEvent } from "@/lib/diagram-events";

export interface UseCanvasAiProposalParams {
  viewId: number;
  projectType: "metamodel" | "instance" | "method";
  toggleAiAssistant: () => void;
  nodes: Node[];
  edges: DiagramEdge[];
  toast: ReturnType<typeof useToast>["toast"];
  takeSnapshot: (nodes: Node[], edges: DiagramEdge[]) => void;
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  setEdges: React.Dispatch<React.SetStateAction<DiagramEdge[]>>;
  fitView: ReactFlowInstance["fitView"];
}

export function useCanvasAiProposal({
  viewId,
  projectType,
  toggleAiAssistant,
  nodes,
  edges,
  toast,
  takeSnapshot,
  setNodes,
  setEdges,
  fitView,
}: UseCanvasAiProposalParams) {
  useEffect(
    () => subscribeDiagramEvent("metamodel-ai-assistant-toggle-request", (detail) => {
      if (AI_ASSISTANT_ENABLED && detail.viewId === viewId && projectType === "metamodel") toggleAiAssistant();
    }),
    [projectType, toggleAiAssistant, viewId],
  );

  const handleApplyAiProposal = useCallback((proposal: AiMetamodelProposal) => {
    const additions = buildMetamodelProposalElements(
      proposal,
      nodes,
      edges,
      (kind) => `ai_${kind}_${randomId()}`,
    );
    if (!additions.nodes.length && !additions.edges.length) {
      toast({
        title: "Nothing to apply",
        description:
          additions.skipped[0] ??
          "The proposal contains no valid additions.",
      });
      return;
    }
    const layoutDirection = chooseMetamodelProposalLayoutDirection(proposal);
    const nextEdges = [...edges, ...additions.edges];
    const nextNodes = layoutSelectedNodesWithDagre(
      [...nodes, ...additions.nodes],
      nextEdges,
      additions.nodes.map((node) => node.id),
      layoutDirection,
    );
    takeSnapshot(nodes, edges);
    setNodes(nextNodes);
    setEdges(nextEdges);
    toast({
      title: "AI proposal applied",
      description: [
        `Added ${additions.nodes.length} element${additions.nodes.length === 1 ? "" : "s"} and ${additions.edges.length} relationship${additions.edges.length === 1 ? "" : "s"}, arranged ${layoutDirection === "TB" ? "vertically" : "horizontally"}.`,
        additions.skipped.length
          ? `Skipped ${additions.skipped.length} invalid item${additions.skipped.length === 1 ? "" : "s"}.`
          : "",
      ].filter(Boolean).join(" "),
    });
    window.requestAnimationFrame(() => { void fitView({ duration: 600 }); });
  }, [edges, fitView, nodes, setEdges, setNodes, takeSnapshot, toast]);

  return {
    handleApplyAiProposal,
  };
}
