import { z } from "zod";
import { magicRelationTypeEnum } from "./metamodel-setup";

export const aiMetamodelNodeKindEnum = [
  "object", "behavior", "concern", "performer", "requirement", "event", "capability",
] as const;
export type AiMetamodelNodeKind = (typeof aiMetamodelNodeKindEnum)[number];

export const aiMetamodelAttributeSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(300).default(""),
  type: z.enum(["string", "number", "boolean", "date", "list"]),
  unit: z.string().trim().max(30).default(""),
  options: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
});

export const aiMetamodelNodeSchema = z.object({
  id: z.string().trim().regex(/^[a-z][a-z0-9_-]{0,63}$/i),
  kind: z.enum(aiMetamodelNodeKindEnum),
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).default(""),
  attributes: z.array(aiMetamodelAttributeSchema).max(20).default([]),
});

export const aiMetamodelEdgeSchema = z.object({
  source: z.string().trim().min(1).max(100),
  target: z.string().trim().min(1).max(100),
  relation: z.enum(magicRelationTypeEnum),
  label: z.string().trim().max(100).default(""),
  description: z.string().trim().max(300).default(""),
});

export const aiMetamodelProposalSchema = z.object({
  summary: z.string().trim().min(1).max(1000),
  nodes: z.array(aiMetamodelNodeSchema).max(30),
  edges: z.array(aiMetamodelEdgeSchema).max(60),
  warnings: z.array(z.string().trim().min(1).max(300)).max(30).default([]),
}).superRefine((proposal, context) => {
  const ids = new Set<string>();
  proposal.nodes.forEach((node, index) => {
    if (ids.has(node.id)) context.addIssue({ code: z.ZodIssueCode.custom, message: `Duplicate proposed node id: ${node.id}`, path: ["nodes", index, "id"] });
    ids.add(node.id);
  });
});

export const aiCurrentMetamodelSchema = z.object({
  nodes: z.array(z.object({
    id: z.string().max(120),
    name: z.string().max(100),
    kind: z.string().max(60),
    description: z.string().max(500).default(""),
    attributes: z.array(z.object({ name: z.string().max(80), type: z.string().max(30), unit: z.string().max(30).default("") })).max(20).default([]),
  })).max(100),
  edges: z.array(z.object({
    source: z.string().max(120), target: z.string().max(120), relation: z.string().max(40), label: z.string().max(100).default(""),
  })).max(200),
});

export type AiCurrentMetamodel = z.infer<typeof aiCurrentMetamodelSchema>;

export const aiMetamodelRequestSchema = z.object({
  prompt: z.string().trim().min(3).max(4000),
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().trim().min(1).max(2000),
  })).max(12).default([]),
  currentModel: aiCurrentMetamodelSchema,
  allowedNodeKinds: z
    .array(z.enum(aiMetamodelNodeKindEnum))
    .min(1)
    .max(aiMetamodelNodeKindEnum.length)
    .default([...aiMetamodelNodeKindEnum]),
  allowedRelationTypes: z
    .array(z.enum(magicRelationTypeEnum))
    .min(1)
    .max(magicRelationTypeEnum.length)
    .default([...magicRelationTypeEnum]),
});

export type AiMetamodelProposal = z.infer<typeof aiMetamodelProposalSchema>;
export type AiMetamodelRequest = z.infer<typeof aiMetamodelRequestSchema>;
