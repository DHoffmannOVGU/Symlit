import { useMemo } from "react";
import type { ProjectType } from "@shared/schema";

type HelpItem = {
  key: string;
  description: string;
};

type DiagramHelpContent = {
  title: string;
  description: string;
  shortcuts: HelpItem[];
  functions: string[];
};

export function useDiagramHelpContent(
  projectType: ProjectType,
  isFlowMode: boolean,
): DiagramHelpContent {
  return useMemo(() => {
    if (projectType === "metamodel") {
      return {
        title: "Metamodel Editor Help",
        description:
          "Use the metamodel editor to define the standard node types, relationships, and internal structure that instance models can build on.",
        shortcuts: [
          { key: "Ctrl/Cmd + S", description: "Save the current diagram." },
          {
            key: "Delete / Backspace",
            description: "Delete the selected node or relationship.",
          },
          {
            key: "Double-click node",
            description: "Open the node edit sidebar.",
          },
          {
            key: "Hover or click node action button",
            description: "Expand the node action toolbar.",
          },
        ],
        functions: [
          "Use the Node Types tab in the sidebar to create the seven standard metamodel node types.",
          "Drag a node type from the sidebar onto the canvas to place it precisely.",
          "Create and validate relationships to define which structures are allowed in instance models.",
          "Open internal views from selected nodes to model nested structure in more detail.",
        ],
      };
    }

    if (isFlowMode) {
      return {
        title: "Instance Flow Help",
        description:
          "Use flow mode to simulate and step through the behavior of your instance model.",
        shortcuts: [
          { key: "Ctrl/Cmd + S", description: "Save the current diagram." },
          {
            key: "Delete / Backspace",
            description: "Delete the selected node or relationship.",
          },
          {
            key: "Double-click node",
            description: "Open the node edit sidebar.",
          },
          {
            key: "Esc",
            description: "Cancel edge creation menus when they are open.",
          },
        ],
        functions: [
          "Mark start and end nodes, then run or step through the flow from the canvas toolbar.",
          "Use the flow run card to monitor progress, current tick, and active endpoints.",
          "Edit nodes and relationships while checking whether the instance still follows the metamodel.",
          "Open internal views for deeper structure when needed outside the flow path.",
        ],
      };
    }

    return {
      title: "Instance Editor Help",
      description:
        "Use the instance editor to create concrete models from your referenced metamodel types.",
      shortcuts: [
        { key: "Ctrl/Cmd + S", description: "Save the current diagram." },
        {
          key: "Delete / Backspace",
          description: "Delete the selected node or relationship.",
        },
        {
          key: "Double-click node",
          description: "Open the node edit sidebar.",
        },
        {
          key: "Esc",
          description: "Cancel edge creation menus when they are open.",
        },
      ],
      functions: [
        "Drag referenced metamodel types into the canvas to create typed instance nodes.",
        "Use patterns and alignment tools to assemble diagrams more quickly.",
        "Validate the model to check whether nodes and relationships conform to the metamodel.",
        "Open internal views from selected nodes to work on nested parts of the system.",
      ],
    };
  }, [isFlowMode, projectType]);
}
