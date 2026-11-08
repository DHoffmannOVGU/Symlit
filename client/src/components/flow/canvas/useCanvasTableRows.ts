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
        };
      }),
    [nodes, isExternalNode],
  );

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
          description: data?.description || "",
          parentId: data?.parentId || edge.source || "",
        };
      }),
    [edges],
  );

  const normalizedNodeTableFilter = nodeTableFilter.trim().toLowerCase();
  const normalizedEdgeTableFilter = edgeTableFilter.trim().toLowerCase();

  const filteredNodeTableRows = useMemo(() => {
    if (!normalizedNodeTableFilter) return nodeTableRows;
    return nodeTableRows.filter((row) =>
      [row.name, row.id, row.type, row.description, row.parentId]
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
        row.id,
        row.type,
        row.description,
        row.parentId,
        row.source,
        row.target,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedEdgeTableFilter),
    );
  }, [edgeTableRows, normalizedEdgeTableFilter]);

  return {
    nodeTableRows,
    filteredNodeTableRows,
    edgeTableRows,
    filteredEdgeTableRows,
  };
}
