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
  /** Save the diagram automatically a moment after each change. Off unless switched on. */
  autoSave: boolean;
  setAutoSave: Dispatch<SetStateAction<boolean>>;
};

/** Whether new browsers start with automatic saving. One place to change the default. */
export const AUTO_SAVE_DEFAULT = false;
const AUTO_SAVE_KEY = "symlit.canvas.autoSave";

// Unlike the view options above, this is remembered across tabs and restarts.
const readAutoSave = () => {
  try {
    const stored = window.localStorage.getItem(AUTO_SAVE_KEY);
    return stored === null ? AUTO_SAVE_DEFAULT : stored === "true";
  } catch {
    return AUTO_SAVE_DEFAULT;
  }
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

  const [autoSave, setAutoSave] = useState<boolean>(() =>
    typeof window === "undefined" ? AUTO_SAVE_DEFAULT : readAutoSave(),
  );
  useEffect(() => {
    try {
      window.localStorage.setItem(AUTO_SAVE_KEY, String(autoSave));
    } catch {
      // Storage unavailable (private window): the setting lasts for this page only.
    }
  }, [autoSave]);

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
    autoSave,
    setAutoSave,
  };
}
