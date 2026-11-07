import type { TutorialSignal } from "@shared/tutorial";
import { dispatchDiagramEvent } from "./diagram-events";

/**
 * Reports an action the guided tutorial may be waiting for. It is a no-op
 * unless a tutorial project is open (the tutorial coach listens for it).
 */
export function emitTutorialSignal(signal: TutorialSignal) {
  dispatchDiagramEvent("tutorial-signal", { signal });
}
