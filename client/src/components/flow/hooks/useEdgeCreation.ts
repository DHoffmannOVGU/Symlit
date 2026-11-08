import type { MagicRelationType } from "@shared/metamodel-setup";
import type { PendingEdgeRelationConfirmation } from "../edges/EdgeRelationConfirmation";
import { useConnectElements } from "./useConnectElements";
import { useDropOnCanvas } from "./useDropOnCanvas";

/** Everything about drawing relationships on the canvas, for React Flow's connect handlers. */
export function useEdgeCreation(options: {
  allowedEdgeTypes?: MagicRelationType[];
  onEdgeCreated?: (confirmation: PendingEdgeRelationConfirmation | null) => void;
}) {
  const handleConnect = useConnectElements(options);
  return { handleConnect, ...useDropOnCanvas() };
}
