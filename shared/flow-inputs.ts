import type { InsertFlowEdge } from "./schema";

export type FlowEdgeInput = Omit<InsertFlowEdge, "viewId">;

/**
 * Shape accepted by `syncFlow` over the wire and inside the storage/service
 * layer. Matches the Zod schema declared at `api.flow.sync.input`. This is
 * intentionally narrower than the full DB row: `projectId` is derived
 * server-side from `viewId`, and `createdAt` is set by the database. Keeping
 * a dedicated type here avoids forcing the client and routes to invent the
 * extra fields just to satisfy the compiler.
 */
export type SyncFlowNodeInput = {
  id: string;
  type?: string;
  position: { x: number; y: number };
  data?: unknown;
  parentId?: string | null;
};

export type PatternNodeInput = {
  nodeId: string;
  type: string;
  position: { x: number; y: number };
  data?: unknown;
};

export type PatternEdgeInput = {
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  data?: unknown;
};
