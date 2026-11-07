import { useCallback, useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Edge, Node } from "@xyflow/react";

import type { CustomEdgeData } from "../edges/CustomEdges";
import type { NodeData } from "../types";
import { inferFlowTypeFromNodes } from "../utils/flow-type";

interface ToastFn {
  (props: { title?: string; description?: string }): void;
}

interface UseFlowPlaybackParams {
  isFlowMode: boolean;
  nodes: Node[];
  edges: Edge[];
  selectedNodeId: string | null;
  setNodes: Dispatch<SetStateAction<Node[]>>;
  toast: ToastFn;
}

const FLOW_MAX_TICKS_PER_NODE = 5;

export function useFlowPlayback({
  isFlowMode,
  nodes,
  edges,
  selectedNodeId,
  setNodes,
  toast,
}: UseFlowPlaybackParams) {
  const [isFlowRunning, setIsFlowRunning] = useState(false);
  const [flowCompleted, setFlowCompleted] = useState(false);
  const [flowSchedule, setFlowSchedule] = useState<Map<string, number[]> | null>(
    null,
  );
  const [flowCurrentTick, setFlowCurrentTick] = useState(0);
  const [flowMaxTick, setFlowMaxTick] = useState<number | null>(null);

  const resetFlowPlayback = useCallback(() => {
    setIsFlowRunning(false);
    setFlowCompleted(false);
    setFlowSchedule(null);
    setFlowCurrentTick(0);
    setFlowMaxTick(null);
  }, []);

  const flowStartNodeId = useMemo(
    () =>
      nodes.find((node) => (node.data as unknown as NodeData | undefined)?.flowStart)?.id ??
      null,
    [nodes],
  );

  const flowEndNodeId = useMemo(
    () =>
      nodes.find((node) => (node.data as unknown as NodeData | undefined)?.flowEnd)?.id ??
      null,
    [nodes],
  );

  const flowStartLabel = useMemo(() => {
    if (!flowStartNodeId) return "";
    const node = nodes.find((candidate) => candidate.id === flowStartNodeId);
    return ((node?.data as unknown as NodeData | undefined)?.label ?? flowStartNodeId);
  }, [flowStartNodeId, nodes]);

  const flowEndLabel = useMemo(() => {
    if (!flowEndNodeId) return "";
    const node = nodes.find((candidate) => candidate.id === flowEndNodeId);
    return ((node?.data as unknown as NodeData | undefined)?.label ?? flowEndNodeId);
  }, [flowEndNodeId, nodes]);

  useEffect(() => {
    if (!isFlowMode && isFlowRunning) {
      setIsFlowRunning(false);
      return;
    }
    if (!isFlowRunning) return;
    if (!flowStartNodeId || !flowEndNodeId) {
      setIsFlowRunning(false);
    }
  }, [flowEndNodeId, flowStartNodeId, isFlowMode, isFlowRunning]);

  useEffect(() => {
    if (!isFlowMode) {
      resetFlowPlayback();
      return;
    }
    if (!isFlowRunning || flowMaxTick === null) return;

    const interval = window.setInterval(() => {
      setFlowCurrentTick((prev) => {
        const next = prev + 1;
        if (next >= flowMaxTick) {
          window.clearInterval(interval);
          setIsFlowRunning(false);
          setFlowCompleted(true);
          return flowMaxTick;
        }
        return next;
      });
    }, 800);

    return () => window.clearInterval(interval);
  }, [flowMaxTick, isFlowMode, isFlowRunning, resetFlowPlayback]);

  const computeFlowSchedule = useCallback(() => {
    if (!flowStartNodeId) return null;

    const adjacency = new Map<string, Array<{ id: string; weight: 0 | 1 }>>();
    nodes.forEach((node) => adjacency.set(node.id, []));

    edges.forEach((edge) => {
      const edgeType =
        (edge.type as CustomEdgeData["edgeType"] | undefined) ||
        (edge.data as CustomEdgeData | undefined)?.edgeType;
      if (edgeType === "generalization") return;

      const sourceNode = nodes.find((node) => node.id === edge.source);
      const targetNode = nodes.find((node) => node.id === edge.target);
      const edgeData = edge.data as CustomEdgeData | undefined;
      const flowType =
        edgeData?.flowType || inferFlowTypeFromNodes(sourceNode, targetNode);
      const weight: 0 | 1 = flowType === "informationflow" ? 0 : 1;

      if (!adjacency.has(edge.source)) {
        adjacency.set(edge.source, []);
      }
      adjacency.get(edge.source)?.push({ id: edge.target, weight });
    });

    const schedule = new Map<string, number[]>();
    const seen = new Map<string, Set<number>>();
    const queue: Array<{ id: string; tick: number }> = [];

    const pushArrival = (id: string, tick: number) => {
      const ticks = schedule.get(id) ?? [];
      if (ticks.length >= FLOW_MAX_TICKS_PER_NODE) return false;
      if (ticks.includes(tick)) return true;

      ticks.push(tick);
      ticks.sort((a, b) => a - b);
      schedule.set(id, ticks);

      const seenTicks = seen.get(id) ?? new Set<number>();
      seenTicks.add(tick);
      seen.set(id, seenTicks);
      queue.push({ id, tick });
      return true;
    };

    if (!pushArrival(flowStartNodeId, 1)) {
      return { schedule, maxTick: 0, limitHit: true };
    }

    let limitHit = false;
    for (let index = 0; index < queue.length && !limitHit; index += 1) {
      const { id, tick } = queue[index];
      const neighbors = adjacency.get(id) || [];

      for (const neighbor of neighbors) {
        const nextTick = tick + neighbor.weight;
        const existing = schedule.get(neighbor.id) ?? [];
        if (existing.length >= FLOW_MAX_TICKS_PER_NODE) {
          limitHit = true;
          break;
        }

        const seenTicks = seen.get(neighbor.id);
        if (seenTicks?.has(nextTick)) continue;
        if (!pushArrival(neighbor.id, nextTick)) {
          limitHit = true;
          break;
        }
      }
    }

    let maxTick = 0;
    schedule.forEach((ticks) => {
      ticks.forEach((tick) => {
        if (tick > maxTick) {
          maxTick = tick;
        }
      });
    });

    return { schedule, maxTick, limitHit };
  }, [edges, flowStartNodeId, nodes]);

  const ensureFlowSchedule = useCallback(() => {
    if (!flowStartNodeId || !flowEndNodeId) return null;
    if (flowSchedule && flowMaxTick !== null) {
      return { schedule: flowSchedule, maxTick: flowMaxTick };
    }

    const result = computeFlowSchedule();
    if (!result) return null;

    if (result.limitHit) {
      toast({
        title: "Flow truncated",
        description: "A node hit 5 ticks. The mock run stops at that limit.",
      });
    }

    const endTicks = result.schedule.get(flowEndNodeId) ?? [];
    if (endTicks.length === 0) {
      toast({
        title: "End node unreachable",
        description: "No flow path from start to end using flow edges.",
      });
      return null;
    }

    setFlowSchedule(result.schedule);
    setFlowMaxTick(result.maxTick);
    return { schedule: result.schedule, maxTick: result.maxTick };
  }, [
    computeFlowSchedule,
    flowEndNodeId,
    flowMaxTick,
    flowSchedule,
    flowStartNodeId,
    toast,
  ]);

  const handleSetFlowStart = useCallback(() => {
    if (!isFlowMode || !selectedNodeId) return;

    setNodes((current) =>
      current.map((node) => {
        const data = (node.data ?? {}) as unknown as NodeData;
        if (node.id === selectedNodeId) {
          if (data.flowEnd) {
            toast({
              title: "Start and end must be different",
              description: "Choose a different node for the flow start.",
            });
            return node;
          }
          if (data.flowStart) return node;
          return { ...node, data: { ...data, flowStart: true } };
        }
        if (!data.flowStart) return node;
        return { ...node, data: { ...data, flowStart: false } };
      }),
    );

    resetFlowPlayback();
  }, [isFlowMode, resetFlowPlayback, selectedNodeId, setNodes, toast]);

  const handleSetFlowEnd = useCallback(() => {
    if (!isFlowMode || !selectedNodeId) return;

    setNodes((current) =>
      current.map((node) => {
        const data = (node.data ?? {}) as unknown as NodeData;
        if (node.id === selectedNodeId) {
          if (data.flowStart) {
            toast({
              title: "Start and end must be different",
              description: "Choose a different node for the flow end.",
            });
            return node;
          }
          if (data.flowEnd) return node;
          return { ...node, data: { ...data, flowEnd: true } };
        }
        if (!data.flowEnd) return node;
        return { ...node, data: { ...data, flowEnd: false } };
      }),
    );

    resetFlowPlayback();
  }, [isFlowMode, resetFlowPlayback, selectedNodeId, setNodes, toast]);

  const handlePlayFlow = useCallback(() => {
    if (!isFlowMode || !flowStartNodeId || !flowEndNodeId) return;

    const result = ensureFlowSchedule();
    if (!result) return;

    const startingTick = flowCurrentTick > 0 ? flowCurrentTick : 1;
    setFlowCurrentTick(startingTick);
    if (startingTick >= result.maxTick) {
      setIsFlowRunning(false);
      setFlowCompleted(true);
      return;
    }

    setFlowCompleted(false);
    setIsFlowRunning(true);
  }, [
    ensureFlowSchedule,
    flowCurrentTick,
    flowEndNodeId,
    flowStartNodeId,
    isFlowMode,
  ]);

  const handleStopFlow = useCallback(() => {
    setIsFlowRunning(false);
  }, []);

  const handleStepForward = useCallback(() => {
    if (!isFlowMode || isFlowRunning) return;
    const result = ensureFlowSchedule();
    if (!result) return;

    setFlowCurrentTick((prev) => {
      const next = Math.min(prev > 0 ? prev + 1 : 1, result.maxTick);
      setFlowCompleted(next >= result.maxTick);
      return next;
    });
  }, [ensureFlowSchedule, isFlowMode, isFlowRunning]);

  const handleStepBack = useCallback(() => {
    if (!isFlowMode || isFlowRunning) return;
    const result = ensureFlowSchedule();
    if (!result) return;

    setFlowCurrentTick((prev) => {
      const next = Math.max(1, prev - 1);
      setFlowCompleted(next >= result.maxTick);
      return next;
    });
  }, [ensureFlowSchedule, isFlowMode, isFlowRunning]);

  const handleResetFlow = useCallback(() => {
    setNodes((current) =>
      current.map((node) => {
        const data = (node.data ?? {}) as unknown as NodeData;
        if (!data.flowStart && !data.flowEnd) return node;
        return {
          ...node,
          data: {
            ...data,
            flowStart: false,
            flowEnd: false,
          },
        };
      }),
    );

    resetFlowPlayback();
  }, [resetFlowPlayback, setNodes]);

  return {
    flowCompleted,
    flowCurrentTick,
    flowEndLabel,
    flowEndNodeId,
    flowMaxTick,
    flowSchedule,
    flowStartLabel,
    flowStartNodeId,
    handlePlayFlow,
    handleResetFlow,
    handleSetFlowEnd,
    handleSetFlowStart,
    handleStepBack,
    handleStepForward,
    handleStopFlow,
    isFlowRunning,
  };
}
