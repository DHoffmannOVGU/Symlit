import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";
import {
  graphElementOf,
  hasRelatedFormulas,
  isCalculatedAttribute,
  RelatedCalculator,
  graphRelationshipOf,
  linkRelationships,
  metamodelRelationsOf,
  relatedFormulaContext,
  type CalculationResult,
  type RelatedFormulaContext,
  type GraphAttribute,
  type GraphElement,
  type ProjectGraphRelationship,
  type RelatedGraph,
} from "@shared/related-formula";
import { apiCall } from "@/lib/api-client";
import { useDiagramModel } from "../state/DiagramModelProvider";
import { useDiagramStore } from "../state/DiagramStoreProvider";
import type { NodeAttribute } from "../types";

/** A relationship an element takes part in, for the editor to suggest. */
export interface RelationshipSummary {
  name: string;
  direction: "outgoing" | "incoming";
  count: number;
}

interface RelatedCalculation {
  /**
   * Calculates an attribute of an element as edited (its attributes may be
   * a draft), and says what its aggregates looked at. Null until the
   * project's relationships are loaded.
   */
  preview: (nodeId: string, attributes: NodeAttribute[], attributeId: string) => CalculationResult | null;
  /** The named relationships an element takes part in. */
  relationshipsOf: (nodeId: string) => RelationshipSummary[];
  /**
   * What linking a Related Formula's references needs: the element's
   * attributes as edited, the attributes its aggregates reach, and every
   * attribute known by id (also the types of the metamodels a model uses).
   */
  formulaContext: (nodeId: string, attributes: NodeAttribute[], attributeId: string) => RelatedFormulaContext;
}

const RelatedCalculationContext = createContext<RelatedCalculation>({
  preview: () => null,
  relationshipsOf: () => [],
  formulaContext: (nodeId, attributes, attributeId) => relatedFormulaContext(null, nodeId, attributes, attributeId),
});

export const useRelatedCalculation = () => useContext(RelatedCalculationContext);

/**
 * Keeps the Related Formulas of the open diagram calculated. They look at
 * the whole project: its saved elements and the relationships of all its
 * diagrams, with the open diagram as it is now (unsaved changes included).
 * The results are written into the elements' attributes, where the table,
 * model rules and the editor read them; that is not an edit (calculated
 * values are left out of the unsaved-changes signature).
 */
export function RelatedCalculationProvider({ children }: { children: ReactNode }) {
  const { projectId, viewId, projectType, availablePartDefNodes, relationEdges, parentMap } = useDiagramModel();
  // Types define the formula; their elements, in models, calculate it.
  const calculates = projectType === "instance";
  const nodes = useDiagramStore((state) => state.nodes);
  const edges = useDiagramStore((state) => state.edges);
  const setNodes = useDiagramStore((state) => state.setNodes);

  const liveHasRelated = useMemo(
    () => hasRelatedFormulas(nodes.map((node) => ({ attributes: node.data?.attributes ?? [] }))),
    [nodes],
  );
  // The editor asks for the project's relationships as soon as someone writes a Related Formula.
  const [wanted, setWanted] = useState(false);
  // In a metamodel the graph only serves to link a formula's references to the types' attributes.
  const enabled = (calculates && liveHasRelated) || wanted;
  const graphQuery = useQuery({
    queryKey: [api.projects.graph.path, projectId],
    queryFn: () => apiCall(api.projects.graph, { params: { id: projectId } }),
    enabled: enabled && Number.isFinite(projectId),
  });

  /** The saved project with the open diagram as it is now. */
  const graph = useMemo<RelatedGraph | null>(() => {
    if (!graphQuery.data) return null;
    const elements = new Map<string, GraphElement>(
      graphQuery.data.elements.map((element) => [element.id, element as unknown as GraphElement]),
    );
    for (const node of nodes) elements.set(node.id, graphElementOf(node));
    const relationships: ProjectGraphRelationship[] = [
      ...graphQuery.data.relationships.filter((relationship) => relationship.viewId !== viewId),
      ...edges.map((edge) => graphRelationshipOf({ ...edge, edgeType: edge.type })),
    ];
    // Which metamodel relationship each one is, where it does not say: worked out as validation does.
    return linkRelationships({ elements: Array.from(elements.values()), relationships }, relationEdges, parentMap);
  }, [edges, graphQuery.data, nodes, parentMap, relationEdges, viewId]);

  const calculator = useMemo(() => (graph ? new RelatedCalculator(graph) : null), [graph]);

  // Write the calculated values into the open diagram's elements that have Related Formulas.
  useEffect(() => {
    if (!calculator || !liveHasRelated || !calculates) return;
    const updates = new Map<string, Map<string, string>>();
    for (const node of nodes) {
      const attributes = node.data?.attributes ?? [];
      if (!attributes.some((attribute) => attribute.type === "related")) continue;
      const values = calculator.calculatedValues(node.id);
      const changed = attributes.some(
        (attribute) => isCalculatedAttribute(attribute) && (values.get(attribute.id) ?? "") !== String(attribute.value ?? ""),
      );
      if (changed) updates.set(node.id, values);
    }
    if (updates.size === 0) return;
    setNodes((current) =>
      current.map((node) => {
        const values = updates.get(node.id);
        if (!values) return node;
        return {
          ...node,
          data: {
            ...node.data,
            attributes: (node.data?.attributes ?? []).map((attribute) =>
              values.has(attribute.id) ? { ...attribute, value: values.get(attribute.id) ?? "" } : attribute,
            ),
          },
        };
      }),
    );
  }, [calculates, calculator, liveHasRelated, nodes, setNodes]);

  const preview = useCallback(
    (nodeId: string, attributes: NodeAttribute[], attributeId: string) => {
      if (!wanted) queueMicrotask(() => setWanted(true));
      if (!calculates || !graph) return null;
      const node = nodes.find((candidate) => candidate.id === nodeId);
      const draft: GraphElement = {
        ...(node ? graphElementOf(node) : { id: nodeId, name: "", type: "" }),
        attributes: attributes as GraphAttribute[],
      };
      const elements = [...graph.elements.filter((element) => element.id !== nodeId), draft];
      return new RelatedCalculator({ elements, relationships: graph.relationships }).explain(nodeId, attributeId);
    },
    [calculates, graph, nodes, wanted],
  );

  const relationshipsOf = useCallback(
    (nodeId: string) => {
      if (!graph) return [];
      const counts = new Map<string, RelationshipSummary>();
      const seen = new Set<string>();
      for (const relationship of graph.relationships) {
        if (!relationship.name) continue;
        const direction = relationship.source === nodeId ? "outgoing" : relationship.target === nodeId ? "incoming" : null;
        if (!direction) continue;
        const other = direction === "outgoing" ? relationship.target : relationship.source;
        const unique = `${direction}\u0000${relationship.name.toLowerCase()}\u0000${other}`;
        if (seen.has(unique)) continue;
        seen.add(unique);
        const key = `${direction}\u0000${relationship.name.toLowerCase()}`;
        const entry = counts.get(key) ?? { name: relationship.name, direction, count: 0 };
        entry.count += 1;
        counts.set(key, entry);
      }
      return Array.from(counts.values());
    },
    [graph],
  );

  const knownAttributes = useMemo(
    () =>
      availablePartDefNodes.flatMap((type) =>
        Array.isArray(type.data?.attributes) ? (type.data.attributes as GraphAttribute[]) : [],
      ),
    [availablePartDefNodes],
  );
  const formulaContext = useCallback(
    (nodeId: string, attributes: NodeAttribute[], attributeId: string) => {
      if (!wanted) queueMicrotask(() => setWanted(true));
      const typeId = calculates ? nodes.find((node) => node.id === nodeId)?.data?.typeId : nodeId;
      // In a metamodel the graph is the metamodel: its relationships are the ones a type's formula names.
      const own = !calculates && graph ? metamodelRelationsOf(graph) : null;
      return relatedFormulaContext(graph, nodeId, attributes as GraphAttribute[], attributeId, knownAttributes, {
        relations: own?.relations ?? relationEdges,
        parentMap: own?.parentMap ?? parentMap,
        typeId: typeof typeId === "string" ? typeId : undefined,
      });
    },
    [calculates, graph, knownAttributes, nodes, parentMap, relationEdges, wanted],
  );

  const value = useMemo(
    () => ({ preview, relationshipsOf, formulaContext }),
    [formulaContext, preview, relationshipsOf],
  );
  return <RelatedCalculationContext.Provider value={value}>{children}</RelatedCalculationContext.Provider>;
}
