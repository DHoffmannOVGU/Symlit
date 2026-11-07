import { getTypeAncestors } from "./metamodel-inheritance";

export interface ValidationIssue {
  type: "node" | "edge";
  id: string;
  message: string;
  relatedNodeIds?: string[];
}

export interface ValidationModelNode {
  id: string;
  type?: string | null;
  data?: { label?: string; typeId?: string } | null;
}

export interface ValidationModelEdge {
  id: string;
  source: string;
  target: string;
  edgeType?: string | null;
  data?: { label?: string } | null;
}

export interface ValidationTypeNode {
  id: string;
  label: string;
}

export interface ValidationRelationEdge {
  sourceTypeId?: string;
  targetTypeId?: string;
  edgeType?: string;
  label?: string;
}

// The metamodel a model is validated against: available types, the relations
// (excluding "generalization") allowed between them, and an inheritance
// parent map (childTypeId -> parentTypeIds) used for ancestor-aware matching.
// Callers are responsible for resolving this graph (local metamodel nodes,
// referenced-project metamodels, or built-in default types) and building
// parentMap via shared/metamodel-inheritance.ts — that resolution is
// intentionally out of scope for this pure function.
export interface ValidationMetamodel {
  typeNodes: ValidationTypeNode[];
  relationEdges: ValidationRelationEdge[];
  parentMap: Map<string, Set<string>>;
}

export function validateInstanceModel(
  model: { nodes: ValidationModelNode[]; edges: ValidationModelEdge[] },
  metamodel: ValidationMetamodel,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const typeIdSet = new Set(metamodel.typeNodes.map((node) => node.id));
  const typeLabelById = new Map(
    metamodel.typeNodes.map((node) => [node.id, node.label]),
  );
  const nodeById = new Map(model.nodes.map((node) => [node.id, node]));

  model.nodes.forEach((node) => {
    if (node.type !== "part") return;
    const data = node.data ?? undefined;
    const nodeLabel = data?.label || node.id;

    if (!data?.typeId) {
      issues.push({
        type: "node",
        id: node.id,
        message: `Node "${nodeLabel}" has no type selected.`,
      });
      return;
    }

    if (!typeIdSet.has(data.typeId)) {
      issues.push({
        type: "node",
        id: node.id,
        message: `Node "${nodeLabel}" references missing type "${typeLabelById.get(data.typeId) || data.typeId}".`,
      });
    }
  });

  model.edges.forEach((edge) => {
    const sourceNode = nodeById.get(edge.source);
    const targetNode = nodeById.get(edge.target);
    if (!sourceNode || !targetNode) {
      const missingEndpoints = [
        !sourceNode ? `source "${edge.source}"` : null,
        !targetNode ? `target "${edge.target}"` : null,
      ]
        .filter((endpoint): endpoint is string => endpoint !== null)
        .join(" and ");
      issues.push({
        type: "edge",
        id: edge.id,
        message: `Edge "${edge.id}" references a missing ${missingEndpoints} node.`,
      });
      return;
    }
    if (sourceNode.type !== "part" || targetNode.type !== "part") return;

    const sourceData = sourceNode.data ?? undefined;
    const targetData = targetNode.data ?? undefined;
    const sourceTypeId = sourceData?.typeId;
    const targetTypeId = targetData?.typeId;
    const edgeData = edge.data ?? undefined;
    const edgeType = edge.edgeType || "association";
    const edgeLabel = (edgeData?.label || "").trim();

    if (!sourceTypeId || !targetTypeId) {
      issues.push({
        type: "edge",
        id: edge.id,
        message: `Edge "${edgeLabel || "unnamed"}" connects nodes with missing types.`,
      });
      return;
    }

    const sourceAncestors = getTypeAncestors(sourceTypeId, metamodel.parentMap);
    const targetAncestors = getTypeAncestors(targetTypeId, metamodel.parentMap);
    const matchingMetaEdges = metamodel.relationEdges.filter(
      (meta) =>
        !!meta.sourceTypeId &&
        !!meta.targetTypeId &&
        sourceAncestors.has(meta.sourceTypeId) &&
        targetAncestors.has(meta.targetTypeId),
    );

    const allowed = matchingMetaEdges.some((meta) => meta.edgeType === edgeType);
    if (!allowed) {
      issues.push({
        type: "edge",
        id: edge.id,
        message: `Edge "${edgeLabel || "unnamed"}" is not allowed for ${typeLabelById.get(sourceTypeId) || sourceTypeId} → ${typeLabelById.get(targetTypeId) || targetTypeId}.`,
      });
      return;
    }

    const labelMatch = matchingMetaEdges.some(
      (meta) => meta.edgeType === edgeType && (meta.label || "").trim() === edgeLabel,
    );
    if (!labelMatch) {
      const allowedLabels = matchingMetaEdges
        .filter((meta) => meta.edgeType === edgeType)
        .map((meta) => (meta.label || "(empty)").trim() || "(empty)")
        .join(", ");

      issues.push({
        type: "edge",
        id: edge.id,
        message: `Edge "${edgeLabel || "unnamed"}" has an invalid label. Allowed: ${allowedLabels || "(none)"}.`,
      });
    }
  });

  return issues;
}
