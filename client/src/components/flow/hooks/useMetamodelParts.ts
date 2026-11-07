import { useEffect, useMemo, useState } from "react";
import type { Edge, Node } from "@xyflow/react";
import { apiRequest } from "@/lib/queryClient";
import { PARTDEF_DEFAULT_ACCENT_COLOR } from "../nodes/PartDefNode";
import { ACTIONDEF_DEFAULT_ACCENT_COLOR } from "../nodes/ActionDefNode";
import { CONCERNDEF_DEFAULT_ACCENT_COLOR } from "../nodes/ConcernDefNode";
import { AGENTDEF_DEFAULT_ACCENT_COLOR } from "../nodes/AgentDefNode";
import { REQUIREMENTDEF_DEFAULT_ACCENT_COLOR } from "../nodes/RequirementDefNode";
import { EVENTDEF_DEFAULT_ACCENT_COLOR } from "../nodes/EventDefNode";
import { CAPABILITYDEF_DEFAULT_ACCENT_COLOR } from "../nodes/CapabilityDefNode";
import type { NodeData } from "../types";
import type { CustomEdgeData } from "../edges/CustomEdges";
import { modelRuleSchema, type ModelRule, type ProjectType } from "@shared/schema";
import {
  getConfiguredMagicRelationTypes,
  isMagicRelationType,
  normalizeMetamodelSetup,
  type MagicRelationType,
  type MetamodelSetup,
} from "@shared/metamodel-setup";
import { canonicalizeReferencedModelRule } from "../rules/model-rules";
import {
  METAMODEL_NODE_TYPES,
  resolveReferencedMetamodelFlow,
} from "../utils/metamodel-reference-resolution";

type PartDefSummary = { id: string; label: string };

type PartDefEdge = {
  id: string;
  edgeType: CustomEdgeData["edgeType"];
  flowType?: CustomEdgeData["flowType"];
  label?: string;
  sourceTypeId: string;
  targetTypeId: string;
};

type MetamodelEdgeLike = Pick<Edge, "id" | "source" | "target" | "data" | "type"> & {
  edgeType?: string | null;
};

export type PartTypeOption = {
  id: string;
  label: string;
  icon?: string;
  color?: string;
};

const getEdgeType = (value: unknown): CustomEdgeData["edgeType"] =>
  isMagicRelationType(value)
    ? value
    : "association";

const DEFAULT_INSTANCE_TYPE_NODES: Node[] = [
  {
    id: "__default_part__",
    type: "partdef",
    position: { x: 0, y: 0 },
    data: { label: "Object", type: "Object", icon: "Box", color: PARTDEF_DEFAULT_ACCENT_COLOR },
  },
  {
    id: "__default_action__",
    type: "actiondef",
    position: { x: 0, y: 0 },
    data: { label: "Behavior", type: "Behavior", icon: "Zap", color: ACTIONDEF_DEFAULT_ACCENT_COLOR },
  },
  {
    id: "__default_concern__",
    type: "concerndef",
    position: { x: 0, y: 0 },
    data: { label: "Concern", type: "Concern", icon: "Shield", color: CONCERNDEF_DEFAULT_ACCENT_COLOR },
  },
  {
    id: "__default_agent__",
    type: "agentdef",
    position: { x: 0, y: 0 },
    data: { label: "Performer", type: "Performer", icon: "Bot", color: AGENTDEF_DEFAULT_ACCENT_COLOR },
  },
  {
    id: "__default_requirement__",
    type: "requirementdef",
    position: { x: 0, y: 0 },
    data: { label: "Requirement", type: "Requirement", icon: "BadgeCheck", color: REQUIREMENTDEF_DEFAULT_ACCENT_COLOR },
  },
  {
    id: "__default_event__",
    type: "eventdef",
    position: { x: 0, y: 0 },
    data: { label: "Event", type: "Event", icon: "Radio", color: EVENTDEF_DEFAULT_ACCENT_COLOR },
  },
  {
    id: "__default_capability__",
    type: "capabilitydef",
    position: { x: 0, y: 0 },
    data: { label: "Capability", type: "Capability", icon: "Gem", color: CAPABILITYDEF_DEFAULT_ACCENT_COLOR },
  },
];

const getDefaultStyleForType = (type: string | undefined) => {
  switch (type) {
    case "actiondef":
      return { icon: "Zap", color: ACTIONDEF_DEFAULT_ACCENT_COLOR };
    case "concerndef":
      return { icon: "Shield", color: CONCERNDEF_DEFAULT_ACCENT_COLOR };
    case "agentdef":
      return { icon: "Bot", color: AGENTDEF_DEFAULT_ACCENT_COLOR };
    case "requirementdef":
      return { icon: "BadgeCheck", color: REQUIREMENTDEF_DEFAULT_ACCENT_COLOR };
    case "eventdef":
      return { icon: "Radio", color: EVENTDEF_DEFAULT_ACCENT_COLOR };
    case "capabilitydef":
      return { icon: "Gem", color: CAPABILITYDEF_DEFAULT_ACCENT_COLOR };
    default:
      return { icon: "Box", color: PARTDEF_DEFAULT_ACCENT_COLOR };
  }
};

export function useMetamodelParts({
  nodes,
  edges,
  projectType,
  referencedMetamodelIds,
  referencedMetamodels,
  selectedNodeId,
}: {
	  nodes: Node[];
	  edges: MetamodelEdgeLike[];
  projectType: ProjectType;
  referencedMetamodelIds: number[];
  referencedMetamodels: Array<{
    id: number;
    name: string;
    metamodelSetup?: MetamodelSetup | null;
  }>;
  selectedNodeId: string | null;
}) {
  const [availablePartDefs, setAvailablePartDefs] = useState<PartDefSummary[]>(
    [],
  );
  const [availablePartDefNodes, setAvailablePartDefNodes] = useState<Node[]>([]);
  const [availablePartDefEdges, setAvailablePartDefEdges] = useState<PartDefEdge[]>(
    [],
  );
  const [referencedModelRules, setReferencedModelRules] = useState<ModelRule[]>([]);
  const [referencedRelationTypes, setReferencedRelationTypes] = useState<
    MagicRelationType[]
  >([]);

  useEffect(() => {
    let cancelled = false;

    const fetchMetamodelNodes = async () => {
      setAvailablePartDefs([]);
      setAvailablePartDefNodes([]);
      setAvailablePartDefEdges([]);
      setReferencedModelRules([]);
      setReferencedRelationTypes([]);

      const defaultPartDefs = DEFAULT_INSTANCE_TYPE_NODES.map((node) => ({
        id: node.id,
        label: (node.data as NodeData | undefined)?.label || node.id,
      }));

      if (referencedMetamodelIds.length === 0) {
        setReferencedModelRules([]);
        setReferencedRelationTypes([]);
        const internalPartDefNodes = nodes.filter(
          (n) => METAMODEL_NODE_TYPES.has(n.type || "") && n.id !== selectedNodeId,
        );
        const partDefNodeIds = new Set(internalPartDefNodes.map((n) => n.id));
        const internalPartDefs = internalPartDefNodes
          .map((n) => ({
            id: n.id,
            label: (n.data as any).label as string | undefined,
          }))
          .filter((def): def is { id: string; label: string } => !!def.label);
        const internalMetaEdges = edges
          .filter(
            (edge) =>
              partDefNodeIds.has(edge.source) &&
              partDefNodeIds.has(edge.target),
          )
          .map((edge) => {
            const data = edge.data as CustomEdgeData | undefined;
            const edgeType = getEdgeType(
              edge.edgeType || edge.type || data?.edgeType,
            );
            return {
              id: edge.id,
              edgeType,
              flowType: data?.flowType as CustomEdgeData["flowType"] | undefined,
              label: data?.label,
              sourceTypeId: edge.source,
              targetTypeId: edge.target,
            };
          });
        const deduped = Array.from(
          new Map(internalPartDefs.map((def) => [def.label, def])).values(),
        );
        const withDefaults =
          projectType === "instance"
            ? [...defaultPartDefs, ...deduped]
            : deduped;
        const nodesWithDefaults =
          projectType === "instance"
            ? [...DEFAULT_INSTANCE_TYPE_NODES, ...internalPartDefNodes]
            : internalPartDefNodes;
        setAvailablePartDefs(withDefaults);
        setAvailablePartDefNodes(nodesWithDefaults);
        setAvailablePartDefEdges(internalMetaEdges);
        return;
      }

      try {
        const metamodelIdsToLoad = new Set<number>();
        const queue = [...referencedMetamodelIds];
        const allRelationTypes: MagicRelationType[] = [];
        while (queue.length > 0) {
          if (cancelled) return;
          const nextId = queue.shift();
          if (!nextId || metamodelIdsToLoad.has(nextId)) continue;
          metamodelIdsToLoad.add(nextId);

          const projectRes = await apiRequest(
            "GET",
            `/api/projects/${nextId}`,
            undefined,
            { allowNotFound: true },
          );
          if (cancelled) return;
          const project = projectRes
            ? await projectRes.json()
            : referencedMetamodels.find((candidate) => candidate.id === nextId);
          if (cancelled) return;
          if (!project) continue;
          const setup = normalizeMetamodelSetup(project.metamodelSetup);
          allRelationTypes.push(...getConfiguredMagicRelationTypes(setup));
          const nestedIds = Array.isArray(project?.referencedMetamodels)
            ? (project.referencedMetamodels as number[])
            : [];
          nestedIds.forEach((id) => {
            if (!metamodelIdsToLoad.has(id)) queue.push(id);
          });
        }

        const allPartDefs: Array<{ id: string; label: string }> = [];
        const allPartDefNodes: Node[] = [];
        const allPartDefEdges: PartDefEdge[] = [];
        const allModelRules: ModelRule[] = [];

        const internalPartDefNodes = nodes.filter(
          (n) => METAMODEL_NODE_TYPES.has(n.type || "") && n.id !== selectedNodeId,
        );
        const partDefNodeIds = new Set(internalPartDefNodes.map((n) => n.id));
        const internalPartDefs = internalPartDefNodes
          .map((n) => ({
            id: n.id,
            label: (n.data as any).label as string | undefined,
          }))
          .filter((def): def is { id: string; label: string } => !!def.label);
        const internalMetaEdges = edges
          .filter(
            (edge) =>
              partDefNodeIds.has(edge.source) &&
              partDefNodeIds.has(edge.target),
          )
          .map((edge) => {
            const data = edge.data as CustomEdgeData | undefined;
            const edgeType = getEdgeType(
              edge.edgeType || edge.type || data?.edgeType,
            );
            return {
              id: edge.id,
              edgeType,
              flowType: data?.flowType as CustomEdgeData["flowType"] | undefined,
              label: data?.label,
              sourceTypeId: edge.source,
              targetTypeId: edge.target,
            };
          });
        allPartDefs.push(...internalPartDefs);
        allPartDefNodes.push(...internalPartDefNodes);
        allPartDefEdges.push(...internalMetaEdges);

        for (const mmId of Array.from(metamodelIdsToLoad)) {
          if (cancelled) return;
          const viewsRes = await apiRequest(
            "GET",
            `/api/projects/${mmId}/views`,
            undefined,
            { allowNotFound: true },
          );
          if (cancelled) return;
          if (!viewsRes) continue;

          const mmViews = await viewsRes.json();
          if (cancelled) return;
          for (const view of mmViews) {
            if (Array.isArray(view.modelRules)) {
              view.modelRules.forEach((candidate: unknown) => {
                const parsed = modelRuleSchema.safeParse(candidate);
                if (parsed.success) allModelRules.push(canonicalizeReferencedModelRule(parsed.data, mmId, view.id));
              });
            }
            const flowRes = await apiRequest(
              "GET",
              `/api/views/${view.id}/flow`,
              undefined,
              { allowNotFound: true },
            );
            if (cancelled) return;
            if (!flowRes) continue;

            const flow = (await flowRes.json()) as {
              nodes?: Parameters<typeof resolveReferencedMetamodelFlow>[0]["nodes"];
              edges?: Parameters<typeof resolveReferencedMetamodelFlow>[0]["edges"];
            };
            if (cancelled) return;
            const resolved = resolveReferencedMetamodelFlow({
              metamodelId: mmId,
              viewId: view.id,
              nodes: flow.nodes ?? [],
              edges: flow.edges ?? [],
            });
            allPartDefs.push(...resolved.partDefs);
            allPartDefNodes.push(...resolved.partDefNodes);
            allPartDefEdges.push(...resolved.partDefEdges);
          }
        }

        const deduped = Array.from(
          new Map(allPartDefs.map((def) => [def.label, def])).values(),
        );
        if (cancelled) return;
        setAvailablePartDefs(deduped);
        setAvailablePartDefNodes(allPartDefNodes);
        setAvailablePartDefEdges(allPartDefEdges);
        setReferencedModelRules(allModelRules);
        setReferencedRelationTypes(Array.from(new Set(allRelationTypes)));
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to fetch metamodel nodes:", err);
        setAvailablePartDefs([]);
        setAvailablePartDefNodes([]);
        setAvailablePartDefEdges([]);
        setReferencedModelRules([]);
        setReferencedRelationTypes([]);
      }
    };

    fetchMetamodelNodes();
    return () => {
      cancelled = true;
    };
  }, [
    nodes,
    referencedMetamodelIds,
    referencedMetamodels,
    projectType,
    selectedNodeId,
    edges,
  ]);

  const partDefStyleById = useMemo(() => {
    return new Map(
      availablePartDefNodes.map((node) => {
        const data = node.data as NodeData | undefined;
        const defaults = getDefaultStyleForType(node.type);
        return [
          node.id,
          {
            icon: data?.icon || defaults.icon,
            color: data?.color || defaults.color,
          },
        ];
      }),
    );
  }, [availablePartDefNodes]);

  const partTypeOptions = useMemo<PartTypeOption[]>(() => {
    const deduped = new Map<string, PartTypeOption>();
    availablePartDefNodes.forEach((node) => {
      const data = node.data as NodeData | undefined;
      const label = data?.label?.trim();
      if (!label) return;
      if (deduped.has(label)) return;
      const defaults = getDefaultStyleForType(node.type);
      deduped.set(label, {
        id: node.id,
        label,
        icon: data?.icon || defaults.icon,
        color: data?.color || defaults.color,
      });
    });
    return Array.from(deduped.values());
  }, [availablePartDefNodes]);

  return {
    availablePartDefs,
    availablePartDefNodes,
    availablePartDefEdges,
    partDefStyleById,
    partTypeOptions,
    referencedModelRules,
    referencedRelationTypes,
  };
}
