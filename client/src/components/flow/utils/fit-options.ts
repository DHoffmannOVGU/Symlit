import type { FitViewOptions } from "@xyflow/react";

/** Fitting never zooms in beyond 100%: a diagram with few elements keeps its real size. */
export const FIT_MAX_ZOOM = 1;
const MARGIN = 48;

/**
 * Options for fitting the diagram into the canvas. Overlays that float over
 * the canvas (the tutorial coach) are kept clear: the side they cover gets
 * extra padding, so elements are not fitted underneath them.
 */
export function canvasFitOptions(duration?: number): FitViewOptions {
  const padding = { top: `${MARGIN}px`, right: `${MARGIN}px`, bottom: `${MARGIN}px`, left: `${MARGIN}px` } as const;
  const options: FitViewOptions = { maxZoom: FIT_MAX_ZOOM, padding: { ...padding }, ...(duration ? { duration } : {}) };
  if (typeof document === "undefined") return options;
  const canvas = document.querySelector<HTMLElement>(".react-flow");
  const coach = document.querySelector<HTMLElement>('[data-testid="tutorial-coach"]');
  if (!canvas || !coach) return options;
  const area = canvas.getBoundingClientRect();
  const overlay = coach.getBoundingClientRect();
  const coveredRight = area.right - overlay.left;
  // Only when the coach sits over the canvas and leaves room for the diagram.
  if (coveredRight > 0 && coveredRight < area.width * 0.6 && overlay.top < area.bottom) {
    options.padding = { ...padding, right: `${Math.round(coveredRight + 24)}px` };
  }
  return options;
}

/** Sent on `window` when an overlay over the canvas appears, grows or shrinks. */
export const CANVAS_OVERLAY_CHANGED = "symlit:canvas-overlay-changed";
export const announceCanvasOverlayChange = () => {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CANVAS_OVERLAY_CHANGED));
};
