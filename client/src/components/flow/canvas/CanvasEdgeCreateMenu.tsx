import { useEffect, useMemo, useState } from "react";
import { getTypeAncestors } from "@shared/metamodel-inheritance";
import { EdgeCreateMenu } from "../menus/EdgeCreateMenu";
import type { NodeData } from "../types";
import { useDiagramStore } from "../state/DiagramStoreProvider";
import { useDiagramModel } from "../state/DiagramModelProvider";

const LIMIT_TO_VALID_TARGETS_KEY = "flow.edgeCreateMenu.limitToValidTargets";

function readLimitToValidTargets() {
  try {
    return window.sessionStorage.getItem(LIMIT_TO_VALID_TARGETS_KEY) !== "false";
  } catch {
    return true;
  }
}

type NewElementOptions = { typeId?: string; typeLabel?: string; icon?: string; color?: string };

export interface CanvasEdgeCreateMenuProps {
  /** Where the menu opens, after a relationship was dragged onto empty canvas. */
  menu: { x: number; y: number } | null;
  /** The element the relationship was dragged from. */
  sourceNodeId: string | null;
  onCreate: (options?: NewElementOptions) => void;
  onCancel: () => void;
}

/**
 * Asks which type of element to create at the end of a relationship dragged
 * onto empty canvas. By default it only offers types the metamodel allows as
 * a target of the source element's type.
 */
export function CanvasEdgeCreateMenu({ menu, sourceNodeId, onCreate, onCancel }: CanvasEdgeCreateMenuProps) {
  const nodes = useDiagramStore((state) => state.nodes);
  const { projectType, partTypeOptions, parentMap, relationEdges, metamodelDefaultType } = useDiagramModel();
  const [limitToValidTargets, setLimitToValidTargets] = useState(readLimitToValidTargets);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(LIMIT_TO_VALID_TARGETS_KEY, String(limitToValidTargets));
    } catch {
      // Storage unavailable (private mode); the choice just isn't remembered.
    }
  }, [limitToValidTargets]);

  const sourceTypeId = useMemo(() => {
    if (!sourceNodeId) return null;
    const source = nodes.find((node) => node.id === sourceNodeId);
    return (source?.data as NodeData | undefined)?.typeId ?? null;
  }, [nodes, sourceNodeId]);

  const options = useMemo(() => {
    if (!limitToValidTargets || !sourceTypeId) return partTypeOptions;
    const sourceAncestors = getTypeAncestors(sourceTypeId, parentMap);
    return partTypeOptions.filter((option) => {
      const targetAncestors = getTypeAncestors(option.id, parentMap);
      return relationEdges.some(
        (edge) => sourceAncestors.has(edge.sourceTypeId) && targetAncestors.has(edge.targetTypeId),
      );
    });
  }, [limitToValidTargets, parentMap, partTypeOptions, relationEdges, sourceTypeId]);

  return (
    <EdgeCreateMenu
      open={!!menu}
      position={menu ? { x: menu.x, y: menu.y } : undefined}
      projectType={projectType}
      partTypeOptions={options}
      metamodelDefaultType={metamodelDefaultType}
      limitToValidTargets={limitToValidTargets}
      onLimitToValidTargetsChange={setLimitToValidTargets}
      onSelectDefault={() =>
        onCreate(
          metamodelDefaultType
            ? { typeLabel: metamodelDefaultType.label, icon: metamodelDefaultType.icon }
            : undefined,
        )
      }
      onSelectType={(option) =>
        onCreate({ typeId: option.id, typeLabel: option.label, icon: option.icon, color: option.color })
      }
      onCancel={onCancel}
    />
  );
}
