import type { EdgeProps } from "@xyflow/react";
import { BaseCustomEdge } from "./BaseCustomEdge";

const GENERALIZATION_CONFIG = { toolbarIconName: "GitBranch" } as const;

export const GeneralizationEdge = (props: EdgeProps) => (
  <BaseCustomEdge {...props} config={GENERALIZATION_CONFIG} />
);
