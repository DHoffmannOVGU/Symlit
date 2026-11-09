import { z } from "zod";

export const magicNodeTypeEnum = [
  "partdef",
  "actiondef",
  "concerndef",
  "agentdef",
  "requirementdef",
  "eventdef",
  "capabilitydef",
] as const;

export type MagicNodeType = (typeof magicNodeTypeEnum)[number];

/**
 * Built-in kinds that were renamed, old name -> current name. Stored
 * diagrams keep the old name until they are saved again.
 */
const RENAMED_KINDS: Record<string, { label: string; nodeType: string }> = {
  Part: { label: "Object", nodeType: "partdef" },
  Action: { label: "Behavior", nodeType: "actiondef" },
  Agent: { label: "Performer", nodeType: "agentdef" },
  Requirement: { label: "Need", nodeType: "requirementdef" },
};

/**
 * The current name of an element's built-in kind. Only the built-in kind is
 * renamed: in a metamodel, an element of that kind; in an instance model, an
 * untyped element. An element typed by a metamodel type that someone named,
 * say, "Requirement" keeps that name.
 */
export function currentKindLabel(
  typeLabel: unknown,
  element: { nodeType?: string | null; typeId?: unknown },
): string | undefined {
  if (typeof typeLabel !== "string") return undefined;
  const renamed = RENAMED_KINDS[typeLabel];
  if (!renamed) return typeLabel;
  // Part, Action and Agent have always been renamed everywhere.
  if (typeLabel !== "Requirement") return renamed.label;
  if (element.typeId) return typeLabel;
  const isBuiltInKind = element.nodeType === renamed.nodeType || element.nodeType === "part" || !element.nodeType;
  return isBuiltInKind ? renamed.label : typeLabel;
}

/** Whether a stored type name means the built-in Need kind (also under its old name). */
export const isNeedKindLabel = (typeLabel: unknown) => typeLabel === "Need" || typeLabel === "Requirement";

export const magicRelationTypeEnum = [
  "association",
  "aggregation",
  "composition",
  "generalization",
  "dependency",
  "realization",
] as const;

export type MagicRelationType = (typeof magicRelationTypeEnum)[number];

export const isMagicRelationType = (
  value: unknown,
): value is MagicRelationType =>
  typeof value === "string" &&
  (magicRelationTypeEnum as readonly string[]).includes(value);

export const metamodelPurposeEnum = [
  "system-context",
  "requirements",
  "behavior",
  "architecture",
  "custom",
] as const;

export type MetamodelPurpose = (typeof metamodelPurposeEnum)[number];

export const magicNodeTypeCatalog: Array<{
  id: MagicNodeType;
  label: string;
  description: string;
  iconName: string;
}> = [
  {
    id: "partdef",
    label: "Object",
    description: "A structural element or system part.",
    iconName: "Box",
  },
  {
    id: "actiondef",
    label: "Behavior",
    description: "An action, function, or behavior.",
    iconName: "Zap",
  },
  {
    id: "concerndef",
    label: "Concern",
    description: "A concern, quality, or cross-cutting topic.",
    iconName: "Shield",
  },
  {
    id: "agentdef",
    label: "Performer",
    description: "A person, team, or agent that performs work.",
    iconName: "Bot",
  },
  {
    id: "requirementdef",
    label: "Need",
    description: "A need, requirement, or constraint someone has.",
    iconName: "BadgeCheck",
  },
  {
    id: "eventdef",
    label: "Event",
    description: "A happening that triggers or changes the system.",
    iconName: "Radio",
  },
  {
    id: "capabilitydef",
    label: "Capability",
    description: "An ability the system or an element provides.",
    iconName: "Gem",
  },
];

export const magicRelationTypeCatalog: Array<{
  id: MagicRelationType;
  label: string;
  description: string;
  semantics: {
    lineStyle: "solid" | "dashed";
    sourceMarker: "none" | "aggregation" | "composition";
    targetMarker: "none" | "arrow" | "arrowclosed" | "generalization";
  };
}> = [
  {
    id: "association",
    label: "Association",
    description: "A general relationship between two types.",
    semantics: {
      lineStyle: "solid",
      sourceMarker: "none",
      targetMarker: "arrowclosed",
    },
  },
  {
    id: "aggregation",
    label: "Aggregation",
    description: "A whole-part relationship.",
    semantics: {
      lineStyle: "solid",
      sourceMarker: "aggregation",
      targetMarker: "arrowclosed",
    },
  },
  {
    id: "composition",
    label: "Composition",
    description: "A strong whole-part relationship where parts belong to one whole.",
    semantics: {
      lineStyle: "solid",
      sourceMarker: "composition",
      targetMarker: "arrowclosed",
    },
  },
  {
    id: "generalization",
    label: "Generalization",
    description: "An inheritance relationship between types.",
    semantics: {
      lineStyle: "solid",
      sourceMarker: "none",
      targetMarker: "generalization",
    },
  },
  {
    id: "dependency",
    label: "Dependency",
    description: "A usage relationship where the source depends on the target.",
    semantics: {
      lineStyle: "dashed",
      sourceMarker: "none",
      targetMarker: "arrow",
    },
  },
  {
    id: "realization",
    label: "Realization",
    description: "An implementation relationship where the source fulfills the target.",
    semantics: {
      lineStyle: "dashed",
      sourceMarker: "none",
      targetMarker: "generalization",
    },
  },
];

export function getMagicRelationTypeDefinition(
  relationType: string | null | undefined,
) {
  return (
    magicRelationTypeCatalog.find((relation) => relation.id === relationType) ??
    magicRelationTypeCatalog[0]
  );
}

export const metamodelPurposeCatalog: Array<{
  id: MetamodelPurpose;
  label: string;
  description: string;
  nodeTypes: MagicNodeType[];
  relationTypes: MagicRelationType[];
}> = [
  {
    id: "system-context",
    label: "A system context",
    description: "Systems, external actors, capabilities, and their boundaries.",
    nodeTypes: ["partdef", "agentdef", "capabilitydef", "eventdef"],
    relationTypes: ["association", "aggregation"],
  },
  {
    id: "requirements",
    label: "A requirements language",
    description: "Requirements, stakeholders, system elements, and traceability.",
    nodeTypes: ["requirementdef", "partdef", "agentdef", "capabilitydef"],
    relationTypes: ["association", "generalization"],
  },
  {
    id: "behavior",
    label: "A behavior model",
    description: "Behaviors, events, performers, and the things they affect.",
    nodeTypes: ["actiondef", "eventdef", "agentdef", "partdef"],
    relationTypes: ["association", "aggregation"],
  },
  {
    id: "architecture",
    label: "A system architecture",
    description: "Structural parts, behaviors, requirements, and capabilities.",
    nodeTypes: [
      "partdef",
      "actiondef",
      "requirementdef",
      "capabilitydef",
      "agentdef",
    ],
    relationTypes: ["association", "aggregation", "generalization"],
  },
  {
    id: "custom",
    label: "Something else",
    description: "Start with a small vocabulary and shape it yourself.",
    nodeTypes: ["partdef"],
    relationTypes: ["association"],
  },
];

export const metamodelSetupSchema = z.object({
  version: z.literal(1),
  purpose: z.enum(metamodelPurposeEnum),
  description: z.string().trim().max(500).default(""),
  nodeTypes: z.array(z.enum(magicNodeTypeEnum)).max(magicNodeTypeEnum.length),
  relationTypes: z
    .array(z.enum(magicRelationTypeEnum))
    .max(magicRelationTypeEnum.length),
});

export type MetamodelSetup = z.infer<typeof metamodelSetupSchema>;

export function getMetamodelPurposeRecommendation(
  purpose: MetamodelPurpose,
): MetamodelSetup {
  const recommendation =
    metamodelPurposeCatalog.find((item) => item.id === purpose) ??
    metamodelPurposeCatalog[metamodelPurposeCatalog.length - 1];
  return {
    version: 1,
    purpose: recommendation.id,
    description: "",
    nodeTypes: [...recommendation.nodeTypes],
    relationTypes: [...recommendation.relationTypes],
  };
}

export function normalizeMetamodelSetup(
  value: unknown,
): MetamodelSetup | null {
  const parsed = metamodelSetupSchema.safeParse(value);
  if (!parsed.success) return null;

  const nodeTypes = Array.from(new Set(parsed.data.nodeTypes));
  const relationTypes = Array.from(new Set(parsed.data.relationTypes));
  return {
    ...parsed.data,
    nodeTypes: nodeTypes.length > 0 ? nodeTypes : ["partdef"],
    relationTypes,
  };
}

export function getConfiguredMagicNodeTypes(
  setup: MetamodelSetup | null | undefined,
): MagicNodeType[] {
  return setup?.nodeTypes?.length
    ? setup.nodeTypes
    : magicNodeTypeCatalog.map((item) => item.id);
}

export function getConfiguredMagicRelationTypes(
  setup: MetamodelSetup | null | undefined,
): MagicRelationType[] {
  // Projects created before setup metadata existed keep the original
  // relationship palette. New relationship types are opt-in through setup.
  return setup?.relationTypes ?? [
    "association",
    "aggregation",
    "generalization",
  ];
}