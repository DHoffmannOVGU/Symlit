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
  /** Target end: how many targets each source element needs (shared/multiplicity.ts); empty means any number. */
  multiplicity?: string;
  /** Source end: how many sources each target element needs. */
  sourceMultiplicity?: string;
}

/**
 * The rest of the project, for checks that look beyond one diagram: the
 * elements and relationships of its other diagrams.
 */
export interface ValidationContext {
  nodes: ValidationModelNode[];
  edges: ValidationModelEdge[];
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
  /** The project's other diagrams. Without it, multiplicities are counted in this diagram only. */
  context: ValidationContext = { nodes: [], edges: [] },
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

  issues.push(...validateMultiplicities(model, metamodel, typeLabelById, context));

  return issues;
}

/**
 * Multiplicities. A metamodel relationship "A —label→ B" can restrict both
 * ends: how many such relationships to a B every A needs (target end), and
 * how many from an A every B needs (source end). Subtypes count as their
 * parents.
 *
 * Counting covers the whole project: a relationship may be drawn in another
 * diagram than the one being validated, and the same relationship drawn in
 * several diagrams counts once. Issues are reported for the elements of the
 * validated diagram only.
 *
 * Cost: one pass over the relationships to index them, then one lookup per
 * element and restricted relationship type.
 */
function validateMultiplicities(
  model: { nodes: ValidationModelNode[]; edges: ValidationModelEdge[] },
  metamodel: ValidationMetamodel,
  typeLabelById: Map<string, string>,
  context: ValidationContext,
): ValidationIssue[] {
  type End = "target" | "source";
  const restrictions = metamodel.relationEdges.flatMap((meta) => {
    if (!meta.sourceTypeId || !meta.targetTypeId) return [];
    const ends: Array<[End, string | undefined]> = [
      ["target", meta.multiplicity],
      ["source", meta.sourceMultiplicity],
    ];
    return ends.flatMap(([end, text]) => {
      const multiplicity = parseMultiplicity(text);
      // Text that is not a multiplicity restricts nothing; saving refuses it and the metamodel's validation reports it.
      if (!multiplicity || isUnrestricted(multiplicity)) return [];
      return [
        {
          end,
          multiplicity,
          edgeType: meta.edgeType || "association",
          label: (meta.label || "").trim(),
          // The type whose elements are counted for, and the type at the other end.
          ownTypeId: end === "target" ? meta.sourceTypeId! : meta.targetTypeId!,
          otherTypeId: end === "target" ? meta.targetTypeId! : meta.sourceTypeId!,
        },
      ];
    });
  });
  if (restrictions.length === 0) return [];

  const ancestorsOf = new Map<string, Set<string>>();
  const ancestors = (typeId: string) => {
    let known = ancestorsOf.get(typeId);
    if (!known) {
      known = getTypeAncestors(typeId, metamodel.parentMap);
      ancestorsOf.set(typeId, known);
    }
    return known;
  };

  // Types of all typed elements; the validated diagram wins over stored copies (it may hold unsaved edits).
  const typeIdOf = new Map<string, string>();
  for (const node of [...context.nodes, ...model.nodes]) {
    if (node.type === "part" && node.data?.typeId) typeIdOf.set(node.id, node.data.typeId);
  }

  // Elements at the other end, by "<element>|<relationship type>|<label>", for each direction.
  // Sets make a relationship drawn in several diagrams count once.
  const key = (nodeId: string, edgeType: string, label: string) => `${nodeId}\u0000${edgeType}\u0000${label}`;
  const targetsOf = new Map<string, Set<string>>();
  const sourcesOf = new Map<string, Set<string>>();
  const index = (map: Map<string, Set<string>>, mapKey: string, other: string) => {
    const known = map.get(mapKey);
    if (known) known.add(other);
    else map.set(mapKey, new Set([other]));
  };
  for (const edge of [...context.edges, ...model.edges]) {
    if (!typeIdOf.has(edge.source) || !typeIdOf.has(edge.target)) continue;
    const edgeType = edge.edgeType || "association";
    const label = (edge.data?.label || "").trim();
    index(targetsOf, key(edge.source, edgeType, label), edge.target);
    index(sourcesOf, key(edge.target, edgeType, label), edge.source);
  }

  const issues: ValidationIssue[] = [];
  for (const node of model.nodes) {
    const typeId = node.type === "part" ? node.data?.typeId : undefined;
    if (!typeId) continue;
    const ownAncestors = ancestors(typeId);
    for (const restriction of restrictions) {
      if (!ownAncestors.has(restriction.ownTypeId)) continue;
      const { multiplicity, end, edgeType, label } = restriction;
      const connected = (end === "target" ? targetsOf : sourcesOf).get(key(node.id, edgeType, label));
      const others = connected
        ? Array.from(connected).filter((id) => ancestors(typeIdOf.get(id)!).has(restriction.otherTypeId))
        : [];
      const count = others.length;
      if (count >= multiplicity.min && (multiplicity.max === null || count <= multiplicity.max)) continue;
      const relationship = `${label ? `"${label}"` : edgeType} relationship${multiplicity.max === 1 ? "" : "s"}`;
      issues.push({
        type: "node",
        id: node.id,
        message: `"${node.data?.label || node.id}" needs ${describeMultiplicity(multiplicity)} ${relationship} ${
          end === "target" ? "to" : "from"
        } ${typeLabelById.get(restriction.otherTypeId) || restriction.otherTypeId}, but has ${count === 0 ? "none" : count}.`,
        ...(count > 0 ? { relatedNodeIds: others } : {}),
      });
    }
  }
  return issues;
}

/** A metamodel relationship whose multiplicity text cannot be read. */
export function invalidMultiplicityIssues(
  edges: Array<{ id: string; label?: string; multiplicity?: string; sourceMultiplicity?: string }>,
): ValidationIssue[] {
  return edges.flatMap((edge) =>
    [edge.multiplicity, edge.sourceMultiplicity]
      .filter((text) => parseMultiplicity(text) === null)
      .map((text) => ({
        type: "edge" as const,
        id: edge.id,
        message: `Relationship "${edge.label || "unnamed"}" has the multiplicity "${text}", which is not understood and is not checked. Use a number (1), a range (0..1) or an open range (1..*).`,
      })),
  );
}
