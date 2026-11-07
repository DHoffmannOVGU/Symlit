import { useCallback, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Node } from "@xyflow/react";

import type { CustomEdgeData } from "../edges/CustomEdges";
import type {
  DiagramEdge,
  DiagramNode,
  NodeData,
} from "../types";
import { validateInstanceModel, type ValidationIssue } from "@shared/model-validation";
import type { ModelRule, ProjectType } from "@shared/schema";
import { evaluateModelRules } from "../rules/model-rules";

export type { ValidationIssue };

interface RelationEdge {
  sourceTypeId?: string;
  targetTypeId?: string;
  edgeType?: string;
  label?: string;
}

interface UseDiagramValidationParams {
  projectType: ProjectType;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  availablePartDefNodes: Node[];
  relationEdges: RelationEdge[];
  parentMap: Map<string, Set<string>>;
  setNodes: Dispatch<SetStateAction<DiagramNode[]>>;
  setEdges: Dispatch<SetStateAction<DiagramEdge[]>>;
  modelRules?: ModelRule[];
  inheritedModelRuleIds?: Set<string>;
}

export function useDiagramValidation({
  projectType,
  nodes,
  edges,
  availablePartDefNodes,
  relationEdges,
  parentMap,
  setNodes,
  setEdges,
  modelRules = [],
  inheritedModelRuleIds = new Set(),
}: UseDiagramValidationParams) {
  const [validationOpen, setValidationOpen] = useState(false);
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>(
    [],
  );
  const [highlightIssues, setHighlightIssues] = useState(false);

  const applyIssueHighlights = useCallback(
    (enable: boolean, issues = validationIssues) => {
      const issueNodeIds = new Set(
        issues
          .filter((issue) => issue.type === "node")
          .map((issue) => issue.id),
      );
      const issueEdgeIds = new Set(
        issues
          .filter((issue) => issue.type === "edge")
          .map((issue) => issue.id),
      );

      setNodes((current) =>
        current.map((node) => {
          const base =
            node.className?.replace(/\bvalidation-issue\b/g, "").trim() || "";
          if (enable && issueNodeIds.has(node.id)) {
            return { ...node, className: `${base} validation-issue`.trim() };
          }
          return { ...node, className: base || undefined };
        }),
      );

      setEdges((current) =>
        current.map((edge) => {
          const base =
            edge.className?.replace(/\bvalidation-issue\b/g, "").trim() || "";
          if (enable && issueEdgeIds.has(edge.id)) {
            return { ...edge, className: `${base} validation-issue`.trim() };
          }
          return { ...edge, className: base || undefined };
        }),
      );
    },
    [setEdges, setNodes, validationIssues],
  );

  const handleValidate = useCallback(() => {
    if (projectType === "metamodel") {
      const issues: ValidationIssue[] = evaluateModelRules(modelRules, nodes, edges).map(
        (violation) => ({
          type: "node",
          id: violation.nodeId,
          message: `${violation.ruleName}: ${violation.message}`,
        }),
      );
      setValidationIssues(issues);
      setValidationOpen(true);
      if (highlightIssues) applyIssueHighlights(true, issues);
      return;
    }

    if (projectType !== "instance") return;

    const issues: ValidationIssue[] = evaluateModelRules(modelRules, nodes, edges).map(
      (violation) => ({
        type: "node",
        id: violation.nodeId,
        message: `${inheritedModelRuleIds.has(violation.ruleId) ? "Meta rule" : "Instance rule"} · ${violation.ruleName}: ${violation.message}`,
      }),
    );
    const typeNodes = availablePartDefNodes.map((node) => {
      const data = node.data as unknown as NodeData | undefined;
      return { id: node.id, label: data?.label || node.id };
    });
    const structuralIssues = validateInstanceModel(
      {
        nodes: nodes.map((node) => ({
          id: node.id,
          type: node.type,
          data: node.data as unknown as NodeData | undefined,
        })),
        edges: edges.map((edge) => {
          const edgeData = edge.data as CustomEdgeData | undefined;
          return {
            id: edge.id,
            source: edge.source,
            target: edge.target,
            edgeType:
              (edge.type as CustomEdgeData["edgeType"] | undefined) ||
              edgeData?.edgeType,
            data: edgeData,
          };
        }),
      },
      { typeNodes, relationEdges, parentMap },
    );
    issues.push(...structuralIssues);

    setValidationIssues(issues);
    setValidationOpen(true);
    if (highlightIssues) {
      applyIssueHighlights(true, issues);
    }
  }, [
    applyIssueHighlights,
    availablePartDefNodes,
    edges,
    highlightIssues,
    nodes,
    parentMap,
    projectType,
    modelRules,
    inheritedModelRuleIds,
    relationEdges,
  ]);

  return {
    applyIssueHighlights,
    handleValidate,
    highlightIssues,
    setHighlightIssues,
    validationIssues,
    validationOpen,
    setValidationOpen,
  };
}
