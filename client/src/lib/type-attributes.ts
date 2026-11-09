import type { NodeAttribute } from "@/components/flow/types";

/**
 * Attributes an element gets from its type. They are copies: the element can
 * change them, and later changes to the type do not reach them. Each copy keeps
 * the type attribute's id, so derived formulas that refer to other attributes
 * by id keep working, and records where it came from (`inheritedFrom`).
 */
export function attributesFromType(typeId: string, typeAttributes: unknown): NodeAttribute[] {
  if (!Array.isArray(typeAttributes)) return [];
  return typeAttributes
    .filter((attr): attr is NodeAttribute => !!attr && typeof attr === "object" && typeof attr.id === "string")
    .filter((attr) => typeof attr.name === "string" && attr.name.trim() !== "")
    .map((attr) => ({
      ...attr,
      value: typeof attr.value === "string" ? attr.value : "",
      unit: typeof attr.unit === "string" ? attr.unit : "",
      options: Array.isArray(attr.options) ? [...attr.options] : attr.options,
      inheritedFrom: { nodeId: typeId, attrId: attr.id },
    }));
}

/**
 * The type's attributes an element does not have yet, matched by id or by
 * name (ignoring case), so an attribute the element renamed or already
 * defined itself is not offered again.
 */
export function missingTypeAttributes(
  elementAttributes: NodeAttribute[],
  typeId: string,
  typeAttributes: unknown,
): NodeAttribute[] {
  const ids = new Set(elementAttributes.map((attr) => attr.id));
  const inheritedIds = new Set(elementAttributes.map((attr) => attr.inheritedFrom?.attrId).filter(Boolean));
  const names = new Set(elementAttributes.map((attr) => attr.name.trim().toLowerCase()));
  return attributesFromType(typeId, typeAttributes).filter(
    (attr) => !ids.has(attr.id) && !inheritedIds.has(attr.id) && !names.has(attr.name.trim().toLowerCase()),
  );
}
