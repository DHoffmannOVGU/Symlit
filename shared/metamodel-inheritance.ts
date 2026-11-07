import type { MagicRelationType } from "./metamodel-setup";

export type MetamodelEdgeType = MagicRelationType | (string & {});

export type MetamodelEdgeLike = {
  edgeType: MetamodelEdgeType;
  label?: string;
  sourceTypeId: string;
  targetTypeId: string;
};

export type MetamodelNodeLike = {
  id: string;
  data?: { typeId?: string | null } | null;
};

export const buildParentMap = (edges: MetamodelEdgeLike[]) => {
  const parentMap = new Map<string, Set<string>>();
  edges.forEach((edge) => {
    if (edge.edgeType !== "generalization") return;
    const existing = parentMap.get(edge.sourceTypeId);
    if (existing) {
      existing.add(edge.targetTypeId);
      return;
    }
    parentMap.set(edge.sourceTypeId, new Set([edge.targetTypeId]));
  });
  return parentMap;
};

export const buildParentMapFromNodes = (nodes: MetamodelNodeLike[]) => {
  const parentMap = new Map<string, Set<string>>();
  nodes.forEach((node) => {
    const parentId = node.data?.typeId;
    if (!parentId || parentId === node.id) return;
    const existing = parentMap.get(node.id);
    if (existing) {
      existing.add(parentId);
      return;
    }
    parentMap.set(node.id, new Set([parentId]));
  });
  return parentMap;
};

export const mergeParentMaps = (
  ...maps: Array<Map<string, Set<string>>>
) => {
  const merged = new Map<string, Set<string>>();
  maps.forEach((map) => {
    map.forEach((parents, childId) => {
      const existing = merged.get(childId);
      if (!existing) {
        merged.set(childId, new Set(parents));
        return;
      }
      parents.forEach((parentId) => existing.add(parentId));
    });
  });
  return merged;
};

export const getTypeAncestors = (
  typeId: string,
  parentMap: Map<string, Set<string>>,
) => {
  const ancestors = new Set<string>();
  const stack = [typeId];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    if (ancestors.has(current)) continue;
    ancestors.add(current);
    const parents = parentMap.get(current);
    if (!parents) continue;
    parents.forEach((parent) => {
      if (!ancestors.has(parent)) {
        stack.push(parent);
      }
    });
  }

  return ancestors;
};
