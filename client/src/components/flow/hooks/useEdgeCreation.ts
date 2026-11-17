import { useCallback } from "react";
import type { Connection, FinalConnectionState } from "@xyflow/react";
import type { MagicRelationType } from "@shared/metamodel-setup";
import type { PendingEdgeRelationConfirmation } from "../edges/EdgeRelationConfirmation";
import { useConnectElements } from "./useConnectElements";
import { useDropOnCanvas } from "./useDropOnCanvas";

const pointerOf = (event: MouseEvent | TouchEvent) =>
  "changedTouches" in event && event.changedTouches?.[0]
    ? { x: event.changedTouches[0].clientX, y: event.changedTouches[0].clientY }
    : { x: (event as MouseEvent).clientX, y: (event as MouseEvent).clientY };

/**
 * A relationship let go on another card, not near one of its handles, goes
 * to the handle of that card nearest to the pointer: the card is the obvious
 * target, and letting go on it should not do nothing.
 */
export function connectionToCard(
  event: MouseEvent | TouchEvent,
  state: Pick<FinalConnectionState, "isValid" | "toHandle" | "fromNode" | "fromHandle"> | undefined,
  root: Pick<Document, "elementFromPoint"> = document,
): Connection | null {
  if (!state || state.isValid || state.toHandle || !state.fromNode) return null;
  const point = pointerOf(event);
  const under = root.elementFromPoint(point.x, point.y) ?? (event.target as Element | null);
  const card = under?.closest?.(".react-flow__node");
  const target = card?.getAttribute("data-id");
  if (!card || !target || target === state.fromNode.id) return null;
  const distance = (handle: Element) => {
    const box = handle.getBoundingClientRect();
    return Math.hypot(box.left + box.width / 2 - point.x, box.top + box.height / 2 - point.y);
  };
  const nearest = Array.from(card.querySelectorAll(".react-flow__handle")).sort((a, b) => distance(a) - distance(b))[0];
  return {
    source: state.fromNode.id,
    sourceHandle: state.fromHandle?.id ?? null,
    target,
    targetHandle: nearest?.getAttribute("data-handleid") ?? null,
  };
}

/** Everything about drawing relationships on the canvas, for React Flow's connect handlers. */
export function useEdgeCreation(options: {
  allowedEdgeTypes?: MagicRelationType[];
  onEdgeCreated?: (confirmation: PendingEdgeRelationConfirmation | null) => void;
}) {
  const handleConnect = useConnectElements(options);
  const drop = useDropOnCanvas();
  const { handleConnectEnd: endOnCanvas } = drop;
  const handleConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent, state?: FinalConnectionState) => {
      const onCard = connectionToCard(event, state);
      if (onCard) handleConnect(onCard);
      endOnCanvas(event);
    },
    [endOnCanvas, handleConnect],
  );
  return { handleConnect, ...drop, handleConnectEnd };
}
