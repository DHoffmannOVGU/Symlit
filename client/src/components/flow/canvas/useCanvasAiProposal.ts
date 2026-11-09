import { useReactFlow } from "@xyflow/react";
import { useDiagramModel } from "../state/DiagramModelProvider";
import { useDiagramStore } from "../state/DiagramStoreProvider";
import { randomId } from "@/lib/ids";
import { useCallback, useEffect } from "react";
import { AI_ASSISTANT_ENABLED } from "@/lib/feature-flags";
import {
  buildMetamodelProposalElements,
  chooseMetamodelProposalLayoutDirection,
} from "../utils/ai-metamodel-apply";
import type { AiMetamodelProposal } from "@shared/ai-metamodel";
import { useToast } from "@/hooks/use-toast";
import { subscribeDiagramEvent } from "@/lib/diagram-events";
import { canvasFitOptions } from "../utils/fit-options";

export interface UseCanvasAiProposalParams {
  toggleAiAssistant: () => void;
}

export function useCanvasAiProposal({
  toggleAiAssistant,
}: UseCanvasAiProposalParams) {
  const nodes = useDiagramStore((state) => state.nodes);
  const edges = useDiagramStore((state) => state.edges);
  const takeSnapshot = useDiagramStore((state) => state.takeSnapshot);
  const setNodes = useDiagramStore((state) => state.setNodes);
  const setEdges = useDiagramStore((state) => state.setEdges);
  const { viewId, projectType } = useDiagramModel();
  const { fitView } = useReactFlow();
  const { toast } = useToast();
  useEffect(
    () => subscribeDiagramEvent("metamodel-ai-assistant-toggle-request", (detail) => {
      if (AI_ASSISTANT_ENABLED && detail.viewId === viewId && projectType === "metamodel") toggleAiAssistant();
    }),
    [projectType, toggleAiAssistant, viewId],
  );

  const handleApplyAiProposal = useCallback(async (proposal: AiMetamodelProposal) => {
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
    const { layoutSelectedNodesWithDagre } = await import("../utils/dagre-layout");
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
    window.requestAnimationFrame(() => { void fitView(canvasFitOptions(600)); });
  }, [edges, fitView, nodes, setEdges, setNodes, takeSnapshot, toast]);

  return {
    handleApplyAiProposal,
  };
}
