import type { EdgeProps } from "@xyflow/react";
import { BaseCustomEdge } from "./BaseCustomEdge";

const REALIZATION_CONFIG = { toolbarIconName: "BadgeCheck" } as const;

export const RealizationEdge = (props: EdgeProps) => (
  <BaseCustomEdge {...props} config={REALIZATION_CONFIG} />
);