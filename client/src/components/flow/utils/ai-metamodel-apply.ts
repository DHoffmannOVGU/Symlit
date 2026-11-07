import type { AiMetamodelProposal } from "@shared/ai-metamodel";
import type {
  DiagramEdge,
  DiagramNode as Node,
  NodeAttribute,
  NodeData,
} from "../types";
import { getDefaultNodeStyle } from "@/components/layout/sidebar/SidebarConstants";
import { getEdgeMarkers } from "./edge-utils";

const kindMeta = {
  object: { nodeType: "partdef", typeLabel: "Object" },
  behavior: { nodeType: "actiondef", typeLabel: "Behavior" },
  concern: { nodeType: "concerndef", typeLabel: "Concern" },
  performer: { nodeType: "agentdef", typeLabel: "Performer" },
  requirement: { nodeType: "requirementdef", typeLabel: "Requirement" },
  event: { nodeType: "eventdef", typeLabel: "Event" },
  capability: { nodeType: "capabilitydef", typeLabel: "Capability" },
} as const;

export type MetamodelLayoutDirection = "TB" | "LR";

export function chooseMetamodelProposalLayoutDirection(
  proposal: AiMetamodelProposal,
): MetamodelLayoutDirection {
  const hierarchicalRelationships = proposal.edges.filter(
    (edge) => edge.relation === "generalization" || edge.relation === "aggregation",
  ).length;
  const processElements = proposal.nodes.filter(
    (node) => node.kind === "behavior" || node.kind === "event",
  ).length;

  // Structural models read best as top-down hierarchies. Process-oriented
  // proposals and association networks read more naturally from left to right.
  if (hierarchicalRelationships > proposal.edges.length / 2) return "TB";
  if (processElements >= 2) return "LR";
  return hierarchicalRelationships > 0 ? "TB" : "LR";
}

export function buildMetamodelProposalElements(
  proposal: AiMetamodelProposal,
  existingNodes: Node[],
  existingEdges: DiagramEdge[],
  makeId: (kind: "node" | "edge" | "attribute", index: number) => string,
) {
  const existingIds = new Set(existingNodes.map((node) => node.id));
  const idMap = new Map<string, string>();
  const skipped: string[] = [];
  proposal.nodes.forEach((node, index) => {
    if (!kindMeta[node.kind]) {
      skipped.push(`Unsupported element type "${node.kind}" for "${node.name}".`);
      return;
    }
    idMap.set(node.id, makeId("node", index));
  });
  const rightmost = existingNodes.reduce((max, node) => Math.max(max, node.position.x), -240);
  const startX = rightmost + 280;
  const startY = existingNodes.length ? Math.min(...existingNodes.map((node) => node.position.y)) : 0;
  const columns = Math.max(1, Math.ceil(Math.sqrt(proposal.nodes.length)));
  const nodes: Node[] = proposal.nodes.flatMap((node, index) => {
    const meta = kindMeta[node.kind];
    if (!meta) return [];
    const style = getDefaultNodeStyle(meta.nodeType, meta.typeLabel);
    const id = idMap.get(node.id)!;
    const attributes: NodeAttribute[] = node.attributes.map((attribute, attributeIndex) => ({
      id: makeId("attribute", index * 100 + attributeIndex),
      name: attribute.name,
      description: attribute.description,
      type: attribute.type,
      value: "",
      unit: attribute.unit,
      ...(attribute.type === "list" ? { options: attribute.options } : {}),
    }));
    const data: NodeData = {
      label: node.name,
      description: node.description,
      type: meta.typeLabel,
      icon: style.iconName,
      color: style.color,
      attributes,
    };
    return [{
      id,
      type: meta.nodeType,
      position: { x: startX + (index % columns) * 260, y: startY + Math.floor(index / columns) * 180 },
      data,
    }];
  });
  const knownEndpoint = (id: string) => idMap.get(id) ?? (existingIds.has(id) ? id : null);
  const edges: DiagramEdge[] = proposal.edges.flatMap((edge, index) => {
    const source = knownEndpoint(edge.source);
    const target = knownEndpoint(edge.target);
    if (!source || !target || source === target) {
      skipped.push(
        `Skipped ${edge.relation} relationship "${edge.source}" → "${edge.target}" because its endpoints are invalid.`,
      );
      return [];
    }
    const markers = getEdgeMarkers({
      edgeType: edge.relation,
      label: edge.label || undefined,
      description: edge.description || undefined,
    });
    return [{
      id: makeId("edge", existingEdges.length + index),
      source,
      target,
      type: edge.relation,
      data: markers.data,
      markerStart: markers.markerStart,
      markerEnd: markers.markerEnd,
    }];
  });
  return { nodes, edges, skipped };
}
