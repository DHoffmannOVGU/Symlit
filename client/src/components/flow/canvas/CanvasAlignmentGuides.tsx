import { EdgeLabelRenderer } from "@xyflow/react";

interface CanvasAlignmentGuidesProps {
  guides: { x: number | null; y: number | null };
}

/**
 * Sibling SVG/DOM overlay (alongside `AggregationMarkerDefs`) that draws the
 * blue snapping guides while a node is being aligned with another node.
 */
export function CanvasAlignmentGuides({ guides }: CanvasAlignmentGuidesProps) {
  if (guides.x === null && guides.y === null) return null;

  return (
    <EdgeLabelRenderer>
      <>
        {guides.x !== null && (
          <div
            className="pointer-events-none absolute"
            style={{
              transform: `translate(${guides.x}px, -10000px)`,
            }}
          >
            <div className="h-[20000px] w-px bg-sky-500/60" />
          </div>
        )}
        {guides.y !== null && (
          <div
            className="pointer-events-none absolute"
            style={{
              transform: `translate(-10000px, ${guides.y}px)`,
            }}
          >
            <div className="h-px w-[20000px] bg-sky-500/60" />
          </div>
        )}
      </>
    </EdgeLabelRenderer>
  );
}
