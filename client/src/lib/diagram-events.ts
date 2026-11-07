import type { TutorialSignal } from "@shared/tutorial";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
} from "react";
import type {
  DiagramDirtyStateDetail,
  DiagramEdgeActionRequestDetail,
  DiagramModelEdgeCreatedDetail,
  DiagramModelNodeCreatedDetail,
  DiagramNodeActionRequestDetail,
  DiagramSaveRequestDetail,
  DiagramSaveStateDetail,
  SidebarCreateMetamodelNodeDetail,
  SidebarNodeTransfer,
} from "@/components/flow/canvas/diagramCanvasTypes";

export type DiagramLeaveRequestDetail = { href: string };
export type ModelRulesToggleRequestDetail = { viewId: number };
export type MetamodelAiAssistantToggleRequestDetail = { viewId: number };
export type TutorialSignalDetail = { signal: TutorialSignal };

export type SelectedNodeChangedDetail = {
  viewId: number;
  nodeId: string | null;
};

export type InsertNodeIntoViewDetail = SidebarNodeTransfer & {
  position?: { x: number; y: number };
};

export type InsertPatternIntoViewDetail = {
  patternId: number;
  viewId: number;
};

export type CreateMetamodelNodeRequestDetail =
  SidebarCreateMetamodelNodeDetail & {
    position?: { x: number; y: number };
  };

export interface DiagramEventMap {
  "diagram-dirty-state": DiagramDirtyStateDetail;
  "diagram-save-state": DiagramSaveStateDetail;
  "diagram-model-node-created": DiagramModelNodeCreatedDetail;
  "diagram-model-edge-created": DiagramModelEdgeCreatedDetail;
  "diagram-save-request": DiagramSaveRequestDetail;
  "diagram-leave-request": DiagramLeaveRequestDetail;
  "diagram-node-action-request": DiagramNodeActionRequestDetail;
  "diagram-edge-action-request": DiagramEdgeActionRequestDetail;
  "selected-node-changed": SelectedNodeChangedDetail;
  "insert-node-into-view": InsertNodeIntoViewDetail;
  "insert-pattern-into-view": InsertPatternIntoViewDetail;
  "create-metamodel-node-in-view": CreateMetamodelNodeRequestDetail;
  "model-rules-toggle-request": ModelRulesToggleRequestDetail;
  "metamodel-ai-assistant-toggle-request": MetamodelAiAssistantToggleRequestDetail;
  "tutorial-signal": TutorialSignalDetail;
}

export type DiagramEventName = keyof DiagramEventMap;

/**
 * In-app diagram event bus. Owned by `DiagramEventBusProvider` and exposed via
 * React context. The Provider also publishes the active bus to a module-level
 * ref so the function helpers (`dispatchDiagramEvent`, `subscribeDiagramEvent`)
 * can route through the same instance from non-hook callers — keeping the
 * channel typed and decoupled from `window`.
 */
const DiagramEventBusContext = createContext<EventTarget | null>(null);

let activeBus: EventTarget | null = null;

export function DiagramEventBusProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // Bus is created lazily once and `activeBus` is set synchronously during the
  // very first render of this Provider — BEFORE any descendant renders or
  // mounts. This eliminates the mount-order race where a child effect could
  // call `subscribeDiagramEvent` before the Provider's own effect ran.
  const busRef = useRef<EventTarget | null>(null);
  if (busRef.current === null) {
    busRef.current = new EventTarget();
    activeBus = busRef.current;
  }
  const bus = busRef.current;
  useEffect(() => {
    // Re-assert in case another Provider instance briefly grabbed the slot.
    activeBus = bus;
    return () => {
      if (activeBus === bus) activeBus = null;
    };
  }, [bus]);
  return React.createElement(
    DiagramEventBusContext.Provider,
    { value: bus },
    children,
  );
}

export function useDiagramEventBus(): EventTarget {
  const bus = useContext(DiagramEventBusContext);
  if (!bus) {
    throw new Error(
      "DiagramEventBusProvider is missing — wrap your tree in <DiagramEventBusProvider>",
    );
  }
  return bus;
}

function requireActiveBus(): EventTarget {
  if (!activeBus) {
    throw new Error(
      "DiagramEventBusProvider not mounted — diagram events cannot fire",
    );
  }
  return activeBus;
}

/** Dispatch a typed diagram event on the active in-app bus. */
export function dispatchDiagramEvent<E extends DiagramEventName>(
  name: E,
  detail: DiagramEventMap[E],
): void {
  requireActiveBus().dispatchEvent(new CustomEvent(name, { detail }));
}

/** Subscribe to a typed diagram event; returns an unsubscribe function. */
export function subscribeDiagramEvent<E extends DiagramEventName>(
  name: E,
  handler: (detail: DiagramEventMap[E]) => void,
): () => void {
  const bus = requireActiveBus();
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<DiagramEventMap[E]>).detail;
    if (detail === undefined || detail === null) return;
    handler(detail);
  };
  bus.addEventListener(name, listener as EventListener);
  return () => bus.removeEventListener(name, listener as EventListener);
}

/** Hook variant: returns a stable typed dispatch fn bound to the context bus. */
export function useDispatchDiagramEvent() {
  const bus = useDiagramEventBus();
  return useCallback(
    <E extends DiagramEventName>(name: E, detail: DiagramEventMap[E]) => {
      bus.dispatchEvent(new CustomEvent(name, { detail }));
    },
    [bus],
  );
}

/**
 * Hook variant: subscribe to a typed diagram event for the lifetime of the
 * component. The handler is captured fresh each render via a ref so callers
 * don't need to memoize it.
 */
export function useSubscribeDiagramEvent<E extends DiagramEventName>(
  name: E,
  handler: (detail: DiagramEventMap[E]) => void,
): void {
  const bus = useDiagramEventBus();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  useEffect(() => {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<DiagramEventMap[E]>).detail;
      if (detail === undefined || detail === null) return;
      handlerRef.current(detail);
    };
    bus.addEventListener(name, listener as EventListener);
    return () => bus.removeEventListener(name, listener as EventListener);
  }, [bus, name]);
}
