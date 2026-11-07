import type {
  AiCurrentMetamodel,
  AiMetamodelNodeKind,
  AiMetamodelProposal,
} from "@shared/ai-metamodel";
import type { MagicRelationType } from "@shared/metamodel-setup";

export type AiProposalReviewStatus = "new" | "overlap" | "invalid";

export type AiProposalNodeReview = {
  itemId: string;
  status: AiProposalReviewStatus;
  warnings: string[];
};

export type AiProposalEdgeReview = {
  itemId: string;
  status: AiProposalReviewStatus;
  warnings: string[];
};

export type AiMetamodelProposalReview = {
  nodes: AiProposalNodeReview[];
  edges: AiProposalEdgeReview[];
  warnings: string[];
  defaultSelectedNodeIds: string[];
  defaultSelectedEdgeIndexes: number[];
};

const normalize = (value: string) => value.trim().toLocaleLowerCase();

const edgeKey = (
  source: string,
  target: string,
  relation: string,
) => `${source}::${target}::${relation}`;

export function reviewAiMetamodelProposal(
  proposal: AiMetamodelProposal,
  currentModel: AiCurrentMetamodel,
  allowedNodeKinds: readonly AiMetamodelNodeKind[],
  allowedRelationTypes: readonly MagicRelationType[],
): AiMetamodelProposalReview {
  const currentNodeIds = new Set(currentModel.nodes.map((node) => node.id));
  const currentNodeNames = new Map(
    currentModel.nodes.map((node) => [
      `${normalize(node.name)}::${normalize(node.kind)}`,
      node,
    ]),
  );
  const proposedNodeIds = new Set<string>();
  const proposedNodeNames = new Set<string>();
  const allowedNodes = new Set(allowedNodeKinds);
  const allowedRelations = new Set(allowedRelationTypes);
  const warnings = [...(proposal.warnings ?? [])];

  const nodes: AiProposalNodeReview[] = proposal.nodes.map((node) => {
    const itemWarnings: string[] = [];
    const normalizedName = normalize(node.name);
    const normalizedKind = normalize(node.kind);
    const nameKey = `${normalizedName}::${normalizedKind}`;

    if (!allowedNodes.has(node.kind)) {
      itemWarnings.push(`Type "${node.kind}" is not enabled in this metamodel.`);
    }
    if (proposedNodeIds.has(node.id)) {
      itemWarnings.push(`Duplicate proposal identifier "${node.id}".`);
    }
    if (currentNodeIds.has(node.id)) {
      itemWarnings.push(
        `Identifier "${node.id}" already exists in the current model.`,
      );
    }
    if (proposedNodeNames.has(nameKey)) {
      itemWarnings.push(`Another proposed element has the same name and type.`);
    }
    const existingMatch = currentNodeNames.get(nameKey);
    if (existingMatch) {
      itemWarnings.push(
        `Overlaps the existing "${existingMatch.name}" element.`,
      );
    }

    proposedNodeIds.add(node.id);
    proposedNodeNames.add(nameKey);
    return {
      itemId: node.id,
      status: (itemWarnings.some((warning) =>
        warning.includes("not enabled") ||
        warning.includes("Duplicate") ||
        warning.includes("already exists") ||
        warning.includes("same name"),
      )
        ? "invalid"
        : existingMatch
          ? "overlap"
          : "new") as AiProposalReviewStatus,
      warnings: itemWarnings,
    };
  });

  const knownNodeIds = new Set(currentNodeIds);
  proposedNodeIds.forEach((id) => knownNodeIds.add(id));
  const existingEdges = new Set(
    currentModel.edges.map((edge) =>
      edgeKey(edge.source, edge.target, edge.relation),
    ),
  );
  const proposedEdges = new Set<string>();
  const edges: AiProposalEdgeReview[] = proposal.edges.map((edge, index) => {
    const itemWarnings: string[] = [];
    const relationKey = edgeKey(edge.source, edge.target, edge.relation);
    if (!allowedRelations.has(edge.relation)) {
      itemWarnings.push(
        `Relationship "${edge.relation}" is not enabled in this metamodel.`,
      );
    }
    if (!knownNodeIds.has(edge.source)) {
      itemWarnings.push(`Source "${edge.source}" is not in the current proposal or model.`);
    }
    if (!knownNodeIds.has(edge.target)) {
      itemWarnings.push(`Target "${edge.target}" is not in the current proposal or model.`);
    }
    if (edge.source === edge.target) {
      itemWarnings.push("A relationship cannot connect an element to itself.");
    }
    if (proposedEdges.has(relationKey)) {
      itemWarnings.push("Duplicate proposed relationship.");
    }
    if (existingEdges.has(relationKey)) {
      itemWarnings.push("Overlaps an existing relationship.");
    }

    proposedEdges.add(relationKey);
    const isInvalid = itemWarnings.some((warning) =>
      warning.includes("not enabled") ||
      warning.includes("not in the current") ||
      warning.includes("cannot connect") ||
      warning.includes("Duplicate proposed"),
    );
    return {
      itemId: `${index}`,
      status: (isInvalid
        ? "invalid"
        : existingEdges.has(relationKey)
          ? "overlap"
          : "new") as AiProposalReviewStatus,
      warnings: itemWarnings,
    };
  });

  for (const item of [...nodes, ...edges]) {
    warnings.push(...item.warnings);
  }

  return {
    nodes,
    edges,
    warnings: Array.from(new Set(warnings)),
    defaultSelectedNodeIds: nodes
      .filter((item) => item.status === "new")
      .map((item) => item.itemId),
    defaultSelectedEdgeIndexes: edges
      .flatMap((item, index) => item.status === "new" ? [index] : []),
  };
}

export function filterAiMetamodelProposal(
  proposal: AiMetamodelProposal,
  currentModel: AiCurrentMetamodel,
  selectedNodeIds: ReadonlySet<string>,
  selectedEdgeIndexes: ReadonlySet<number>,
): AiMetamodelProposal {
  const nodes = proposal.nodes.filter((node) => selectedNodeIds.has(node.id));
  const knownIds = new Set([
    ...currentModel.nodes.map((node) => node.id),
    ...nodes.map((node) => node.id),
  ]);
  const edges = proposal.edges.filter(
    (edge, index) =>
      selectedEdgeIndexes.has(index) &&
      knownIds.has(edge.source) &&
      knownIds.has(edge.target) &&
      edge.source !== edge.target,
  );
  return { ...proposal, nodes, edges };
}
