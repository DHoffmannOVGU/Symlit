import { useDiagramModel } from "../state/DiagramModelProvider";
import { useDiagramStore } from "../state/DiagramStoreProvider";
import { useMemo } from "react";
import { type CustomEdgeData } from "../edges/CustomEdges";

export interface UseCanvasTableRowsParams {
  nodeTableFilter: string;
  edgeTableFilter: string;
}

export function useCanvasTableRows({
  nodeTableFilter,
  edgeTableFilter,
}: UseCanvasTableRowsParams) {
  const nodes = useDiagramStore((state) => state.nodes);
  const edges = useDiagramStore((state) => state.edges);
  const { isExternalNode } = useDiagramModel();
  const nodeTableRows = useMemo(
    () =>
      nodes.map((node) => {
        const data = node.data;
        return {
          id: node.id,
          name: data?.label || "",
          type: data?.type || node.type || "",
          typeId: data?.typeId || "",
          icon: data?.icon || "Box",
          color: data?.color,
          description: data?.description || "",
          isReadOnly: isExternalNode(node.id),
          parentId: node.parentId || data?.typeId || "",
          attributes: (data?.attributes ?? []).filter((attr) => attr.name?.trim()),
        };
      }),
    [nodes, isExternalNode],
  );

  const nameById = useMemo(
    () => new Map(nodes.map((node) => [node.id, node.data?.label || "Unnamed"])),
    [nodes],
  );

  // One column per attribute name, in the order the names first appear.
  const attributeColumns = useMemo(() => {
    const names: string[] = [];
    const seen = new Set<string>();
    for (const row of nodeTableRows) {
      for (const attr of row.attributes) {
        const key = attr.name.trim().toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        names.push(attr.name.trim());
      }
    }
    return names;
  }, [nodeTableRows]);

  const edgeTableRows = useMemo(
    () =>
      edges.map((edge) => {
        const data = edge.data as
          | (CustomEdgeData & {
              parentId?: string;
              name?: string;
            })
          | undefined;
        return {
          id: edge.id,
          name:
            data?.label ||
            data?.name ||
            [edge.source, edge.target].join(" -> "),
          type: data?.edgeType || edge.type || "",
          source: edge.source,
          target: edge.target,
          sourceName: nameById.get(edge.source) || "(missing element)",
          targetName: nameById.get(edge.target) || "(missing element)",
          description: data?.description || "",
          parentId: data?.parentId || edge.source || "",
        };
      }),
    [edges, nameById],
  );

  const normalizedNodeTableFilter = nodeTableFilter.trim().toLowerCase();
  const normalizedEdgeTableFilter = edgeTableFilter.trim().toLowerCase();

  const filteredNodeTableRows = useMemo(() => {
    if (!normalizedNodeTableFilter) return nodeTableRows;
    return nodeTableRows.filter((row) =>
      [row.name, row.type, row.description, ...row.attributes.flatMap((attr) => [attr.name, attr.value, attr.unit])]
        .join(" ")
        .toLowerCase()
        .includes(normalizedNodeTableFilter),
    );
  }, [nodeTableRows, normalizedNodeTableFilter]);

  const filteredEdgeTableRows = useMemo(() => {
    if (!normalizedEdgeTableFilter) return edgeTableRows;
    return edgeTableRows.filter((row) =>
      [
        row.name,
        row.type,
        row.description,
        row.sourceName,
        row.targetName,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedEdgeTableFilter),
    );
  }, [edgeTableRows, normalizedEdgeTableFilter]);

  return {
    nodeTableRows,
    attributeColumns,
    filteredNodeTableRows,
    edgeTableRows,
    filteredEdgeTableRows,
  };
}
