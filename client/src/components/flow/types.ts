import type { Edge, Node } from "@xyflow/react";
import type { MagicRelationType } from "@shared/metamodel-setup";

export type AnchorSide = "top" | "right" | "bottom" | "left";

/** Visual weight applied to a node decorated by a Model Rules violation. */
export type NodeRuleEmphasis = "none" | "soft" | "strong";

export interface EdgeAnchor {
  side: AnchorSide;
  offset: number;
}

export interface NodeAttribute {
  id: string;
  name: string;
  description?: string;
  value: string;
  unit: string;
  type: "string" | "number" | "boolean" | "date" | "list" | "derived";
  formula?: string;
  options?: string[];
  inheritedFrom?: {
    nodeId: string;
    attrId: string;
  };
}

export interface NodeData {
  label?: string;
  description?: string;
  attributes?: NodeAttribute[];
  type?: string;
  typeId?: string;
  icon?: string;
  color?: string;
  inheritStyle?: boolean;
  isDraft?: boolean;
  flowStart?: boolean;
  flowEnd?: boolean;
  flowTick?: number | number[];
  flowActive?: boolean;
  hasInternalView?: boolean;
  isGroupContainer?: boolean;
  /**
   * Legacy concern-rule payload. The node-level rule editor was retired in
   * favour of the view-scoped Model Rules workspace; this is always written as
   * `undefined` so stale blobs are stripped from persisted node data on save.
   */
  rule?: undefined;
  ruleAccentColor?: string;
  ruleEmphasis?: NodeRuleEmphasis;
  ruleStateLabel?: string;
  modelRuleTags?: Array<{ label: string; color?: string; ruleName: string; origin?: "meta" | "instance" | "model" }>;
  [key: string]: unknown;
}

export interface CustomEdgeData {
  // Keep this open for relationships created by older/custom metamodels.
  // Known magic relationship types are described in shared/metamodel-setup.
  edgeType: MagicRelationType | (string & {});
  flowType?: "partflow" | "actionflow" | "informationflow";
  label?: string;
  multiplicity?: string;
  variability?: "mandatory" | "optional";
  description?: string;
  strokeWidth?: number;
  strokeColor?: string;
  lineStyle?: "solid" | "dashed" | "dotted";
  sourceArrow?: "none" | "arrow" | "arrowclosed";
  targetArrow?: "none" | "arrow" | "arrowclosed";
  pathType?: "default" | "straight" | "step" | "smoothstep";
  animated?: boolean;
  ruleStrokeWidth?: number;
  ruleStrokeColor?: string;
  ruleLineStyle?: "solid" | "dashed" | "dotted";
  ruleAnimated?: boolean;
  sourceAnchor?: EdgeAnchor;
  targetAnchor?: EdgeAnchor;
  [key: string]: unknown;
}

/** Canonical React Flow types used by the diagram editor. */
export type DiagramNode = Node<NodeData>;
export type DiagramEdge = Edge<
  CustomEdgeData,
  CustomEdgeData["edgeType"]
>;
