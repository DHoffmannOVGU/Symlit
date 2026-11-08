import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import type { ProjectType } from "@shared/schema";
import {
  getConfiguredMagicNodeTypes,
  getConfiguredMagicRelationTypes,
  magicNodeTypeCatalog,
  type MagicRelationType,
  type MetamodelSetup,
} from "@shared/metamodel-setup";
import {
  buildParentMap,
  buildParentMapFromNodes,
  mergeParentMaps,
} from "@shared/metamodel-inheritance";
import { useFlow } from "@/hooks/use-flow";
import { useView } from "@/hooks/use-views";
import type { NodeData } from "../types";
import { useMetamodelParts } from "../hooks/useMetamodelParts";
import { useDiagramStore } from "./DiagramStoreProvider";

export interface DiagramModelInput {
  viewId: number;
  projectId: number;
  projectType: ProjectType;
  metamodelSetup?: MetamodelSetup | null;
  referencedMetamodelIds?: number[];
  referencedMetamodels?: Array<{ id: number; name: string; metamodelSetup?: MetamodelSetup | null }>;
  viewMode?: "build" | "flow";
}

type TypeMeta = {
  referenceTypeId: string;
  originTypeId: string;
  originProjectId?: number;
  label: string;
};

const EMPTY_IDS: number[] = [];
const EMPTY_METAMODELS: NonNullable<DiagramModelInput["referencedMetamodels"]> = [];

/**
 * Read-only information about the open diagram's model: which project and
 * view it is, the element and relationship types its metamodel(s) allow,
 * type inheritance, model rules, and which elements come from referenced
 * projects. Computed once here and read with `useDiagramModel()`.
 */
function useDiagramModelValue({
  viewId,
  projectId,
  projectType,
  metamodelSetup,
  referencedMetamodelIds = EMPTY_IDS,
  referencedMetamodels = EMPTY_METAMODELS,
  viewMode = "build",
}: DiagramModelInput) {
  const nodes = useDiagramStore((state) => state.nodes);
  const edges = useDiagramStore((state) => state.edges);
  const selectedNodeId = useDiagramStore((state) => state.selectedNodeId);
  const flowQuery = useFlow(viewId);
  const viewQuery = useView(viewId);

  const isFlowMode = viewMode === "flow" && projectType === "instance";

  // Elements whose owning project differs from this one come from a
  // referenced project and are read-only here.
  const externalNodeIds = useMemo(() => {
    const ids = new Set<string>();
    for (const node of flowQuery.data?.nodes ?? []) {
      if (node.projectId !== projectId) ids.add(node.id);
    }
    return ids;
  }, [flowQuery.data, projectId]);
  const isExternalNode = useCallback((nodeId: string) => externalNodeIds.has(nodeId), [externalNodeIds]);

  const metamodelParts = useMetamodelParts({
    nodes,
    edges,
    projectType,
    referencedMetamodelIds,
    referencedMetamodels,
    selectedNodeId,
  });
  const { availablePartDefNodes, availablePartDefEdges, referencedModelRules, referencedRelationTypes } =
    metamodelParts;

  const localModelRules = useMemo(() => viewQuery.data?.modelRules ?? [], [viewQuery.data?.modelRules]);
  const activeModelRules = useMemo(
    () =>
      projectType === "metamodel"
        ? localModelRules
        : projectType === "instance"
          ? [...referencedModelRules, ...localModelRules]
          : [],
    [localModelRules, projectType, referencedModelRules],
  );
  const inheritedModelRuleIds = useMemo(
    () => new Set(referencedModelRules.map((rule) => rule.id)),
    [referencedModelRules],
  );

  const typeMetaById = useMemo(
    () =>
      new Map<string, TypeMeta>(
        availablePartDefNodes.map((node) => {
          const data = node.data as unknown as
            | (NodeData & { _referenceTypeId?: string; _originTypeId?: string; _originProjectId?: number })
            | undefined;
          return [
            node.id,
            {
              referenceTypeId: data?._referenceTypeId || node.id,
              originTypeId: data?._originTypeId || node.id,
              originProjectId: data?._originProjectId,
              label: data?.label || node.id,
            },
          ];
        }),
      ),
    [availablePartDefNodes],
  );

  const parentMap = useMemo(
    () =>
      mergeParentMaps(
        buildParentMap(availablePartDefEdges),
        buildParentMapFromNodes(
          availablePartDefNodes.map((node) => ({
            id: node.id,
            data: (node.data as unknown as NodeData | undefined)
              ? { typeId: (node.data as unknown as NodeData).typeId }
              : undefined,
          })),
        ),
      ),
    [availablePartDefEdges, availablePartDefNodes],
  );
  const relationEdges = useMemo(
    () => availablePartDefEdges.filter((edge) => edge.edgeType !== "generalization"),
    [availablePartDefEdges],
  );

  /** Relationship types allowed here; undefined means "all". */
  const configuredRelationTypes = useMemo<MagicRelationType[] | undefined>(() => {
    if (projectType === "metamodel") return getConfiguredMagicRelationTypes(metamodelSetup);
    if (projectType === "instance" && referencedMetamodelIds.length > 0) return referencedRelationTypes;
    return undefined;
  }, [metamodelSetup, projectType, referencedMetamodelIds.length, referencedRelationTypes]);
  const edgeTypeCycle = useMemo(
    () => configuredRelationTypes ?? getConfiguredMagicRelationTypes(null),
    [configuredRelationTypes],
  );

  /** Element type the metamodel creates by default. */
  const metamodelDefaultType = useMemo(() => {
    if (projectType !== "metamodel") return undefined;
    const defaultType = magicNodeTypeCatalog.find(
      (item) => item.id === getConfiguredMagicNodeTypes(metamodelSetup)[0],
    );
    return defaultType ? { id: defaultType.id, label: defaultType.label, icon: defaultType.iconName } : undefined;
  }, [metamodelSetup, projectType]);

  return useMemo(
    () => ({
      viewId,
      projectId,
      projectType,
      metamodelSetup,
      referencedMetamodels,
      isFlowMode,
      isExternalNode,
      ...metamodelParts,
      localModelRules,
      activeModelRules,
      inheritedModelRuleIds,
      typeMetaById,
      parentMap,
      relationEdges,
      configuredRelationTypes,
      edgeTypeCycle,
      metamodelDefaultType,
    }),
    [
      viewId,
      projectId,
      projectType,
      metamodelSetup,
      referencedMetamodels,
      isFlowMode,
      isExternalNode,
      metamodelParts,
      localModelRules,
      activeModelRules,
      inheritedModelRuleIds,
      typeMetaById,
      parentMap,
      relationEdges,
      configuredRelationTypes,
      edgeTypeCycle,
      metamodelDefaultType,
    ],
  );
}

export type DiagramModel = ReturnType<typeof useDiagramModelValue>;

const DiagramModelContext = createContext<DiagramModel | null>(null);

export function DiagramModelProvider({ children, ...input }: DiagramModelInput & { children: ReactNode }) {
  const value = useDiagramModelValue(input);
  return <DiagramModelContext.Provider value={value}>{children}</DiagramModelContext.Provider>;
}

export function useDiagramModel(): DiagramModel {
  const model = useContext(DiagramModelContext);
  if (!model) throw new Error("useDiagramModel must be used inside <DiagramModelProvider>.");
  return model;
}
