import { getTypeAncestors } from "@shared/metamodel-inheritance";
import type { NodeAttribute } from "@/components/flow/types";
import { recalculateDerivedAttributes } from "@/components/flow/utils/attribute-formula";

/** A type as the diagram knows it: its id and its attributes. */
export type TypeWithAttributes = { id: string; data?: { attributes?: unknown } | null };

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
 * Attributes an element gets from its type AND from the types that type
 * specializes (Generalization), nearest first. An attribute the type defines
 * itself wins over one of the same name further up. Calculated values are
 * brought up to date for the element's own values.
 */
export function attributesForElementOfType(
  typeId: string,
  types: TypeWithAttributes[],
  parentMap: Map<string, Set<string>>,
): NodeAttribute[] {
  const byId = new Map(types.map((type) => [type.id, type]));
  const collected: NodeAttribute[] = [];
  const ids = new Set<string>();
  const names = new Set<string>();
  for (const ancestorId of Array.from(getTypeAncestors(typeId, parentMap))) {
    for (const attr of attributesFromType(ancestorId, byId.get(ancestorId)?.data?.attributes)) {
      const name = attr.name.trim().toLowerCase();
      if (ids.has(attr.id) || names.has(name)) continue;
      ids.add(attr.id);
      names.add(name);
      collected.push(attr);
    }
  }
  return recalculateDerivedAttributes(collected);
}

/**
 * The attributes of the type (and of the types it specializes) that an
 * element does not have yet, matched by id or by name (ignoring case), so an
 * attribute the element renamed or already defined itself is not offered again.
 */
export function missingTypeAttributes(
  elementAttributes: NodeAttribute[],
  typeId: string,
  types: TypeWithAttributes[],
  parentMap: Map<string, Set<string>>,
): NodeAttribute[] {
  const ids = new Set(elementAttributes.map((attr) => attr.id));
  const inheritedIds = new Set(elementAttributes.map((attr) => attr.inheritedFrom?.attrId).filter(Boolean));
  const names = new Set(elementAttributes.map((attr) => attr.name.trim().toLowerCase()));
  return attributesForElementOfType(typeId, types, parentMap).filter(
    (attr) => !ids.has(attr.id) && !inheritedIds.has(attr.id) && !names.has(attr.name.trim().toLowerCase()),
  );
}
