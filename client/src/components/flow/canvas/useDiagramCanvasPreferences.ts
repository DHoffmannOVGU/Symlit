import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

export type DiagramCanvasPreferences = {
  snapNodesEnabled: boolean;
  setSnapEnabled: Dispatch<SetStateAction<boolean>>;
  showBackgroundDots: boolean;
  setShowBackgroundDots: Dispatch<SetStateAction<boolean>>;
  alwaysShowAccent: boolean;
  setAlwaysShowAccent: Dispatch<SetStateAction<boolean>>;
  showNodeDescriptions: boolean;
  setShowNodeDescriptions: Dispatch<SetStateAction<boolean>>;
};

const readBooleanSessionValue = (key: string, fallback: boolean) => {
  if (typeof window === "undefined") return fallback;
  const stored = window.sessionStorage.getItem(key);
  if (stored === null) return fallback;
  return stored === "true";
};

export function useDiagramCanvasPreferences(): DiagramCanvasPreferences {
  const [snapNodesEnabled, setSnapEnabled] = useState<boolean>(() =>
    readBooleanSessionValue("flow.canvas.snapNodesEnabled", true),
  );
  const [showBackgroundDots, setShowBackgroundDots] = useState<boolean>(() =>
    readBooleanSessionValue("flow.canvas.showBackgroundDots", true),
  );
  const [alwaysShowAccent, setAlwaysShowAccent] = useState<boolean>(() =>
    readBooleanSessionValue("flow.canvas.alwaysShowAccent", false),
  );
  const [showNodeDescriptions, setShowNodeDescriptions] = useState<boolean>(
    () => readBooleanSessionValue("flow.canvas.showNodeDescriptions", false),
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(
      "flow.canvas.snapNodesEnabled",
      String(snapNodesEnabled),
    );
  }, [snapNodesEnabled]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(
      "flow.canvas.showBackgroundDots",
      String(showBackgroundDots),
    );
  }, [showBackgroundDots]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(
      "flow.canvas.alwaysShowAccent",
      String(alwaysShowAccent),
    );
  }, [alwaysShowAccent]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(
      "flow.canvas.showNodeDescriptions",
      String(showNodeDescriptions),
    );
  }, [showNodeDescriptions]);

  return {
    snapNodesEnabled,
    setSnapEnabled,
    showBackgroundDots,
    setShowBackgroundDots,
    alwaysShowAccent,
    setAlwaysShowAccent,
    showNodeDescriptions,
    setShowNodeDescriptions,
  };
}
