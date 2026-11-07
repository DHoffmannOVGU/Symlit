import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Check, X } from "lucide-react";
import type { CustomEdgeData } from "./CustomEdges";

export type MetaRelationOption = {
  id: string;
  edgeType: CustomEdgeData["edgeType"];
  flowType?: "partflow" | "actionflow" | "informationflow";
  label?: string;
  displayLabel: string;
};

export type PendingEdgeRelationConfirmation = {
  edgeId: string;
  options: MetaRelationOption[];
  selectedRelationId: string;
};

type EdgeRelationConfirmationContextValue = {
  pending: PendingEdgeRelationConfirmation | null;
  onConfirm: (edgeId: string, relationId: string) => void;
  onReject: (edgeId: string) => void;
};

const EdgeRelationConfirmationContext =
  createContext<EdgeRelationConfirmationContextValue | null>(null);

export function EdgeRelationConfirmationProvider({
  value,
  children,
}: {
  value: EdgeRelationConfirmationContextValue;
  children: ReactNode;
}) {
  return (
    <EdgeRelationConfirmationContext.Provider value={value}>
      {children}
    </EdgeRelationConfirmationContext.Provider>
  );
}

export function EdgeRelationConfirmationControl({
  edgeId,
}: {
  edgeId: string;
}) {
  const context = useContext(EdgeRelationConfirmationContext);
  const pending = context?.pending?.edgeId === edgeId ? context.pending : null;
  const [relationId, setRelationId] = useState("");

  useEffect(() => {
    setRelationId(pending?.selectedRelationId ?? "");
  }, [pending?.edgeId, pending?.selectedRelationId]);

  if (!context || !pending || pending.options.length === 0) return null;

  const selected =
    pending.options.find((option) => option.id === relationId) ??
    pending.options[0];

  if (pending.options.length === 1) {
    return (
      <div className="nodrag nopan flex items-center gap-1 rounded-full border border-slate-200 bg-white/95 p-1 shadow-md backdrop-blur">
        <button
          type="button"
          className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 transition-colors hover:bg-emerald-100"
          title={`Confirm metamodel relationship: ${selected.displayLabel}`}
          aria-label={`Confirm metamodel relationship ${selected.displayLabel}`}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            context.onConfirm(edgeId, selected.id);
          }}
        >
          <Check className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
          title="Use this relationship without the suggested label"
          aria-label="Reject suggested relationship label"
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            context.onReject(edgeId);
          }}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="nodrag nopan flex items-center gap-1 rounded-lg border border-slate-200 bg-white/95 p-1 shadow-lg backdrop-blur">
      <select
        value={selected.id}
        onChange={(event) => setRelationId(event.target.value)}
        onMouseDown={(event) => event.stopPropagation()}
        className="h-7 max-w-56 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-primary"
        aria-label="Choose metamodel relationship"
      >
        {pending.options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.displayLabel}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-600 text-white transition-colors hover:bg-emerald-700"
        title={`Confirm ${selected.displayLabel}`}
        aria-label={`Confirm metamodel relationship ${selected.displayLabel}`}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          context.onConfirm(edgeId, selected.id);
        }}
      >
        <Check className="h-4 w-4" />
      </button>
      <button
        type="button"
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
        title="Use this relationship without a suggested label"
        aria-label="Reject suggested relationship labels"
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          context.onReject(edgeId);
        }}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
