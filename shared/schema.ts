import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations, sql } from "drizzle-orm";
import { pgTable, text, integer, serial, jsonb, timestamp, primaryKey, index } from "drizzle-orm/pg-core";
import type { MetamodelSetup } from "./metamodel-setup";
import {
  insertProjectSchema,
  insertViewSchema,
  type ModelRule,
} from "./contracts";

export * from "./contracts";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  displayName: text("display_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});



export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  projectType: text("project_type").notNull().default("metamodel"),
  referencedMetamodels: jsonb("referenced_metamodels").$type<number[]>().default(sql`'[]'::jsonb`),
  /** Template the project was created from (e.g. the tutorial), if any. */
  templateId: text("template_id"),
  metamodelSetup: jsonb("metamodel_setup").$type<MetamodelSetup | null>().default(sql`'null'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  userIdIdx: index("projects_user_id_idx").on(table.userId),
}));

export const views = pgTable("views", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  viewType: text("view_type").notNull().default("view"),
  modelRules: jsonb("model_rules").$type<ModelRule[]>().default(sql`'[]'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  projectIdIdx: index("views_project_id_idx").on(table.projectId),
}));

export const nodes = pgTable("nodes", {
  id: text("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  type: text("type").notNull().default("default"),
  data: jsonb("data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  projectIdIdx: index("nodes_project_id_idx").on(table.projectId),
}));

export const nodeViews = pgTable("node_views", {
  nodeId: text("node_id").notNull().references(() => nodes.id, { onDelete: "cascade" }),
  viewId: integer("view_id").notNull().references(() => views.id, { onDelete: "cascade" }),
  position: jsonb("position").notNull(),
  parentId: text("parent_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  pk: primaryKey({ columns: [table.nodeId, table.viewId] }),
  viewIdx: index("node_views_view_id_idx").on(table.viewId),
}));

export const edges = pgTable("edges", {
  id: text("id").primaryKey(),
  viewId: integer("view_id").notNull().references(() => views.id, { onDelete: "cascade" }),
  source: text("source").notNull().references(() => nodes.id, { onDelete: "cascade" }),
  target: text("target").notNull().references(() => nodes.id, { onDelete: "cascade" }),
  edgeType: text("edge_type").notNull().default("association"),
  sourceHandle: text("source_handle"),
  targetHandle: text("target_handle"),
  data: jsonb("data"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  viewIdIdx: index("edges_view_id_idx").on(table.viewId),
}));

// === RELATIONS ===

export const userRelations = relations(users, ({ many }) => ({
  projects: many(projects),
}));

export const projectRelations = relations(projects, ({ one, many }) => ({
  user: one(users, {
    fields: [projects.userId],
    references: [users.id],
  }),
  views: many(views),
}));

export const viewRelations = relations(views, ({ one, many }) => ({
  project: one(projects, {
    fields: [views.projectId],
    references: [projects.id],
  }),
  nodeViews: many(nodeViews),
  edges: many(edges),
}));

export const nodeRelations = relations(nodes, ({ one, many }) => ({
  project: one(projects, {
    fields: [nodes.projectId],
    references: [projects.id],
  }),
  nodeViews: many(nodeViews),
}));

export const nodeViewRelations = relations(nodeViews, ({ one }) => ({
  node: one(nodes, {
    fields: [nodeViews.nodeId],
    references: [nodes.id],
  }),
  view: one(views, {
    fields: [nodeViews.viewId],
    references: [views.id],
  }),
}));

export const edgeRelations = relations(edges, ({ one }) => ({
  view: one(views, {
    fields: [edges.viewId],
    references: [views.id],
  }),
}));

// === BASE SCHEMAS ===

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertNodeSchema = createInsertSchema(nodes).omit({ createdAt: true });
export const insertNodeViewSchema = createInsertSchema(nodeViews).omit({ createdAt: true });
export const insertEdgeSchema = createInsertSchema(edges).omit({ createdAt: true });

// === EXPLICIT API CONTRACT TYPES ===

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;

export type View = typeof views.$inferSelect;
export type InsertView = z.infer<typeof insertViewSchema>;

export type FlowNode = typeof nodes.$inferSelect;
export type InsertFlowNode = z.infer<typeof insertNodeSchema>;
export type FlowNodeWithPosition = FlowNode & { position: { x: number; y: number }; parentId?: string | null };
export type InsertFlowNodeWithPosition = Omit<FlowNodeWithPosition, "createdAt">;
export type NodeView = typeof nodeViews.$inferSelect;
export type InsertNodeView = z.infer<typeof insertNodeViewSchema>;

export type FlowEdge = typeof edges.$inferSelect;
export type InsertFlowEdge = z.infer<typeof insertEdgeSchema>;

export type ProjectWithViews = Project & { views: View[] };
