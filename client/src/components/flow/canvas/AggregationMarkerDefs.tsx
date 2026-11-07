import { RELATION_MARKER_IDS } from "../utils/edge-utils";

export function AggregationMarkerDefs() {
  return (
    <svg className="absolute h-0 w-0">
      <defs>
        <marker
          id={RELATION_MARKER_IDS.aggregation}
          viewBox="-12 -8 12 16"
          markerWidth="12"
          markerHeight="16"
          markerUnits="strokeWidth"
          orient="auto-start-reverse"
          refX="0.4"
          refY="0"
        >
          <path
            d="M -10 0 L -5 -5 L 0 0 L -5 5 Z"
            fill="hsl(var(--background))"
            stroke="context-stroke"
            strokeWidth="1.75"
            strokeLinejoin="round"
          />
        </marker>
        <marker
          id={RELATION_MARKER_IDS.composition}
          viewBox="-12 -8 12 16"
          markerWidth="12"
          markerHeight="16"
          markerUnits="strokeWidth"
          orient="auto-start-reverse"
          refX="0.4"
          refY="0"
        >
          <path
            d="M -10 0 L -5 -5 L 0 0 L -5 5 Z"
            fill="context-stroke"
            stroke="context-stroke"
            strokeWidth="1.75"
            strokeLinejoin="round"
          />
        </marker>
        <marker
          id={RELATION_MARKER_IDS.generalization}
          viewBox="-12 -8 12 16"
          markerWidth="12"
          markerHeight="16"
          markerUnits="strokeWidth"
          orient="auto-start-reverse"
          refX="0.4"
          refY="0"
        >
          <path
            d="M -10 -6 L 0 0 L -10 6 Z"
            fill="hsl(var(--background))"
            stroke="context-stroke"
            strokeWidth="1.75"
            strokeLinejoin="round"
          />
        </marker>
      </defs>
    </svg>
  );
}
