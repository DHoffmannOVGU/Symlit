/**
 * Where to put a new element so it does not cover another one: the wanted
 * spot if it is free, else the nearest free spot on rings around it.
 */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const GAP = 24;

const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.width + GAP && a.x + a.width + GAP > b.x && a.y < b.y + b.height + GAP && a.y + a.height + GAP > b.y;

/** Top-left position for a `size` element centred on `center`, moved off any of `occupied`. */
export function findFreeSpot(
  center: { x: number; y: number },
  size: { width: number; height: number },
  occupied: Rect[],
): { x: number; y: number } {
  const start = { x: center.x - size.width / 2, y: center.y - size.height / 2 };
  const fits = (x: number, y: number) => !occupied.some((rect) => overlaps({ x, y, ...size }, rect));
  if (fits(start.x, start.y)) return start;
  const stepX = size.width + GAP;
  const stepY = size.height + GAP;
  // Rings of candidate cells around the centre; on each ring, closest first.
  for (let ring = 1; ring <= 12; ring += 1) {
    const cells: Array<{ x: number; y: number; distance: number }> = [];
    for (let dx = -ring; dx <= ring; dx += 1) {
      for (let dy = -ring; dy <= ring; dy += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
        cells.push({ x: start.x + dx * stepX, y: start.y + dy * stepY, distance: Math.hypot(dx * stepX, dy * stepY) });
      }
    }
    cells.sort((a, b) => a.distance - b.distance || a.y - b.y || a.x - b.x);
    const free = cells.find((cell) => fits(cell.x, cell.y));
    if (free) return { x: free.x, y: free.y };
  }
  return start;
}
