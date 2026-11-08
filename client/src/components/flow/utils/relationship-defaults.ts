import { getTypeAncestors } from "@shared/metamodel-inheritance";
import type { HandleSide } from "@shared/relationships";
import { getEdgeMarkers, type CustomEdgeData } from "../edges/CustomEdges";
import type { MetaRelationOption } from "../edges/EdgeRelationConfirmation";
import type { PartDefEdge } from "../hooks/useMetamodelParts";
import type { DiagramEdge, DiagramNode, NodeData } from "../types";

/*
 * Choosing what a newly drawn relationship is. Pure functions, tested in
 * relationship-defaults.test.ts.
 */

type ParentMap = Parameters<typeof getTypeAncestors>[1];

/** The metamodel type an element is (instances: its typeId; types: itself). */
export function typeIdOf(node: DiagramNode | undefined, typeMetaById: Map<string, unknown>) {
  if (!node) return undefined;
  const typeId = (node.data as NodeData | undefined)?.typeId;
  if (typeId) return typeId;
  return typeMetaById.has(node.id) ? node.id : undefined;
}

/** Relationships the metamodel defines between these types (or their supertypes). */
export function allowedRelations(
  sourceTypeId: string | undefined,
  targetTypeId: string | undefined,
  parentMap: ParentMap,
  relations: PartDefEdge[],
): PartDefEdge[] {
  if (!sourceTypeId || !targetTypeId) return [];
  const sourceAncestors = getTypeAncestors(sourceTypeId, parentMap);
  const targetAncestors = getTypeAncestors(targetTypeId, parentMap);
  return relations.filter(
    (relation) => sourceAncestors.has(relation.sourceTypeId) && targetAncestors.has(relation.targetTypeId),
  );
}

/** The relationship to suggest: a named one if there is any. */
export const defaultRelation = (relations: PartDefEdge[]) =>
  relations.find((relation) => (relation.label ?? "").trim().length > 0) ?? relations[0];

/** Choices offered after drawing, labelled for the confirmation popover. */
export function relationOptions(relations: PartDefEdge[], typeMetaById: Map<string, { label: string }>): MetaRelationOption[] {
  return relations.map((relation) => {
    const sourceLabel = typeMetaById.get(relation.sourceTypeId)?.label || relation.sourceTypeId;
    const targetLabel = typeMetaById.get(relation.targetTypeId)?.label || relation.targetTypeId;
    return {
      id: relation.id,
      edgeType: relation.edgeType,
      flowType: relation.flowType,
      label: relation.label,
      displayLabel: relation.label?.trim() || `${sourceLabel} → ${targetLabel} (${relation.edgeType})`,
    };
  });
}

/** A new relationship on the canvas, with the styling and markers of its type. */
export function newRelationshipEdge(input: {
  id: string;
  source: string;
  target: string;
  sourceHandle: HandleSide;
  targetHandle: HandleSide;
  edgeType: CustomEdgeData["edgeType"];
  label?: string;
  flowType?: CustomEdgeData["flowType"];
}): DiagramEdge {
  const { data, markerStart, markerEnd } = getEdgeMarkers({
    edgeType: input.edgeType,
    label: input.label,
    flowType: input.flowType,
  });
  return {
    id: input.id,
    source: input.source,
    target: input.target,
    sourceHandle: input.sourceHandle,
    targetHandle: input.targetHandle,
    type: data.edgeType,
    data,
    markerStart,
    markerEnd,
  };
}
