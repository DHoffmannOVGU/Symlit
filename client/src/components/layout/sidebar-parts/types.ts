import type { UseQueryResult } from "@tanstack/react-query";
import type { z } from "zod";
import type { Project, View } from "@shared/schema";
import type { flowResponseSchema } from "@shared/routes";
import type { SidebarNodeInsertMode } from "../sidebar/SidebarConstants";

/** Nodes and edges of one diagram, as returned by the flow API. */
export type FlowData = z.infer<typeof flowResponseSchema>;
/** Loading state of one diagram's nodes and edges. */
export type FlowQuery = UseQueryResult<FlowData | null, Error>;

/** How an element is shown in the sidebar. */
export type NodeMeta = { label: string; typeLabel: string; iconName: string; color: string };

/** An element offered in a palette, from a referenced or own metamodel diagram. */
export type PaletteItem = {
  project: Project;
  view: View;
  node: { id: string; data: unknown; createdAt: Date | null; type: string; projectId: number };
  meta: NodeMeta;
  /** In how many diagrams the same element appears. */
  duplicateCount: number;
};

/** The diagrams of one referenced metamodel. */
export type ReferencedViewGroup = { project: Project; views: View[]; isLoading: boolean; isError: boolean };

/** Where a dragged diagram would be dropped in the list. */
export type ViewDropTarget = { id: number; position: "before" | "after" };

export type MetamodelNodeTypeOption = {
  type: "partdef" | "actiondef" | "concerndef" | "agentdef" | "requirementdef" | "eventdef" | "capabilitydef";
  label: string;
  description: string;
  iconName: string;
  color: string;
};

export type InsertNodeOptions = {
  mode?: SidebarNodeInsertMode;
  typeId?: string;
  typeLabel?: string;
  icon?: string;
  color?: string;
};
