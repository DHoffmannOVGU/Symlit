import { useEffect } from "react";
import { useDiagramStore } from "../state/DiagramStoreProvider";
import { useDiagramModel } from "../state/DiagramModelProvider";

/**
 * In instance models, elements show their type's icon and colour unless they
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
        const style = partDefStyleById.get(data.typeId);
        if (!style) return node;
        const shouldInherit = data.inheritStyle === true || (data.inheritStyle !== false && !data.icon && !data.color);
        if (!shouldInherit) return node;
        if (data.icon === style.icon && data.color === style.color && data.inheritStyle === true) return node;
        hasChanges = true;
        return { ...node, data: { ...node.data, icon: style.icon, color: style.color, inheritStyle: true } };
      });
      return hasChanges ? next : current;
    });
  }, [partDefStyleById, projectType, setNodes]);
}
