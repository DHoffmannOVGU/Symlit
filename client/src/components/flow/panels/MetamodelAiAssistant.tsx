import { useDiagramStore } from "../state/DiagramStoreProvider";
import { useDiagramModel } from "../state/DiagramModelProvider";
import { useMemo, useState } from "react";
import type {
  AiMetamodelNodeKind,
  AiMetamodelProposal,
} from "@shared/ai-metamodel";
import {
  getConfiguredMagicNodeTypes,
  getConfiguredMagicRelationTypes,
} from "@shared/metamodel-setup";
import type {
  CustomEdgeData,
  DiagramNode,
  NodeData,
} from "../types";
import { api } from "@shared/routes";
import { apiCall } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertTriangle,
  Bot,
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Layers3,
  Link2,
  Loader2,
  Plus,
  Send,
  Sparkles,
  User,
  X,
} from "lucide-react";
import {
  filterAiMetamodelProposal,
  reviewAiMetamodelProposal,
  type AiMetamodelProposalReview,
  type AiProposalReviewStatus,
} from "../utils/ai-metamodel-review";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  contextContent?: string;
  proposal?: AiMetamodelProposal;
  review?: AiMetamodelProposalReview;
  selectedNodeIds?: string[];
  selectedEdgeIndexes?: number[];
  applied?: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onApply: (proposal: AiMetamodelProposal) => void;
};

const suggestions = [
  "Create a small smart-home metamodel with devices, rooms, sensors, and safety concerns.",
  "Model an order fulfillment domain with actors, behaviors, events, and requirements.",
];

const nodeKindByType: Record<string, AiMetamodelNodeKind> = {
  partdef: "object",
  actiondef: "behavior",
  concerndef: "concern",
  agentdef: "performer",
  requirementdef: "requirement",
  eventdef: "event",
  capabilitydef: "capability",
};

const nodeKindByLabel: Record<string, AiMetamodelNodeKind> = {
  object: "object",
  behavior: "behavior",
  concern: "concern",
  performer: "performer",
  requirement: "requirement",
  event: "event",
  capability: "capability",
};

const kindForNode = (node: DiagramNode) => {
  const data = node.data as NodeData | undefined;
  return (
    nodeKindByType[node.type ?? ""] ??
    nodeKindByLabel[(data?.type ?? "").toLocaleLowerCase()] ??
    "object"
  );
};

const kindForConfiguredType: Record<string, AiMetamodelNodeKind> = {
  partdef: "object",
  actiondef: "behavior",
  concerndef: "concern",
  agentdef: "performer",
  requirementdef: "requirement",
  eventdef: "event",
  capabilitydef: "capability",
};

const statusLabel: Record<AiProposalReviewStatus, string> = {
  new: "New",
  overlap: "Overlap",
  invalid: "Needs attention",
};

function ReviewBadge({ status }: { status: AiProposalReviewStatus }) {
  return (
    <Badge
      variant={status === "new" ? "secondary" : "outline"}
      className={
        status === "invalid"
          ? "border-destructive/40 text-destructive"
          : status === "overlap"
            ? "border-amber-500/40 text-amber-700 dark:text-amber-300"
            : ""
      }
    >
      {statusLabel[status]}
    </Badge>
  );
}

function WarningList({ warnings }: { warnings: string[] }) {
  if (!warnings.length) return null;
  return (
    <div className="space-y-1 rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-[11px] text-amber-800 dark:text-amber-200">
      {warnings.slice(0, 8).map((warning, index) => (
        <div className="flex gap-1.5" key={`${warning}-${index}`}>
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          <span>{warning}</span>
        </div>
      ))}
      {warnings.length > 8 ? (
        <p className="pl-4 text-[10px] opacity-80">
          {warnings.length - 8} more warning{warnings.length - 8 === 1 ? "" : "s"}.
        </p>
      ) : null}
    </div>
  );
}

export function MetamodelAiAssistant({
  open,
  onClose,
  onApply,
}: Props) {
  const { projectId, viewId, metamodelSetup } = useDiagramModel();
  const nodes = useDiagramStore((state) => state.nodes);
  const edges = useDiagramStore((state) => state.edges);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(
    new Set(),
  );

  const allowedNodeKinds = useMemo(
    () =>
      getConfiguredMagicNodeTypes(metamodelSetup)
        .map((type) => kindForConfiguredType[type])
        .filter((kind): kind is AiMetamodelNodeKind => Boolean(kind)),
    [metamodelSetup],
  );
  const allowedRelationTypes = useMemo(
    () => getConfiguredMagicRelationTypes(metamodelSetup),
    [metamodelSetup],
  );

  const currentModel = useMemo(
    () => ({
      nodes: nodes.map((node) => {
        const data = node.data as NodeData | undefined;
        return {
          id: node.id,
          name: data?.label ?? node.id,
          kind: kindForNode(node),
          description: data?.description ?? "",
          attributes: (data?.attributes ?? []).map((attribute) => ({
            name: attribute.name,
            type: attribute.type,
            unit: attribute.unit,
          })),
        };
      }),
      edges: edges.map((edge) => {
        const data = edge.data as CustomEdgeData | undefined;
        return {
          source: edge.source,
          target: edge.target,
          relation: data?.edgeType ?? edge.type ?? "association",
          label: data?.label ?? "",
        };
      }),
    }),
    [edges, nodes],
  );

  const submit = async (text = prompt) => {
    const nextPrompt = text.trim();
    if (!nextPrompt || isLoading) return;
    const userMessage: ChatMessage = {
      id: `user_${Date.now()}`,
      role: "user",
      content: nextPrompt,
    };
    const conversation = [...messages, userMessage]
      .slice(-12)
      .map(({ role, content, contextContent }) => ({
        role,
        content: (contextContent ?? content).slice(0, 1900),
      }));
    setMessages((current) => [...current, userMessage]);
    setPrompt("");
    setError(null);
    setIsLoading(true);
    try {
      const proposal = await apiCall(api.ai.proposeMetamodel, {
        params: { projectId, viewId },
        body: {
          prompt: nextPrompt,
          messages: conversation,
          currentModel,
          allowedNodeKinds,
          allowedRelationTypes,
        },
      });
      const review = reviewAiMetamodelProposal(
        proposal,
        currentModel,
        allowedNodeKinds,
        allowedRelationTypes,
      );
      const assistantMessage: ChatMessage = {
        id: `assistant_${Date.now()}`,
        role: "assistant",
        content: proposal.summary,
        contextContent: [
          proposal.summary,
          proposal.nodes.length
            ? `Proposed elements: ${proposal.nodes
                .map((node) => `${node.name} (${node.kind})`)
                .join(", ")}`
            : "Proposed elements: none",
          proposal.edges.length
            ? `Proposed relationships: ${proposal.edges
                .map((edge) => `${edge.source} ${edge.relation} ${edge.target}`)
                .join(", ")}`
            : "Proposed relationships: none",
        ]
          .join("\n")
          .slice(0, 1900),
        proposal,
        review,
        selectedNodeIds: review.defaultSelectedNodeIds,
        selectedEdgeIndexes: review.defaultSelectedEdgeIndexes,
      };
      setMessages((current) => [...current, assistantMessage]);
      setExpandedMessages((current) => new Set(current).add(assistantMessage.id));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The AI assistant could not create a proposal.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const toggleNode = (messageId: string, nodeId: string, checked: boolean) => {
    setMessages((current) =>
      current.map((message) => {
        if (message.id !== messageId) return message;
        const selected = new Set(message.selectedNodeIds ?? []);
        if (checked) selected.add(nodeId);
        else selected.delete(nodeId);
        return { ...message, selectedNodeIds: Array.from(selected) };
      }),
    );
  };

  const toggleEdge = (
    messageId: string,
    edgeIndex: number,
    checked: boolean,
  ) => {
    setMessages((current) =>
      current.map((message) => {
        if (message.id !== messageId) return message;
        const selected = new Set(message.selectedEdgeIndexes ?? []);
        if (checked) selected.add(edgeIndex);
        else selected.delete(edgeIndex);
        return { ...message, selectedEdgeIndexes: Array.from(selected) };
      }),
    );
  };

  const applyProposal = (message: ChatMessage) => {
    if (!message.proposal || message.applied) return;
    const selectedNodeIds = new Set(message.selectedNodeIds ?? []);
    const selectedEdgeIndexes = new Set(message.selectedEdgeIndexes ?? []);
    const selected = filterAiMetamodelProposal(
      message.proposal,
      currentModel,
      selectedNodeIds,
      selectedEdgeIndexes,
    );
    if (!selected.nodes.length && !selected.edges.length) {
      setError("Select at least one valid element or relationship before applying.");
      return;
    }
    onApply(selected);
    setError(null);
    setMessages((current) =>
      current.map((item) =>
        item.id === message.id ? { ...item, applied: true } : item,
      ),
    );
  };

  const toggleExpanded = (messageId: string) => {
    setExpandedMessages((current) => {
      const next = new Set(current);
      if (next.has(messageId)) next.delete(messageId);
      else next.add(messageId);
      return next;
    });
  };

  if (!open) return null;
  return (
    <aside
      className="absolute inset-y-3 right-3 z-30 flex w-[420px] flex-col overflow-hidden rounded-xl border bg-background shadow-2xl"
      data-testid="metamodel-ai-assistant"
    >
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-primary/10 p-1.5 text-primary">
            <Sparkles className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold">AI Model Assistant</h2>
            <p className="text-[11px] text-muted-foreground">
              Propose additions, review each item, then apply.
            </p>
          </div>
        </div>
        <Button
          size="icon"
          variant="ghost"
          onClick={onClose}
          aria-label="Close AI assistant"
        >
          <X className="h-4 w-4" />
        </Button>
      </header>
      <div className="flex items-center gap-1.5 border-b bg-muted/20 px-4 py-2 text-[10px] text-muted-foreground">
        <Layers3 className="h-3 w-3" />
        <span>
          Vocabulary: {allowedNodeKinds.length} element types ·{" "}
          {allowedRelationTypes.length} relationship types
        </span>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-4 p-4">
          {messages.length === 0 ? (
            <div className="space-y-3 text-sm">
              <div className="rounded-lg bg-muted/50 p-3 text-muted-foreground">
                Tell me what your metamodel should describe. I’ll use the
                configured vocabulary and current canvas, then show exactly
                what would be added. Nothing changes until you apply a
                selection.
              </div>
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  className="w-full rounded-lg border p-3 text-left text-xs transition-colors hover:bg-muted"
                  onClick={() => void submit(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          ) : null}
          {messages.map((message) => {
            const isExpanded = expandedMessages.has(message.id);
            const proposal = message.proposal;
            const review = message.review;
            const selectedCount =
              (message.selectedNodeIds?.length ?? 0) +
              (message.selectedEdgeIndexes?.length ?? 0);
            const labels = new Map(
              currentModel.nodes.map((node) => [node.id, node.name]),
            );
            proposal?.nodes.forEach((node) => labels.set(node.id, node.name));
            const nodeRows = proposal?.nodes.map((node, index) => ({
              node,
              index,
              item: review?.nodes[index],
            })) ?? [];
            const renderNodeRow = ({
              node,
              index,
              item,
            }: {
              node: NonNullable<typeof proposal>["nodes"][number];
              index: number;
              item: NonNullable<typeof review>["nodes"][number] | undefined;
            }) => {
              if (!item) return null;
              const checked = (message.selectedNodeIds ?? []).includes(node.id);
              return (
                <label
                  key={`${node.id}-${index}`}
                  className={`flex cursor-pointer gap-2 rounded-md border p-2 ${
                    item.status === "invalid"
                      ? "cursor-not-allowed opacity-60"
                      : "hover:bg-muted/60"
                  }`}
                >
                  <Checkbox
                    className="mt-0.5"
                    checked={checked}
                    disabled={item.status === "invalid"}
                    onCheckedChange={(value) =>
                      toggleNode(message.id, node.id, value === true)
                    }
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5 font-medium">
                      <span className="truncate">{node.name}</span>
                      <ReviewBadge status={item.status} />
                      <span className="text-[10px] font-normal text-muted-foreground">
                        {node.kind}
                      </span>
                    </span>
                    {node.description ? (
                      <span className="mt-0.5 block text-[10px] text-muted-foreground">
                        {node.description}
                      </span>
                    ) : null}
                    <WarningList warnings={item.warnings} />
                  </span>
                </label>
              );
            };
            const newNodeRows = nodeRows.filter(
              ({ item }) => item?.status === "new",
            );
            const overlapNodeRows = nodeRows.filter(
              ({ item }) => item?.status === "overlap",
            );
            const invalidNodeRows = nodeRows.filter(
              ({ item }) => item?.status === "invalid",
            );
            return (
              <div
                key={message.id}
                className={`flex gap-2 ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {message.role === "assistant" ? (
                  <Bot className="mt-1 h-4 w-4 shrink-0 text-primary" />
                ) : null}
                <div
                  className={`max-w-[94%] rounded-lg p-3 text-xs ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "border bg-muted/30"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                  {proposal && review ? (
                    <div className="mt-3 space-y-3 border-t pt-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex gap-1.5">
                          <Badge variant="secondary">
                            {proposal.nodes.length} elements
                          </Badge>
                          <Badge variant="secondary">
                            {proposal.edges.length} relationships
                          </Badge>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-1.5 text-[10px]"
                          onClick={() => toggleExpanded(message.id)}
                        >
                          {isExpanded ? (
                            <ChevronDown className="mr-1 h-3 w-3" />
                          ) : (
                            <ChevronRight className="mr-1 h-3 w-3" />
                          )}
                          {isExpanded ? "Hide review" : "Review items"}
                        </Button>
                      </div>
                      {isExpanded ? (
                        <>
                          <WarningList warnings={review.warnings} />
                          {newNodeRows.length ? (
                            <section className="space-y-1.5">
                              <h3 className="flex items-center gap-1.5 text-[11px] font-semibold">
                                <Plus className="h-3 w-3 text-primary" />
                                New elements
                              </h3>
                              {newNodeRows.map(renderNodeRow)}
                            </section>
                          ) : null}
                          {overlapNodeRows.length ? (
                            <section className="space-y-1.5">
                              <h3 className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                                <AlertTriangle className="h-3 w-3" />
                                Potential overlaps
                              </h3>
                              <p className="text-[10px] text-muted-foreground">
                                These match elements already on the canvas and
                                are unchecked by default.
                              </p>
                              {overlapNodeRows.map(renderNodeRow)}
                            </section>
                          ) : null}
                          {invalidNodeRows.length ? (
                            <section className="space-y-1.5">
                              <h3 className="flex items-center gap-1.5 text-[11px] font-semibold text-destructive">
                                <CircleAlert className="h-3 w-3" />
                                Invalid elements
                              </h3>
                              {invalidNodeRows.map(renderNodeRow)}
                            </section>
                          ) : null}
                          {proposal.edges.length ? (
                            <section className="space-y-1.5">
                              <h3 className="flex items-center gap-1.5 text-[11px] font-semibold">
                                <Link2 className="h-3 w-3 text-primary" />
                                Relationships
                              </h3>
                              {proposal.edges.map((edge, index) => {
                                const item = review.edges[index];
                                const checked = (
                                  message.selectedEdgeIndexes ?? []
                                ).includes(index);
                                return (
                                  <label
                                    key={`${edge.source}-${edge.target}-${index}`}
                                    className={`flex cursor-pointer gap-2 rounded-md border p-2 ${
                                      item.status === "invalid"
                                        ? "cursor-not-allowed opacity-60"
                                        : "hover:bg-muted/60"
                                    }`}
                                  >
                                    <Checkbox
                                      className="mt-0.5"
                                      checked={checked}
                                      disabled={item.status === "invalid"}
                                      onCheckedChange={(value) =>
                                        toggleEdge(
                                          message.id,
                                          index,
                                          value === true,
                                        )
                                      }
                                    />
                                    <span className="min-w-0 flex-1">
                                      <span className="flex flex-wrap items-center gap-1.5 font-medium">
                                        <span>
                                          {labels.get(edge.source) ??
                                            edge.source}{" "}
                                          →{" "}
                                          {labels.get(edge.target) ??
                                            edge.target}
                                        </span>
                                        <ReviewBadge status={item.status} />
                                      </span>
                                      <span className="text-[10px] text-muted-foreground">
                                        {edge.relation}
                                        {edge.label ? ` · ${edge.label}` : ""}
                                      </span>
                                      <WarningList warnings={item.warnings} />
                                    </span>
                                  </label>
                                );
                              })}
                            </section>
                          ) : null}
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              className="flex-1"
                              disabled={message.applied || selectedCount === 0}
                              onClick={() => applyProposal(message)}
                            >
                              {message.applied ? (
                                <>
                                  <Check className="mr-1 h-3.5 w-3.5" />
                                  Applied
                                </>
                              ) : (
                                <>
                                  <Sparkles className="mr-1 h-3.5 w-3.5" />
                                  Apply {selectedCount} selected
                                </>
                              )}
                            </Button>
                            {!message.applied ? (
                              <span className="text-[10px] text-muted-foreground">
                                One undoable action
                              </span>
                            ) : null}
                          </div>
                        </>
                      ) : (
                        <p className="text-[10px] text-muted-foreground">
                          Review the individual items before applying.{" "}
                          {review.warnings.length
                            ? `${review.warnings.length} warning${
                                review.warnings.length === 1 ? "" : "s"
                              } found.`
                            : "No warnings found."}
                        </p>
                      )}
                    </div>
                  ) : null}
                </div>
                {message.role === "user" ? (
                  <User className="mt-1 h-4 w-4 shrink-0" />
                ) : null}
              </div>
            );
          })}
          {isLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Gemini is designing a proposal from your current model…
            </div>
          ) : null}
          {error ? (
            <div className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}
        </div>
      </ScrollArea>
      <form
        className="border-t p-3"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="flex items-end gap-2">
          <Textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void submit();
              }
            }}
            placeholder="Describe additions or refine the last proposal…"
            className="min-h-20 resize-none"
            disabled={isLoading}
          />
          <Button
            size="icon"
            type="submit"
            disabled={isLoading || prompt.trim().length < 3}
            aria-label="Send prompt"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground">
          AI output can be wrong. Review every selected item; applying only
          adds to the canvas.
        </p>
      </form>
    </aside>
  );
}