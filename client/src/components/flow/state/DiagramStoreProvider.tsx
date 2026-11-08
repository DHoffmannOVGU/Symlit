import { createContext, useContext, useState, type ReactNode } from "react";
import { useStore } from "zustand";
import { createDiagramStore, type DiagramState, type DiagramStore } from "./diagramStore";

const DiagramStoreContext = createContext<DiagramStore | null>(null);

/** Gives the diagram below it its own editor store. Remount (e.g. `key={viewId}`) for a fresh store. */
export function DiagramStoreProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createDiagramStore);
  return <DiagramStoreContext.Provider value={store}>{children}</DiagramStoreContext.Provider>;
}

export function useDiagramStoreApi(): DiagramStore {
  const store = useContext(DiagramStoreContext);
  if (!store) throw new Error("useDiagramStore must be used inside <DiagramStoreProvider>.");
  return store;
}

/** Reads from the diagram store; the component re-renders only when the selected value changes. */
export function useDiagramStore<T>(selector: (state: DiagramState) => T): T {
  return useStore(useDiagramStoreApi(), selector);
}
