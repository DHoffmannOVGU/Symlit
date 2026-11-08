import { z } from "zod";
import { magicRelationTypeEnum, type MagicRelationType } from "./metamodel-setup";

/*
 * Relationship (edge) data shared by the client and server. Browser-safe: no
 * database imports.
 *
 * Writes are strict (`relationshipDataSchema`, `normalizeRelationship`);
 * reads stay lenient so a diagram with unexpected stored data still opens.
 * Migration 0005 cleaned stored relationships to match these rules.
 */

/** Every element has one handle per side; it works as start and end of a relationship. */
export const HANDLE_SIDES = ["top", "right", "bottom", "left"] as const;
export type HandleSide = (typeof HANDLE_SIDES)[number];

/** Handle ids written by older versions, which had separate source/target handles per side. */
export const LEGACY_HANDLE_IDS = ["top-source", "left-source", "right-target", "bottom-target"] as const;

/**
 * Maps a stored handle id to its side. Older diagrams used `null` for the
 * default handles (bottom for sources, top for targets) and suffixed ids.
 */
export const normalizeHandleId = (
  kind: "source" | "target",
  handleId: string | null | undefined,
): HandleSide => {
  if (!handleId) return kind === "source" ? "bottom" : "top";
  const side = handleId.replace(/-(source|target)$/, "");
  return (HANDLE_SIDES as readonly string[]).includes(side)
    ? (side as HandleSide)
    : kind === "source"
      ? "bottom"
      : "top";
};

const anchorSchema = z.object({
  side: z.enum(HANDLE_SIDES),
  offset: z.number().min(0).max(1),
});

/**
 * What a relationship's `data` may contain. Known fields must have the right
 * type; other fields are kept so newer clients can add some without breaking
 * older servers.
 */
export const relationshipDataSchema = z
  .object({
    edgeType: z.enum(magicRelationTypeEnum).optional(),
    flowType: z.enum(["partflow", "actionflow", "informationflow"]).optional(),
    label: z.string().optional(),
    description: z.string().optional(),
    multiplicity: z.string().optional(),
    variability: z.enum(["mandatory", "optional"]).optional(),
    strokeWidth: z.number().positive().max(50).optional(),
    strokeColor: z.string().optional(),
    lineStyle: z.enum(["solid", "dashed", "dotted"]).optional(),
    sourceArrow: z.enum(["none", "arrow", "arrowclosed"]).optional(),
    targetArrow: z.enum(["none", "arrow", "arrowclosed"]).optional(),
    pathType: z.enum(["default", "straight", "step", "smoothstep"]).optional(),
    animated: z.boolean().optional(),
    sourceAnchor: anchorSchema.optional(),
    targetAnchor: anchorSchema.optional(),
  })
  .passthrough();
export type RelationshipData = z.infer<typeof relationshipDataSchema>;

/** A handle as sent by clients: a side, an older id, or nothing (the default). */
export const handleInputSchema = z
  .union([z.enum(HANDLE_SIDES), z.enum(LEGACY_HANDLE_IDS)])
  .nullable()
  .optional();

type RelationshipLike = {
  edgeType?: string | null;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  data?: unknown;
};

/**
 * The canonical stored form of a relationship: a known type that matches
 * `data.edgeType`, handles named by side, and `data` always an object.
 */
export function normalizeRelationship<T extends RelationshipLike>(edge: T) {
  const data = edge.data && typeof edge.data === "object" && !Array.isArray(edge.data)
    ? (edge.data as Record<string, unknown>)
    : {};
  const candidate = edge.edgeType ?? data.edgeType;
  const edgeType: MagicRelationType = (magicRelationTypeEnum as readonly unknown[]).includes(candidate)
    ? (candidate as MagicRelationType)
    : "association";
  return {
    ...edge,
    edgeType,
    sourceHandle: normalizeHandleId("source", edge.sourceHandle),
    targetHandle: normalizeHandleId("target", edge.targetHandle),
    data: { ...data, edgeType },
  };
}
