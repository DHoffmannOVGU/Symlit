import type { EdgeProps } from "@xyflow/react";
import { BaseCustomEdge } from "./BaseCustomEdge";

const ASSOCIATION_CONFIG = { toolbarIconName: "Link2" } as const;

export const AssociationEdge = (props: EdgeProps) => (
  <BaseCustomEdge {...props} config={ASSOCIATION_CONFIG} />
);
