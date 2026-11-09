import { z } from "zod";
import { modelRuleSchema } from "./contracts";
import { metamodelSetupSchema } from "./metamodel-setup";

/*
 * The Symlit project file: what the JSON export writes and what project
 * templates are made of (docs/decisions/project-templates.md). One file is a
 * bundle: a main project, the metamodels it references (directly or through
 * other metamodels) and their patterns.
 *
 * Ids in a file (projects, diagrams, elements) only connect things within
 * the file; importing gives everything fresh ids. Reading is lenient about
 * fields it does not need (an export carries database details such as
 * `createdAt`), strict about the ones it uses.
 */

const fileNodeSchema = z.object({
  id: z.string().trim().min(1),
  /** The project the element belongs to; defaults to the diagram's project. */
  projectId: z.number().int().optional(),
  type: z.string().min(1).optional(),
  position: z.object({ x: z.number().finite(), y: z.number().finite() }),
  data: z.record(z.unknown()).nullable().optional(),
  parentId: z.string().min(1).nullable().optional(),
});

const fileEdgeSchema = z.object({
  id: z.string().min(1).optional(),
  source: z.string().min(1),
  target: z.string().min(1),
  edgeType: z.string().min(1).nullable().optional(),
  sourceHandle: z.string().nullable().optional(),
  targetHandle: z.string().nullable().optional(),
  data: z.unknown().optional(),
});

const fileViewSchema = z.object({
  id: z.number().int().optional(),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  modelRules: z.array(modelRuleSchema).optional(),
  nodes: z.array(fileNodeSchema).default([]),
  edges: z.array(fileEdgeSchema).default([]),
});

const fileProjectSchema = z.object({
  id: z.number().int(),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  projectType: z.enum(["metamodel", "instance"]),
  metamodelSetup: metamodelSetupSchema.nullable().optional(),
  referencedMetamodels: z.array(z.number().int()).nullable().optional(),
});

const bundledProjectSchema = z.object({
  project: fileProjectSchema,
  views: z.array(fileViewSchema).default([]),
  patterns: z.array(fileViewSchema).optional(),
});

/** Describes a file meant as a project template. */
export const templateInfoSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  description: z.string().default(""),
  /** Offered when creating a project (the tutorial's template is not). */
  listed: z.boolean().default(true),
});

export const projectFileSchema = bundledProjectSchema.extend({
  template: templateInfoSchema.optional(),
  export: z.object({ version: z.literal(1) }).passthrough(),
  referencedMetamodels: z.array(bundledProjectSchema).optional(),
});

export type ProjectFile = z.infer<typeof projectFileSchema>;
export type ProjectFileInput = z.input<typeof projectFileSchema>;
export type TemplateInfo = z.infer<typeof templateInfoSchema>;

/** A project template as offered when creating a project. */
export const projectTemplateSummarySchema = templateInfoSchema.extend({
  projectType: z.enum(["metamodel", "instance"]),
  projectName: z.string(),
  projectDescription: z.string(),
  metamodelSetup: metamodelSetupSchema.nullable(),
  /** Names of the metamodels the template brings along. */
  includedMetamodels: z.array(z.string()),
});
export type ProjectTemplateSummary = z.infer<typeof projectTemplateSummarySchema>;
