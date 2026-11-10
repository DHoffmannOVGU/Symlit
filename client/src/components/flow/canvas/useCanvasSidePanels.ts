import { useReactFlow } from "@xyflow/react";
import { useDiagramModel } from "../state/DiagramModelProvider";
import { emitTutorialSignal } from "@/lib/tutorial-signals";
import { useCallback, useEffect, useRef, useState } from "react";
import { supportsModelRules } from "../rules/model-rules";
import { getViewportForBottomPanel } from "../utils/rules-panel-viewport";

export interface UseCanvasSidePanelsParams {
  canvasShellRef: React.MutableRefObject<HTMLDivElement | null>;
}

export function useCanvasSidePanels({
  canvasShellRef,
}: UseCanvasSidePanelsParams) {
  const { projectType } = useDiagramModel();
  const { getViewport, setViewport } = useReactFlow();
  const [modelRulesOpen, setModelRulesOpen] = useState(false);
  const [aiAssistantOpen, setAiAssistantOpen] = useState(false);
  const [modelRulesPanelHeight, setPanelHeight] = useState(560);
  // Until the user drags the panel's edge, it opens at half the canvas, so the
  // diagram stays readable above it on small screens.
  const userResizedPanel = useRef(false);
  const setModelRulesPanelHeight = useCallback((height: number) => {
    userResizedPanel.current = true;
    setPanelHeight(height);
  }, []);
  const rulesViewportBaselineRef = useRef<{
    viewport: { x: number; y: number; zoom: number };
    width: number;
    height: number;
  } | null>(null);
  const modelRulesPanelVisible = modelRulesOpen && supportsModelRules(projectType);

  const openModelRules = useCallback(() => {
    emitTutorialSignal("rules-opened");
    if (!rulesViewportBaselineRef.current) {
      const bounds = canvasShellRef.current?.getBoundingClientRect();
      rulesViewportBaselineRef.current = {
        viewport: getViewport(),
        width: bounds?.width ?? window.innerWidth,
        height: bounds?.height ?? window.innerHeight,
      };
      if (!userResizedPanel.current) {
        const canvasHeight = bounds?.height ?? window.innerHeight;
        setPanelHeight(Math.round(Math.max(280, Math.min(560, canvasHeight * 0.5))));
      }
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
