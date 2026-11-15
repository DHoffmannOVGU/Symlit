import { useDiagramModel } from "../state/DiagramModelProvider";
import { useDiagramStore } from "../state/DiagramStoreProvider";
import { useCallback, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { emitTutorialSignal } from "@/lib/tutorial-signals";

import type { CustomEdgeData } from "../edges/CustomEdges";
import type {
} from "../types";
import { validateInstanceModel, type ValidationIssue } from "@shared/model-validation";
import type { ModelRule } from "@shared/schema";
import { evaluateModelRules } from "../rules/model-rules";

export type { ValidationIssue };

interface UseDiagramValidationParams {
  modelRules?: ModelRule[];
  inheritedModelRuleIds?: Set<string>;
}

export function useDiagramValidation({
  modelRules = [],
  inheritedModelRuleIds = new Set(),
}: UseDiagramValidationParams) {
  const nodes = useDiagramStore((state) => state.nodes);
  const edges = useDiagramStore((state) => state.edges);
  const setNodes = useDiagramStore((state) => state.setNodes);
  const setEdges = useDiagramStore((state) => state.setEdges);
  const { projectType, availablePartDefNodes, relationEdges, parentMap } = useDiagramModel();
  const [validationOpen, setValidationOpen] = useState(false);
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>(
    [],
  );
  const [highlightIssues, setHighlightIssues] = useState(false);
  const { toast } = useToast();

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

  /**
   * A clean result is a short confirmation that needs no dismissing. Issues
   * open the results panel, which stays open while they are fixed, and are
   * marked on the canvas.
   */
  const showResult = useCallback(
    (issues: ValidationIssue[]) => {
      setValidationIssues(issues);
      emitTutorialSignal("validation-run");
      if (issues.length === 0) {
        emitTutorialSignal("validation-passed");
        setValidationOpen(false);
        setHighlightIssues(false);
        applyIssueHighlights(false, []);
        toast({
          title: "No issues found",
          description:
            projectType === "instance"
              ? "The model follows its metamodels and all model rules."
              : "All model rules pass.",
        });
        return;
      }
      setValidationOpen(true);
      setHighlightIssues(true);
      applyIssueHighlights(true, issues);
    },
    [applyIssueHighlights, projectType, toast],
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
      showResult(issues);
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
      const data = node.data;
      return { id: node.id, label: data?.label || node.id };
    });
    const structuralIssues = validateInstanceModel(
      {
        nodes: nodes.map((node) => ({
          id: node.id,
          type: node.type,
          data: node.data,
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

    showResult(issues);
  }, [
    showResult,
    availablePartDefNodes,
    edges,
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
