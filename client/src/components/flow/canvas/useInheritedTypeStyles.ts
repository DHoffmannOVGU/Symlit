import { useEffect } from "react";
import { syncWithTypeStyle } from "@/lib/element-style";
import { useDiagramStore } from "../state/DiagramStoreProvider";
import { useDiagramModel } from "../state/DiagramModelProvider";

/**
 * In instance models, elements show their type's style (icon, colour, border, shape, fill) unless they
 * were given their own. Keeps those inherited styles in sync with the types.
 */
export function useInheritedTypeStyles() {
  const setNodes = useDiagramStore((state) => state.setNodes);
  const { projectType, partDefStyleById } = useDiagramModel();

  useEffect(() => {
    if (projectType !== "instance") return;
    setNodes((current) => {
      let hasChanges = false;
      const next = current.map((node) => {
        if (node.type !== "part") return node;
        const data = node.data;
        if (!data?.typeId) return node;
        const synced = syncWithTypeStyle(data, partDefStyleById.get(data.typeId));
        if (synced === data) return node;
        hasChanges = true;
        return { ...node, data: synced };
      });
      return hasChanges ? next : current;
    });
  }, [partDefStyleById, projectType, setNodes]);
}
