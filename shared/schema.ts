import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations, sql } from "drizzle-orm";
import {
  pgTable,
  text,
  integer,
  serial,
  jsonb,
  timestamp,
  primaryKey,
} from "drizzle-orm/pg-core";
import { metamodelSetupSchema, type MetamodelSetup } from "./metamodel-setup";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  displayName: text("display_name"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const projectTypeEnum = ["metamodel", "instance", "method"] as const;
export type ProjectType = typeof projectTypeEnum[number];

export const viewTypeEnum = ["view", "pattern", "internal"] as const;
export type ViewType = typeof viewTypeEnum[number];

export const modelRuleCheckEnum = [
  "missing-name",
  "missing-description",
  "duplicate-name",
  "no-connections",
] as const;
export const modelRuleSeverityEnum = ["warning", "error"] as const;

export const modelRuleOperatorEnum = [
  "exists",
  "missing",
  "equals",
  "not-equals",
  "contains",
  "greater-than",
  "greater-than-or-equal",
  "less-than",
  "less-than-or-equal",
  "is-true",
  "is-false",
] as const;

export type ModelRuleComparison = {
      kind: "comparison";
      source: "self" | "connected";
      direction?: "any" | "incoming" | "outgoing";
      quantifier?: "any" | "all" | "none";
      targetType?: string;
      field: "name" | "description" | "type" | "attribute";
      attribute?: string;
      operator: typeof modelRuleOperatorEnum[number];
      value?: string;
    };

export type ModelRuleCondition = ModelRuleComparison | {
  kind: "group";
  combinator: "all" | "any";
  conditions: Array<ModelRuleComparison | {
    kind: "group";
    combinator: "all" | "any";
    conditions: ModelRuleComparison[];
  }>;
};

const modelRuleComparisonSchema = z.object({
      kind: z.literal("comparison"),
      source: z.enum(["self", "connected"]),
      direction: z.enum(["any", "incoming", "outgoing"]).optional(),
      quantifier: z.enum(["any", "all", "none"]).optional(),
      targetType: z.string().optional(),
      field: z.enum(["name", "description", "type", "attribute"]),
      attribute: z.string().optional(),
      operator: z.enum(modelRuleOperatorEnum),
      value: z.string().optional(),
    });

const modelRuleNestedGroupSchema = z.object({
  kind: z.literal("group"),
  combinator: z.enum(["all", "any"]),
  conditions: z.array(modelRuleComparisonSchema),
});

const modelRuleConditionSchema: z.ZodType<ModelRuleCondition> = z.discriminatedUnion("kind", [
  modelRuleComparisonSchema,
  z.object({
    kind: z.literal("group"),
    combinator: z.enum(["all", "any"]),
    conditions: z.array(z.union([modelRuleComparisonSchema, modelRuleNestedGroupSchema])),
  }),
]);

export const modelRuleOutcomeSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("tag"),
    label: z.string().min(1),
    color: z.string().optional(),
  }),
  z.object({
    kind: z.literal("issue"),
    severity: z.enum(modelRuleSeverityEnum).default("warning"),
    message: z.string().optional(),
  }),
]);

export type ModelRuleOutcome = z.infer<typeof modelRuleOutcomeSchema>;

export const modelRuleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  enabled: z.boolean().default(true),
  targetType: z.string().min(1).default("all"),
  // `check` and `severity` keep rules saved by the original MVP readable.
  check: z.enum(modelRuleCheckEnum).optional(),
  severity: z.enum(modelRuleSeverityEnum).optional(),
  condition: modelRuleConditionSchema.optional(),
  outcome: modelRuleOutcomeSchema.optional(),
}).superRefine((rule, context) => {
  if (rule.check !== undefined) return;
  if (!rule.condition || !rule.outcome) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "A model rule needs a condition and outcome" });
    return;
  }
  const inspect = (condition: ModelRuleCondition) => {
    if (condition.kind === "group") {
      if (condition.conditions.length === 0) context.addIssue({ code: z.ZodIssueCode.custom, message: "Condition groups cannot be empty" });
      condition.conditions.forEach(inspect);
      return;
    }
    if (condition.field === "attribute" && !condition.attribute?.trim()) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Choose an attribute for each attribute condition" });
    }
    if (!["exists", "missing", "is-true", "is-false"].includes(condition.operator) && !condition.value?.trim()) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a comparison value" });
    }
  };
  inspect(rule.condition);
});

export type ModelRule = z.infer<typeof modelRuleSchema>;

export const methodStakeholderSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
});

export const methodMetadataSchema = z.object({
  stakeholders: z.array(methodStakeholderSchema).default([]),
});

export type MethodStakeholder = z.infer<typeof methodStakeholderSchema>;
export type MethodMetadata = z.infer<typeof methodMetadataSchema>;

export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  projectType: text("project_type").notNull().default("metamodel"),
  referencedMetamodels: jsonb("referenced_metamodels").$type<number[]>().default(sql`'[]'::jsonb`),
  methodMetadata: jsonb("method_metadata").$type<MethodMetadata>().default(sql`'{"stakeholders":[]}'::jsonb`),
  metamodelSetup: jsonb("metamodel_setup").$type<MetamodelSetup | null>().default(sql`'null'::jsonb`),
  createdAt: timestamp("created_at").defaultNow(),
});

export const views = pgTable("views", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  viewType: text("view_type").notNull().default("view"),
  parentNodeId: text("parent_node_id"),
  parentViewId: integer("parent_view_id"),
  modelRules: jsonb("model_rules").$type<ModelRule[]>().default(sql`'[]'::jsonb`),
  createdAt: timestamp("created_at").defaultNow(),
});

export const nodes = pgTable("nodes", {
  id: text("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  type: text("type").notNull().default("default"),
  data: jsonb("data").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const nodeViews = pgTable("node_views", {
  nodeId: text("node_id").notNull(),
  viewId: integer("view_id").notNull(),
  position: jsonb("position").notNull(),
  parentId: text("parent_id"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  pk: primaryKey({ columns: [table.nodeId, table.viewId] }),
}));

export const edges = pgTable("edges", {
  id: text("id").primaryKey(),
  viewId: integer("view_id").notNull(),
  source: text("source").notNull(),
  target: text("target").notNull(),
  edgeType: text("edge_type").notNull().default("association"),
  sourceHandle: text("source_handle"),
  targetHandle: text("target_handle"),
  data: jsonb("data"),
  createdAt: timestamp("created_at").defaultNow(),
});

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
export const insertProjectSchema = createInsertSchema(projects)
  .omit({ id: true, createdAt: true })
  .extend({
    projectType: z.enum(projectTypeEnum).optional(),
    referencedMetamodels: z.array(z.number()).optional(),
    methodMetadata: methodMetadataSchema.optional(),
    metamodelSetup: metamodelSetupSchema.optional().nullable(),
  });
export const insertViewSchema = createInsertSchema(views)
  .omit({ id: true, createdAt: true, viewType: true })
  .extend({ modelRules: z.array(modelRuleSchema).optional() });
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
