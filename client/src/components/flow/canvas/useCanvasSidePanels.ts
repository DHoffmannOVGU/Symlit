import type { ReactFlowInstance, SetViewport } from "@xyflow/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { supportsModelRules } from "../rules/model-rules";
import { getViewportForBottomPanel } from "../utils/rules-panel-viewport";

export interface UseCanvasSidePanelsParams {
  projectType: "metamodel" | "instance" | "method";
  canvasShellRef: React.MutableRefObject<HTMLDivElement | null>;
  getViewport: ReactFlowInstance["getViewport"];
  setViewport: SetViewport;
}

export function useCanvasSidePanels({
  projectType,
  canvasShellRef,
  getViewport,
  setViewport,
}: UseCanvasSidePanelsParams) {
  const [modelRulesOpen, setModelRulesOpen] = useState(false);
  const [aiAssistantOpen, setAiAssistantOpen] = useState(false);
  const [modelRulesPanelHeight, setModelRulesPanelHeight] = useState(560);
  const rulesViewportBaselineRef = useRef<{
    viewport: { x: number; y: number; zoom: number };
    width: number;
    height: number;
  } | null>(null);
  const modelRulesPanelVisible = modelRulesOpen && supportsModelRules(projectType);

  const openModelRules = useCallback(() => {
    if (!rulesViewportBaselineRef.current) {
      const bounds = canvasShellRef.current?.getBoundingClientRect();
      rulesViewportBaselineRef.current = {
        viewport: getViewport(),
        width: bounds?.width ?? window.innerWidth,
        height: bounds?.height ?? window.innerHeight,
      };
    }
    setModelRulesOpen(true);
  }, [canvasShellRef, getViewport]);

  const closeModelRules = useCallback(() => {
    const baseline = rulesViewportBaselineRef.current;
    rulesViewportBaselineRef.current = null;
    setModelRulesOpen(false);
    if (baseline) {
      window.requestAnimationFrame(() => {
        void setViewport(baseline.viewport, { duration: 150 });
      });
    }
  }, [setViewport]);

  const toggleModelRules = useCallback(() => {
    if (modelRulesOpen) closeModelRules();
    else {
      setAiAssistantOpen(false);
      openModelRules();
    }
  }, [closeModelRules, modelRulesOpen, openModelRules]);

  const toggleAiAssistant = useCallback(() => {
    if (!aiAssistantOpen && modelRulesOpen) closeModelRules();
    setAiAssistantOpen((open) => !open);
  }, [aiAssistantOpen, closeModelRules, modelRulesOpen]);

  useEffect(() => {
    if (!modelRulesPanelVisible) return;
    const baseline = rulesViewportBaselineRef.current;
    if (!baseline || baseline.height <= 0) return;
    const nextViewport = getViewportForBottomPanel(
      baseline.viewport,
      baseline.width,
      baseline.height,
      modelRulesPanelHeight,
    );
    const frame = window.requestAnimationFrame(() => {
      void setViewport(nextViewport);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [modelRulesPanelHeight, modelRulesPanelVisible, setViewport]);

  return {
    toggleModelRules,
    toggleAiAssistant,
    modelRulesPanelVisible,
    modelRulesPanelHeight,
    aiAssistantOpen,
    setAiAssistantOpen,
    closeModelRules,
    setModelRulesPanelHeight,
  };
}
