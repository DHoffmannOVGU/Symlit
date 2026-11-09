import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Trash2 } from "lucide-react";
import { flowSyncInputSchema, type FlowRecoveryResponse } from "@shared/routes";
import type { FlowEdgeInput, SyncFlowNodeInput } from "@shared/flow-inputs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type DraftNode = Omit<FlowRecoveryResponse["nodes"][number], "position"> & {
  position: { x: string; y: string };
};
type DraftEdge = FlowRecoveryResponse["edges"][number];
type RecoveryDraft = { nodes: DraftNode[]; edges: DraftEdge[] };

const EMPTY_ENDPOINT = "__recovery_empty_endpoint__";

const coordinateValue = (position: unknown, axis: "x" | "y") => {
  if (
    typeof position === "object" &&
    position !== null &&
    !Array.isArray(position) &&
    typeof (position as Record<string, unknown>)[axis] === "number"
  ) {
    return String((position as Record<string, number>)[axis]);
  }
  return "";
};

const toDraft = (flow: FlowRecoveryResponse): RecoveryDraft => ({
  nodes: flow.nodes.map((node) => ({
    ...node,
    position: {
      x: coordinateValue(node.position, "x"),
      y: coordinateValue(node.position, "y"),
    },
  })),
  edges: flow.edges.map((edge) => ({ ...edge })),
});

const issueKey = (type: "node" | "edge", id: string) => `${type}:${id}`;

const getValidationMessage = (draft: RecoveryDraft) => {
  const nodes = draft.nodes.map((node) => ({
    id: node.id,
    type: node.type,
    position: {
      x: node.position.x.trim() === "" ? Number.NaN : Number(node.position.x),
      y: node.position.y.trim() === "" ? Number.NaN : Number(node.position.y),
    },
    data: node.data,
    parentId: node.parentId ?? null,
  }));
  const edges = draft.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    edgeType: edge.edgeType,
    sourceHandle: edge.sourceHandle ?? null,
    targetHandle: edge.targetHandle ?? null,
    data: edge.data ?? null,
  }));
  const result = flowSyncInputSchema.safeParse({ nodes, edges });
  return result.success
    ? { nodes: nodes as SyncFlowNodeInput[], edges: edges as FlowEdgeInput[], message: null }
    : {
        nodes: nodes as SyncFlowNodeInput[],
        edges: edges as FlowEdgeInput[],
        message: result.error.issues[0]?.message ?? "The repaired diagram is still invalid.",
      };
};

export interface DiagramRecoveryDialogProps {
  open: boolean;
  flow: FlowRecoveryResponse | undefined;
  isLoading: boolean;
  error: Error | null;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onRetry: () => void;
  onSave: (nodes: SyncFlowNodeInput[], edges: FlowEdgeInput[]) => Promise<void>;
}

export function DiagramRecoveryDialog({
  open,
  flow,
  isLoading,
  error,
  isSaving,
  onOpenChange,
  onRetry,
  onSave,
}: DiagramRecoveryDialogProps) {
  const [draft, setDraft] = useState<RecoveryDraft | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (flow) {
      setDraft(toDraft(flow));
      setSaveError(null);
    }
  }, [flow]);

  const validation = useMemo(
    () => (draft ? getValidationMessage(draft) : null),
    [draft],
  );
  const initialIssues = useMemo(() => flow?.issues ?? [], [flow?.issues]);
  const issueKeys = useMemo(
    () => new Set(initialIssues.map((issue) => issueKey(issue.type, issue.id))),
    [initialIssues],
  );

  const updateNode = (
    nodeId: string,
    update: Partial<DraftNode>,
  ) => {
    setDraft((current) =>
      current
        ? {
            ...current,
            nodes: current.nodes.map((node) =>
              node.id === nodeId ? { ...node, ...update } : node,
            ),
          }
        : current,
    );
  };

  const removeNode = (nodeId: string) => {
    setDraft((current) =>
      current
        ? {
            nodes: current.nodes.filter((node) => node.id !== nodeId),
            edges: current.edges.filter(
              (edge) => edge.source !== nodeId && edge.target !== nodeId,
            ),
          }
        : current,
    );
  };

  const updateEdge = (
    edgeId: string,
    update: Partial<DraftEdge>,
  ) => {
    setDraft((current) =>
      current
        ? {
            ...current,
            edges: current.edges.map((edge) =>
              edge.id === edgeId ? { ...edge, ...update } : edge,
            ),
          }
        : current,
    );
  };

  const removeEdge = (edgeId: string) => {
    setDraft((current) =>
      current
        ? { ...current, edges: current.edges.filter((edge) => edge.id !== edgeId) }
        : current,
    );
  };

  const handleSave = async () => {
    if (!validation || validation.message) return;
    setSaveError(null);
    try {
      await onSave(validation.nodes, validation.edges);
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "The repaired diagram could not be saved. No changes were written.",
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>Repair saved diagram</DialogTitle>
          <DialogDescription>
            The canvas is still untouched. Remove corrupted records or repair
            their positions and relationship endpoints below. Nothing is saved
            until all geometry and endpoint checks pass.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Inspecting saved records…
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Recovery data could not be loaded</AlertTitle>
            <AlertDescription className="mt-2 flex items-center justify-between gap-4">
              <span>{error.message || "Please try again."}</span>
              <Button variant="outline" size="sm" onClick={onRetry}>
                Try again
              </Button>
            </AlertDescription>
          </Alert>
        ) : draft ? (
          <>
            <ScrollArea className="min-h-0 flex-1 pr-4">
              <div className="space-y-5">
                {initialIssues.length > 0 ? (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>
                      {initialIssues.length} structural issue
                      {initialIssues.length === 1 ? "" : "s"} found
                    </AlertTitle>
                    <AlertDescription className="mt-2 space-y-1">
                      {initialIssues.map((issue, index) => (
                        <div key={`${issue.type}-${issue.id}-${issue.index}-${index}`}>
                          <strong>
                            {issue.type === "node" ? "Node" : "Relationship"}{" "}
                            {issue.id}
                          </strong>{" "}
                          · {issue.field}: {issue.message}
                        </div>
                      ))}
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertTitle>No structural issues found</AlertTitle>
                    <AlertDescription>
                      You can still review the records before saving.
                    </AlertDescription>
                  </Alert>
                )}

                <section className="space-y-3">
                  <div>
                    <h3 className="font-medium">Nodes ({draft.nodes.length})</h3>
                    <p className="text-sm text-muted-foreground">
                      Repair invalid coordinates or remove an element and its relationships.
                    </p>
                  </div>
                  {draft.nodes.length === 0 ? (
                    <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                      No elements remain. Add at least one element or remove all relationships before saving.
                    </p>
                  ) : (
                    draft.nodes.map((node) => {
                      const hasIssue = issueKeys.has(issueKey("node", node.id));
                      return (
                        <div
                          key={node.id}
                          className={cn(
                            "rounded-md border p-3",
                            hasIssue && "border-destructive/60 bg-destructive/5",
                          )}
                        >
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate font-medium">{node.id}</div>
                              <div className="text-xs text-muted-foreground">{node.type}</div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeNode(node.id)}
                              aria-label={`Remove node ${node.id}`}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Remove
                            </Button>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            {(["x", "y"] as const).map((axis) => (
                              <div key={axis} className="space-y-1">
                                <Label htmlFor={`recovery-${node.id}-${axis}`}>
                                  Position {axis}
                                </Label>
                                <Input
                                  id={`recovery-${node.id}-${axis}`}
                                  inputMode="decimal"
                                  value={node.position[axis]}
                                  onChange={(event) =>
                                    updateNode(node.id, {
                                      position: {
                                        ...node.position,
                                        [axis]: event.target.value,
                                      },
                                    })
                                  }
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })
                  )}
                </section>

                <section className="space-y-3">
                  <div>
                    <h3 className="font-medium">
                      Relationships ({draft.edges.length})
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Choose valid source and target nodes, or remove a relationship.
                    </p>
                  </div>
                  {draft.edges.length === 0 ? (
                    <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                      No relationships remain.
                    </p>
                  ) : (
                    draft.edges.map((edge) => {
                      const hasIssue = issueKeys.has(issueKey("edge", edge.id));
                      return (
                        <div
                          key={edge.id}
                          className={cn(
                            "rounded-md border p-3",
                            hasIssue && "border-destructive/60 bg-destructive/5",
                          )}
                        >
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate font-medium">{edge.id}</div>
                              <div className="text-xs text-muted-foreground">
                                {edge.edgeType}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeEdge(edge.id)}
                              aria-label={`Remove relationship ${edge.id}`}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Remove
                            </Button>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            {(["source", "target"] as const).map((endpoint) => {
                              const selected = edge[endpoint];
                              return (
                                <div key={endpoint} className="space-y-1">
                                  <Label>{endpoint === "source" ? "Source" : "Target"}</Label>
                                  <Select
                                    value={selected || EMPTY_ENDPOINT}
                                    onValueChange={(value) =>
                                      updateEdge(edge.id, {
                                        [endpoint]:
                                          value === EMPTY_ENDPOINT ? "" : value,
                                      })
                                    }
                                  >
                                    <SelectTrigger
                                      data-testid={`recovery-${edge.id}-${endpoint}-select`}
                                    >
                                      <SelectValue placeholder={`Choose ${endpoint}`} />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value={EMPTY_ENDPOINT}>
                                        Choose {endpoint}
                                      </SelectItem>
                                      {draft.nodes.map((node) => (
                                        <SelectItem key={node.id} value={node.id}>
                                          {node.id}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })
                  )}
                </section>

                {validation?.message ? (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>More repairs are needed</AlertTitle>
                    <AlertDescription>{validation.message}</AlertDescription>
                  </Alert>
                ) : null}
                {saveError ? (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Save failed</AlertTitle>
                    <AlertDescription>{saveError}</AlertDescription>
                  </Alert>
                ) : null}
              </div>
            </ScrollArea>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => void handleSave()}
                disabled={!validation || !!validation.message || isSaving}
              >
                {isSaving ? "Saving…" : "Save repaired diagram"}
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}