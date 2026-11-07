import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import {
  dispatchDiagramEvent,
  subscribeDiagramEvent,
} from "@/lib/diagram-events";

interface UseDiagramLeaveConfirmationArgs {
  viewId: number;
  isDirty: boolean;
  isSaving: boolean;
  setSuspendFlowLoad: (suspended: boolean) => void;
  handleSaveAsync: () => Promise<unknown>;
}

interface UseDiagramLeaveConfirmationResult {
  leaveDialogOpen: boolean;
  isLeaving: boolean;
  handleCancelLeave: () => void;
  handleLeaveWithoutSaving: () => void;
  handleSaveAndLeave: () => Promise<void>;
}

/**
 * Manages the "unsaved changes" confirmation flow for a diagram view:
 *  - Publishes `diagram-dirty-state` / `diagram-save-state` so the rest of
 *    the app can react.
 *  - Intercepts in-app navigation (wouter location changes) and out-of-app
 *    navigation (`beforeunload`) when the diagram is dirty.
 *  - Listens for `diagram-leave-request` events from other parts of the UI.
 *  - Returns dialog state + the three resolution handlers (cancel /
 *    leave-without-saving / save-and-leave).
 */
export function useDiagramLeaveConfirmation({
  viewId,
  isDirty,
  isSaving,
  setSuspendFlowLoad,
  handleSaveAsync,
}: UseDiagramLeaveConfirmationArgs): UseDiagramLeaveConfirmationResult {
  const [location, setLocation] = useLocation();
  const lastLocationRef = useRef(location);
  const pendingLocationRef = useRef<string | null>(null);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  // Browser-level guard.
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // Publish current state.
  useEffect(() => {
    dispatchDiagramEvent("diagram-dirty-state", { viewId, isDirty });
  }, [isDirty, viewId]);

  useEffect(() => {
    dispatchDiagramEvent("diagram-save-state", { viewId, isSaving });
  }, [isSaving, viewId]);

  // External request to leave (e.g. sidebar nav).
  useEffect(
    () =>
      subscribeDiagramEvent("diagram-leave-request", (detail) => {
        if (!detail.href) return;
        if (!isDirty) {
          setLocation(detail.href);
          return;
        }
        pendingLocationRef.current = detail.href;
        setLeaveDialogOpen(true);
        setSuspendFlowLoad(true);
      }),
    [isDirty, setLocation, setSuspendFlowLoad],
  );

  // In-app navigation guard.
  useEffect(() => {
    if (location === lastLocationRef.current) return;
    if (!isDirty) {
      lastLocationRef.current = location;
      return;
    }
    pendingLocationRef.current = location;
    setSuspendFlowLoad(true);
    setLocation(lastLocationRef.current);
    setLeaveDialogOpen(true);
  }, [isDirty, location, setLocation, setSuspendFlowLoad]);

  const handleCancelLeave = useCallback(() => {
    pendingLocationRef.current = null;
    setSuspendFlowLoad(false);
    setLeaveDialogOpen(false);
  }, [setSuspendFlowLoad]);

  const handleLeaveWithoutSaving = useCallback(() => {
    const pending = pendingLocationRef.current;
    pendingLocationRef.current = null;
    setSuspendFlowLoad(false);
    setLeaveDialogOpen(false);
    if (pending) {
      lastLocationRef.current = pending;
      setLocation(pending);
    }
  }, [setLocation, setSuspendFlowLoad]);

  const handleSaveAndLeave = useCallback(async () => {
    const pending = pendingLocationRef.current;
    if (!pending) {
      setLeaveDialogOpen(false);
      return;
    }
    setIsLeaving(true);
    try {
      await handleSaveAsync();
      pendingLocationRef.current = null;
      setSuspendFlowLoad(false);
      setLeaveDialogOpen(false);
      lastLocationRef.current = pending;
      setLocation(pending);
    } catch {
      // Save failure toast is handled in mutation; keep dialog open.
    } finally {
      setIsLeaving(false);
    }
  }, [handleSaveAsync, setLocation, setSuspendFlowLoad]);

  return {
    leaveDialogOpen,
    isLeaving,
    handleCancelLeave,
    handleLeaveWithoutSaving,
    handleSaveAndLeave,
  };
}
