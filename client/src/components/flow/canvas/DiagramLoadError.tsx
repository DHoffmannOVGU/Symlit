import { useCallback, useState } from "react";
import { useQuery, type QueryObserverResult } from "@tanstack/react-query";
import { api, type FlowRecoveryResponse } from "@shared/routes";
import type { FlowEdgeInput, SyncFlowNodeInput } from "@shared/flow-inputs";
import { apiCall } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { DiagramRecoveryDialog } from "../dialogs/DiagramRecoveryDialog";

export interface DiagramLoadErrorProps {
  viewId: number;
  reloadDiagram: () => Promise<QueryObserverResult<unknown, unknown>>;
  isSaving: boolean;
  /** Stops the canvas from reloading the diagram while it is being repaired. */
  setSuspendFlowLoad: (suspended: boolean) => void;
  saveRecovered: (nodes: SyncFlowNodeInput[], edges: FlowEdgeInput[]) => Promise<unknown>;
}

/** Shown when a saved diagram is invalid; offers to retry or to repair it. */
export function DiagramLoadError({
  viewId,
  reloadDiagram,
  isSaving,
  setSuspendFlowLoad,
  saveRecovered,
}: DiagramLoadErrorProps) {
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const recoveryQuery = useQuery<FlowRecoveryResponse>({
    queryKey: [api.flow.recovery.path, viewId],
    queryFn: () => apiCall(api.flow.recovery, { params: { viewId } }),
    enabled: false,
  });

  const openRecovery = useCallback(() => {
    setSuspendFlowLoad(true);
    setRecoveryOpen(true);
    void recoveryQuery.refetch();
  }, [recoveryQuery, setSuspendFlowLoad]);

  const saveRepaired = useCallback(
    async (repairedNodes: SyncFlowNodeInput[], repairedEdges: FlowEdgeInput[]) => {
      await saveRecovered(repairedNodes, repairedEdges);
      const result = await reloadDiagram();
      if (result.error) throw result.error;
      setRecoveryOpen(false);
      setSuspendFlowLoad(false);
    },
    [reloadDiagram, saveRecovered, setSuspendFlowLoad],
  );

  return (
    <>
      <div className="flex-1 flex items-center justify-center h-full">
        <div className="flex max-w-md flex-col items-center gap-3 px-6 text-center">
          <p className="font-medium text-destructive">This diagram could not be loaded safely.</p>
          <p className="text-sm text-muted-foreground">
            The saved diagram contains invalid positions or relationship endpoints. Your saved data was not changed.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="outline" onClick={() => void reloadDiagram()} data-testid="button-reload-diagram">
              Try again
            </Button>
            <Button onClick={openRecovery} data-testid="button-repair-diagram">
              Repair saved diagram
            </Button>
          </div>
        </div>
      </div>
      <DiagramRecoveryDialog
        open={recoveryOpen}
        flow={recoveryQuery.data}
        isLoading={recoveryQuery.isFetching}
        error={recoveryQuery.error instanceof Error ? recoveryQuery.error : null}
        isSaving={isSaving}
        onOpenChange={(open) => {
          setRecoveryOpen(open);
          if (!open) setSuspendFlowLoad(false);
        }}
        onRetry={() => void recoveryQuery.refetch()}
        onSave={saveRepaired}
      />
    </>
  );
}
