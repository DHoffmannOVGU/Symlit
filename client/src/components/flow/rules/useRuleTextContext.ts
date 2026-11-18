import { useMemo } from "react";
import { getTypeAncestors } from "@shared/metamodel-inheritance";
import { metaRelationIdOf, metamodelRelationsOf, type MetaRelation } from "@shared/related-formula";
import type { RuleTextContext } from "@shared/rule-text";
import { useRelatedCalculation } from "../related/RelatedCalculationProvider";
import { useDiagramModel } from "../state/DiagramModelProvider";
import { useDiagramStore } from "../state/DiagramStoreProvider";
import type { NodeData } from "../types";
import { diagramGraph, getModelRuleTargetOptions, nodeMatchesTarget } from "./model-rules";

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

type Attribute = { id: string; name: string };
const attributesOf = (data: unknown): Attribute[] => {
  const attributes = (data as { attributes?: unknown } | undefined)?.attributes;
  return Array.isArray(attributes)
    ? (attributes as Attribute[]).filter((attribute) => typeof attribute?.id === "string" && typeof attribute.name === "string")
    : [];
};

/**
 * What a rule's text needs to name things here, by the type the rule looks
 * at: the types, the attributes and the metamodel relationships its names
 * may stand for, so that it is stored by ids and shown by names.
 */
export function useRuleTextContext(): (targetType: string) => RuleTextContext {
  const nodes = useDiagramStore((state) => state.nodes);
  const edges = useDiagramStore((state) => state.edges);
  const { projectType, typeMetaById, availablePartDefNodes, relationEdges, parentMap } = useDiagramModel();
  const { ruleGraph } = useRelatedCalculation();

  return useMemo(() => {
    const graph = ruleGraph ?? diagramGraph(nodes, edges);
    const options = getModelRuleTargetOptions(nodes);
    const metamodel = projectType === "metamodel";
    // In a metamodel the types are its elements; in a model, the types of its metamodels.
    // A type's name now comes first: elements keep the name their type had when they were made.
    const types: RuleTextContext["types"] = [
      ...(metamodel
        ? []
        : Array.from(typeMetaById.entries()).map(([value, meta]) => ({ value, label: meta.label, preferred: true }))),
      ...options.builtInTypes.map((option) => ({ ...option, preferred: !metamodel })),
      ...options.viewTypes.map((option) => ({ ...option, preferred: metamodel })),
    ];
    const own = metamodel ? metamodelRelationsOf(graph) : null;
    const relations: MetaRelation[] = own
      ? own.relations
      : relationEdges.map((edge) => ({ ...edge, edgeType: edge.edgeType ?? "association" }));
    const parents = own?.parentMap ?? parentMap;
    const everyAttribute: Attribute[] = [
      ...nodes.flatMap((node) => attributesOf(node.data)),
      ...graph.elements.flatMap((element) => element.attributes),
      ...availablePartDefNodes.flatMap((type) => attributesOf(type.data)),
    ];

    return (targetType: string): RuleTextContext => {
      const all = !targetType || targetType === "all";
      // The type itself: `node:<id>` names a type of this metamodel (or an element), anything else a type id.
      const typeId = all ? null : targetType.startsWith("node:") ? targetType.slice("node:".length) : targetType;
      const ancestors = typeId ? getTypeAncestors(typeId, parents) : null;
      const typeAttributes = availablePartDefNodes
        .filter((type) => !ancestors || ancestors.has(type.id))
        .flatMap((type) => attributesOf(type.data));
      const ownAttributes = [
        ...nodes.filter((node) => nodeMatchesTarget(node, targetType)).flatMap((node) => attributesOf(node.data)),
        ...typeAttributes,
      ];
      const relationTouches = (relation: MetaRelation, end: "sourceTypeId" | "targetTypeId") =>
        !ancestors || ancestors.has(relation[end]);
      return {
        types,
        ownAttributes,
        relatedAttributes: everyAttribute,
        relationCandidates: (name, direction) => {
          const ids = new Set<string>();
          for (const relation of relations) {
            if (relation.edgeType === "generalization" || !sameName(relation.label ?? "", name)) continue;
            if (
              (direction !== "incoming" && relationTouches(relation, "sourceTypeId")) ||
              (direction !== "outgoing" && relationTouches(relation, "targetTypeId"))
            ) {
              ids.add(metaRelationIdOf(relation.id));
            }
          }
          return Array.from(ids);
        },
        relationName: (id) => {
          const relation = relations.find((candidate) => metaRelationIdOf(candidate.id) === id);
          if (relation) return (relation.label ?? "").trim() || undefined;
          return graph.relationships.find((relationship) => relationship.relationId === id)?.name || undefined;
        },
      };
    };
  }, [availablePartDefNodes, edges, nodes, parentMap, projectType, relationEdges, ruleGraph, typeMetaById]);
}

/** The relationship names an element of a type takes part in, by direction, for the rules panel to offer. */
export function useRuleRelationshipNames(): (targetType: string) => Array<{ name: string; direction: "outgoing" | "incoming" }> {
  const nodes = useDiagramStore((state) => state.nodes);
  const edges = useDiagramStore((state) => state.edges);
  const { projectType, relationEdges, parentMap } = useDiagramModel();
  const { ruleGraph } = useRelatedCalculation();
  return useMemo(() => {
    const graph = ruleGraph ?? diagramGraph(nodes, edges);
    const own = projectType === "metamodel" ? metamodelRelationsOf(graph) : null;
    const relations: MetaRelation[] = own
      ? own.relations
      : relationEdges.map((edge) => ({ ...edge, edgeType: edge.edgeType ?? "association" }));
    const parents = own?.parentMap ?? parentMap;
    return (targetType: string) => {
      const all = !targetType || targetType === "all";
      const typeId = all ? null : targetType.startsWith("node:") ? targetType.slice("node:".length) : targetType;
      const ancestors = typeId ? getTypeAncestors(typeId, parents) : null;
      const found = new Map<string, { name: string; direction: "outgoing" | "incoming" }>();
      const add = (name: string, direction: "outgoing" | "incoming") => {
        const trimmed = name.trim();
        if (trimmed) found.set(`${direction}\u0000${trimmed.toLowerCase()}`, { name: trimmed, direction });
      };
      for (const relation of relations) {
        if (relation.edgeType === "generalization") continue;
        if (!ancestors || ancestors.has(relation.sourceTypeId)) add(relation.label ?? "", "outgoing");
        if (!ancestors || ancestors.has(relation.targetTypeId)) add(relation.label ?? "", "incoming");
      }
      // And the relationships the diagram's elements of that type have.
      const targets = new Set(
        nodes.filter((node) => nodeMatchesTarget(node, targetType)).map((node) => node.id),
      );
      for (const relationship of graph.relationships) {
        if (targets.has(relationship.source)) add(relationship.name, "outgoing");
        if (targets.has(relationship.target)) add(relationship.name, "incoming");
      }
      return Array.from(found.values()).sort((a, b) => a.name.localeCompare(b.name) || a.direction.localeCompare(b.direction));
    };
  }, [edges, nodes, parentMap, projectType, relationEdges, ruleGraph]);
}

/** The attributes the elements of a type have, by name, with their kind (for the lists' comparisons and values). */
export function useRuleAttributeChoices(): (targetType: string) => Array<{ name: string; type: string; options: string[] }> {
  const nodes = useDiagramStore((state) => state.nodes);
  const { availablePartDefNodes, parentMap } = useDiagramModel();
  return useMemo(() => {
    return (targetType: string) => {
      const all = !targetType || targetType === "all";
      const typeId = all ? null : targetType.startsWith("node:") ? targetType.slice("node:".length) : targetType;
      const ancestors = typeId ? getTypeAncestors(typeId, parentMap) : null;
      const found = new Map<string, { name: string; type: string; options: string[] }>();
      const add = (data: unknown) => {
        const attributes = (data as NodeData | undefined)?.attributes ?? [];
        for (const attribute of attributes) {
          const name = attribute.name?.trim();
          if (!name || found.has(name.toLowerCase())) continue;
          found.set(name.toLowerCase(), { name, type: attribute.type ?? "string", options: attribute.options ?? [] });
        }
      };
      for (const node of nodes) if (all || nodeMatchesTarget(node, targetType)) add(node.data);
      for (const type of availablePartDefNodes) if (!ancestors || ancestors.has(type.id)) add(type.data);
      return Array.from(found.values()).sort((a, b) => a.name.localeCompare(b.name));
    };
  }, [availablePartDefNodes, nodes, parentMap]);
}
