import { useMemo } from "react";
import type { ProjectType } from "@shared/schema";

type HelpItem = {
  key: string;
  description: string;
};

export type DiagramHelpContent = {
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
          "Use the metamodel editor to define types and relationships that instance models can build on.",
        shortcuts: [
          { key: "Ctrl/Cmd + S", description: "Save the current diagram." },
          {
            key: "Delete / Backspace",
            description: "Delete the selected element or relationship.",
          },
          {
            key: "Double-click node",
            description: "Open the editor of the selected element.",
          },
          {
            key: "Select an element",
            description: "Shows its edit, duplicate and delete buttons.",
          },
        ],
        functions: [
          "Use the Add elements tab in the sidebar to place types of the seven built-in kinds.",
          "Click a kind to place it in a free spot, or drag it onto the canvas to place it precisely.",
          "Create and validate relationships to define which structures are allowed in instance models.",
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
            description: "Delete the selected element or relationship.",
          },
          {
            key: "Double-click node",
            description: "Open the editor of the selected element.",
          },
          {
            key: "Esc",
            description: "Cancel edge creation menus when they are open.",
          },
        ],
        functions: [
          "Mark start and end nodes, then run or step through the flow from the canvas toolbar.",
          "Use the flow run card to monitor progress, current tick, and active endpoints.",
          "Edit elements and relationships while checking whether the instance still follows the metamodel.",
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
          description: "Delete the selected element or relationship.",
        },
        {
          key: "Double-click node",
          description: "Open the editor of the selected element.",
        },
        {
          key: "Esc",
          description: "Cancel edge creation menus when they are open.",
        },
      ],
      functions: [
        "Drag referenced metamodel types into the canvas to create typed instance nodes.",
        "Use patterns and alignment tools to assemble diagrams more quickly.",
        "Validate the model to check whether elements and relationships conform to the metamodel.",
      ],
    };
  }, [isFlowMode, projectType]);
}
