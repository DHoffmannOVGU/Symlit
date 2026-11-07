import { memo } from "react";
import { AssociationEdge } from "./AssociationEdge";
import { AggregationEdge } from "./AggregationEdge";
import { GeneralizationEdge } from "./GeneralizationEdge";
import { CompositionEdge } from "./CompositionEdge";
import { DependencyEdge } from "./DependencyEdge";
import { RealizationEdge } from "./RealizationEdge";
import {
  getEdgeMarkers,
  getEdgeSemanticDefaults,
  normalizeEdgeData,
  type CustomEdgeData,
} from "../utils/edge-utils";
import { ConnectionPreviewLine } from "../canvas/ConnectionPreviewLine";

export {
  getEdgeMarkers,
  getEdgeSemanticDefaults,
  normalizeEdgeData,
  type CustomEdgeData,
};
export { ConnectionPreviewLine };

export const MemoizedAssociationEdge = memo(AssociationEdge);
export const MemoizedAggregationEdge = memo(AggregationEdge);
export const MemoizedGeneralizationEdge = memo(GeneralizationEdge);
export const MemoizedCompositionEdge = memo(CompositionEdge);
export const MemoizedDependencyEdge = memo(DependencyEdge);
export const MemoizedRealizationEdge = memo(RealizationEdge);

export const edgeTypes = {
  association: MemoizedAssociationEdge,
  aggregation: MemoizedAggregationEdge,
  composition: MemoizedCompositionEdge,
  generalization: MemoizedGeneralizationEdge,
  dependency: MemoizedDependencyEdge,
  realization: MemoizedRealizationEdge,
};
