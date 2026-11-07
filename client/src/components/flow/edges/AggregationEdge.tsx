import type { EdgeProps } from "@xyflow/react";
import { BaseCustomEdge } from "./BaseCustomEdge";
import { RELATION_MARKER_IDS } from "../utils/edge-utils";

// Kept as a compatibility export for code that referenced the original marker.
export const AGGREGATION_MARKER_ID = RELATION_MARKER_IDS.aggregation;

const AGGREGATION_CONFIG = {
  toolbarIconName: "Diamond",
  labelZIndex: 20,
} as const;

export const AggregationEdge = (props: EdgeProps) => (
  <BaseCustomEdge {...props} config={AGGREGATION_CONFIG} />
);
