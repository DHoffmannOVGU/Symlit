import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { Node, Edge } from '@xyflow/react';

type HistoryItem<TNode extends Node, TEdge extends Edge> = {
  nodes: TNode[];
  edges: TEdge[];
};

export function useUndoRedo<
  TNode extends Node = Node,
  TEdge extends Edge = Edge,
>(
  initialNodes: TNode[],
  initialEdges: TEdge[],
  setNodes: Dispatch<SetStateAction<TNode[]>>,
  setEdges: Dispatch<SetStateAction<TEdge[]>>
) {
  const [past, setPast] = useState<HistoryItem<TNode, TEdge>[]>([]);
  const [future, setFuture] = useState<HistoryItem<TNode, TEdge>[]>([]);
  
  // Track if we are currently undoing/redoing to avoid pushing to history
  const isInternalUpdate = useRef(false);

  const takeSnapshot = useCallback((nodes: TNode[], edges: TEdge[]) => {
    if (isInternalUpdate.current) return;
    
    setPast((prev) => {
      // Basic optimization: only save if something changed
      const last = prev[prev.length - 1];
      if (last && JSON.stringify(last.nodes) === JSON.stringify(nodes) && JSON.stringify(last.edges) === JSON.stringify(edges)) {
        return prev;
      }
      return [...prev.slice(-49), { nodes, edges }];
    });
    setFuture([]);
  }, []);

  const undo = useCallback(() => {
    setPast((prevPast) => {
      if (prevPast.length === 0) return prevPast;
      
      const newPast = [...prevPast];
      const previous = newPast.pop()!;
      
      setNodes((currentNodes) => {
        setEdges((currentEdges) => {
          setFuture((prevFuture) => [{ nodes: currentNodes, edges: currentEdges }, ...prevFuture.slice(0, 49)]);
          isInternalUpdate.current = true;
          return previous.edges;
        });
        return previous.nodes;
      });
      
      // Reset the internal update flag after the state updates have propagated
      setTimeout(() => {
        isInternalUpdate.current = false;
      }, 0);

      return newPast;
    });
  }, [setNodes, setEdges]);

  const redo = useCallback(() => {
    setFuture((prevFuture) => {
      if (prevFuture.length === 0) return prevFuture;
      
      const newFuture = [...prevFuture];
      const next = newFuture.shift()!;
      
      setNodes((currentNodes) => {
        setEdges((currentEdges) => {
          setPast((prevPast) => [...prevPast, { nodes: currentNodes, edges: currentEdges }]);
          isInternalUpdate.current = true;
          return next.edges;
        });
        return next.nodes;
      });

      setTimeout(() => {
        isInternalUpdate.current = false;
      }, 0);

      return newFuture;
    });
  }, [setNodes, setEdges]);

  return { undo, redo, takeSnapshot, canUndo: past.length > 0, canRedo: future.length > 0 };
}
