import type { EdgeProps } from "@xyflow/react";
import { BaseCustomEdge } from "./BaseCustomEdge";

const DEPENDENCY_CONFIG = { toolbarIconName: "ArrowDownRight" } as const;

export const DependencyEdge = (props: EdgeProps) => (
  <BaseCustomEdge {...props} config={DEPENDENCY_CONFIG} />
);