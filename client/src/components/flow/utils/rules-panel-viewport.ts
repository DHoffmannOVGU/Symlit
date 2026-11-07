export type CanvasViewport = { x: number; y: number; zoom: number };

export function getViewportForBottomPanel(
  viewport: CanvasViewport,
  width: number,
  height: number,
  panelHeight: number,
  minZoom = 0.1,
): CanvasViewport {
  if (height <= 0 || viewport.zoom <= 0) return viewport;
  const availableHeight = Math.max(1, height - panelHeight);
  const zoom = Math.max(minZoom, viewport.zoom * Math.min(1, availableHeight / height));
  const worldCenterX = (width / 2 - viewport.x) / viewport.zoom;
  const worldCenterY = (height / 2 - viewport.y) / viewport.zoom;
  return {
    x: width / 2 - worldCenterX * zoom,
    y: availableHeight / 2 - worldCenterY * zoom,
    zoom,
  };
}
