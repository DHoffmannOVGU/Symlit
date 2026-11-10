import { getTypeAncestors } from "./metamodel-inheritance";
import { describeMultiplicity, isUnrestricted, parseMultiplicity } from "./multiplicity";

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
  /** How many targets each source element needs (shared/multiplicity.ts); empty means any number. */
  multiplicity?: string;
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

  issues.push(...validateMultiplicities(model, metamodel, typeLabelById));

  return issues;
}

/**
 * Multiplicities: a metamodel relationship "A —label→ B [min..max]" requires
 * every element typed A (or a subtype) to have that many such relationships
 * to elements typed B (or a subtype). Checked per diagram, like everything
 * else here: relationships live in diagrams.
 */
function validateMultiplicities(
  model: { nodes: ValidationModelNode[]; edges: ValidationModelEdge[] },
  metamodel: ValidationMetamodel,
  typeLabelById: Map<string, string>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const restricted = metamodel.relationEdges.flatMap((meta) => {
    if (!meta.sourceTypeId || !meta.targetTypeId) return [];
    const multiplicity = parseMultiplicity(meta.multiplicity);
    // Text that is not a multiplicity restricts nothing; the metamodel's own validation reports it.
    if (!multiplicity || isUnrestricted(multiplicity)) return [];
    return [{ meta, multiplicity, sourceTypeId: meta.sourceTypeId, targetTypeId: meta.targetTypeId }];
  });
  if (restricted.length === 0) return issues;

  const ancestorsOf = new Map<string, Set<string>>();
  const ancestors = (typeId: string) => {
    let known = ancestorsOf.get(typeId);
    if (!known) {
      known = getTypeAncestors(typeId, metamodel.parentMap);
      ancestorsOf.set(typeId, known);
    }
    return known;
  };
  const typed = model.nodes.filter((node) => node.type === "part" && node.data?.typeId);
  const nodeById = new Map(typed.map((node) => [node.id, node]));

  for (const { meta, multiplicity, sourceTypeId, targetTypeId } of restricted) {
    const edgeType = meta.edgeType || "association";
    const label = (meta.label || "").trim();
    const targetType = typeLabelById.get(targetTypeId) || targetTypeId;
    const relationship = label ? `"${label}" relationship` : `${edgeType} relationship`;

    for (const node of typed) {
      if (!ancestors(node.data!.typeId!).has(sourceTypeId)) continue;
      const targets = model.edges
        .filter((edge) => {
          if (edge.source !== node.id) return false;
          if ((edge.edgeType || "association") !== edgeType) return false;
          if ((edge.data?.label || "").trim() !== label) return false;
          const target = nodeById.get(edge.target);
          return !!target && ancestors(target.data!.typeId!).has(targetTypeId);
        })
        .map((edge) => edge.target);
      const count = targets.length;
      const tooFew = count < multiplicity.min;
      const tooMany = multiplicity.max !== null && count > multiplicity.max;
      if (!tooFew && !tooMany) continue;
      issues.push({
        type: "node",
        id: node.id,
        message: `"${node.data?.label || node.id}" needs ${describeMultiplicity(multiplicity)} ${relationship}${
          multiplicity.max === 1 ? "" : "s"
        } to ${targetType}, but has ${count === 0 ? "none" : count}.`,
        ...(targets.length > 0 ? { relatedNodeIds: targets } : {}),
      });
    }
  }
  return issues;
}

/** A metamodel relationship whose multiplicity text cannot be read. */
export function invalidMultiplicityIssues(
  edges: Array<{ id: string; label?: string; multiplicity?: string }>,
): ValidationIssue[] {
  return edges
    .filter((edge) => parseMultiplicity(edge.multiplicity) === null)
    .map((edge) => ({
      type: "edge" as const,
      id: edge.id,
      message: `Relationship "${edge.label || "unnamed"}" has the multiplicity "${edge.multiplicity}", which is not understood and is not checked. Use a number (1), a range (0..1) or an open range (1..*).`,
    }));
}
