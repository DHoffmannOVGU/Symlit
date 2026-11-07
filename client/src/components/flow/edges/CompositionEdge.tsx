import type { EdgeProps } from "@xyflow/react";
import { BaseCustomEdge } from "./BaseCustomEdge";

const COMPOSITION_CONFIG = {
  toolbarIconName: "Boxes",
  labelZIndex: 20,
} as const;

export const CompositionEdge = (props: EdgeProps) => (
  <BaseCustomEdge {...props} config={COMPOSITION_CONFIG} />
);