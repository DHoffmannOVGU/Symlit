import { useCallback } from "react";
import { useReactFlow } from "@xyflow/react";
import { magicNodeTypeCatalog, type MagicNodeType } from "@shared/metamodel-setup";
import { dispatchDiagramEvent } from "@/lib/diagram-events";
import { newNodeId } from "@/lib/ids";
import { applyTypeStyle, pickElementStyle } from "@/lib/element-style";
import type { DiagramNode } from "../types";
import { useDiagramStore, useDiagramStoreApi } from "../state/DiagramStoreProvider";
import { useDiagramModel } from "../state/DiagramModelProvider";
import { NODE_HEIGHT, NODE_WIDTH } from "../utils/node-size";

export interface AddElementOptions {
  /** Element kind in a metamodel (instance models always create `part`). */
  nodeType?: MagicNodeType;
  /** Type from a referenced metamodel the new element is an instance of. */
  typeId?: string;
  typeLabel?: string;
  icon?: string;
  color?: string;
  /** Where to place it (flow coordinates); defaults to the middle of the screen. */
  position?: { x: number; y: number };
}

/** Adds a new element to the open diagram (undoable). */
export function useAddElement() {
  const { viewId, projectType, partDefStyleById } = useDiagramModel();
  const diagramStore = useDiagramStoreApi();
  const setNodes = useDiagramStore((state) => state.setNodes);
  const takeSnapshot = useDiagramStore((state) => state.takeSnapshot);
  const { screenToFlowPosition } = useReactFlow();

  return useCallback(
    (options?: AddElementOptions) => {
      takeSnapshot();
      const id = newNodeId();
      const nodeType = projectType === "metamodel" ? (options?.nodeType ?? "partdef") : "part";
      const kind = magicNodeTypeCatalog.find((entry) => entry.id === nodeType) ?? magicNodeTypeCatalog[0];
      const typeLabel = options?.typeLabel || kind.label;
      const center =
        options?.position ?? screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
      const count = diagramStore.getState().nodes.length;

      const node: DiagramNode = {
        id,
        type: nodeType,
        position: {
          // A little jitter so repeated additions do not stack exactly.
          x: center.x - NODE_WIDTH / 2 + (Math.random() - 0.5) * 50,
          y: center.y - NODE_HEIGHT / 2 + (Math.random() - 0.5) * 50,
        },
        data: {
          label: `New ${typeLabel} ${count + 1}`,
          attributes: [],
          ...(projectType === "metamodel"
            ? { type: typeLabel, icon: options?.icon ?? kind.iconName, ...(options?.color ? { color: options.color } : {}) }
            : {}),
          ...(options?.typeId ? { type: typeLabel, typeId: options.typeId } : {}),
        },
      };
      if (options?.typeId) {
        // A typed element starts out matching its type's style.
        const style = partDefStyleById.get(options.typeId) ?? { icon: options.icon, color: options.color };
        node.data = applyTypeStyle(node.data, pickElementStyle(style));
      }

      setNodes((current) => [...current, node]);
      dispatchDiagramEvent("diagram-model-node-created", {
        viewId,
        nodeId: id,
        ...(options?.typeId ? { typeId: options.typeId } : {}),
      });
    },
    [diagramStore, partDefStyleById, projectType, screenToFlowPosition, setNodes, takeSnapshot, viewId],
  );
}
