import type { z } from "zod";
import type { flowEdgeInputSchema } from "./routes";

/** A relationship as saved by clients (validated by `flowEdgeInputSchema`). */
export type FlowEdgeInput = z.input<typeof flowEdgeInputSchema>;

/**
 * Shape accepted by `syncFlow` over the wire and inside the storage/service
 * layer. Matches the Zod schema declared at `api.flow.sync.input`. This is
 * intentionally narrower than the full DB row: `projectId` is derived
 * server-side from `viewId`, and `createdAt` is set by the database. Keeping
 * a dedicated type here avoids forcing the client and routes to invent the
 * extra fields just to satisfy the compiler.
 */
/** Structure enforced by `flowNodeDataSchema` in shared/routes.ts. */
export type FlowNodeData = {
  label?: string;
  description?: string;
  type?: string;
  typeId?: string;
  attributes?: Array<Record<string, unknown>>;
  [key: string]: unknown;
};

export type SyncFlowNodeInput = {
  id: string;
  type?: string;
  position: { x: number; y: number };
  data: FlowNodeData;
  parentId?: string | null;
};

export type PatternNodeInput = {
  nodeId: string;
  type: string;
  position: { x: number; y: number };
  data?: unknown;
  parentId?: string | null;
};

export type PatternEdgeInput = {
  source: string;
  target: string;
  edgeType?: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  data?: unknown;
};
