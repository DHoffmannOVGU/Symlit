import type { UseQueryResult } from "@tanstack/react-query";
import type { FlowRecoveryResponse } from "@shared/routes";
import { Button } from "@/components/ui/button";
import { DiagramRecoveryDialog } from "../dialogs/DiagramRecoveryDialog";
import type { FlowEdgeInput, SyncFlowNodeInput } from "@shared/flow-inputs";

export interface DiagramLoadErrorProps {
  reloadDiagram: () => Promise<unknown>;
  openRecovery: () => void;
  recoveryOpen: boolean;
  recoveryQuery: UseQueryResult<FlowRecoveryResponse>;
  isSaving: boolean;
  setRecoveryOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setSuspendFlowLoad: React.Dispatch<React.SetStateAction<boolean>>;
  handleRecoverySave: (repairedNodes: SyncFlowNodeInput[], repairedEdges: FlowEdgeInput[]) => Promise<void>;
}

export function DiagramLoadError({
  reloadDiagram,
  openRecovery,
  recoveryOpen,
  recoveryQuery,
  isSaving,
  setRecoveryOpen,
  setSuspendFlowLoad,
  handleRecoverySave,
}: DiagramLoadErrorProps) {
  return (
    <>
            <div className="flex-1 flex items-center justify-center h-full">
              <div className="flex max-w-md flex-col items-center gap-3 px-6 text-center">
                <p className="font-medium text-destructive">
                  This diagram could not be loaded safely.
                </p>
                <p className="text-sm text-muted-foreground">
                  The saved diagram contains invalid positions or relationship
                  endpoints. Your saved data was not changed.
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => void reloadDiagram()}
                    data-testid="button-reload-diagram"
                  >
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
              error={
                recoveryQuery.error instanceof Error ? recoveryQuery.error : null
              }
              isSaving={isSaving}
              onOpenChange={(open) => {
                setRecoveryOpen(open);
                if (!open) setSuspendFlowLoad(false);
              }}
              onRetry={() => void recoveryQuery.refetch()}
              onSave={handleRecoverySave}
            />
          </>
  );
}
