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
    // The same on every canvas; kept in one list so the editors cannot drift apart.
    const editing: HelpItem[] = [
      { key: "Ctrl/Cmd + S", description: "Save the diagram." },
      { key: "Ctrl/Cmd + Z", description: "Undo. Add Shift (or use Ctrl + Y) to redo." },
      { key: "Ctrl/Cmd + C / V", description: "Copy and paste the selected elements." },
      { key: "Delete / Backspace", description: "Delete the selected elements or relationships." },
      { key: "Double-click", description: "Open the editor of an element or relationship." },
      { key: "Shift + drag", description: "Select several elements with a box. Ctrl/Cmd-click adds one at a time." },
      { key: "Drag from a side handle", description: "Draw a relationship to another element, or onto empty canvas to create one there." },
      { key: "Esc", description: "Close a menu or dialog." },
    ];

    if (projectType === "metamodel") {
      return {
        title: "Help: metamodels",
        description: "A metamodel defines the types and relationships that models can be built from.",
        shortcuts: editing,
        functions: [
          "Add elements tab: click a kind to place a new type in a free spot, or drag it to where you want it.",
          "Double-click a type to give it attributes and a style; elements of that type start from both.",
          "Relationships between types define which relationships are allowed between their elements.",
          "Model rules tag elements or report issues when a condition holds; Validate runs them.",
        ],
      };
    }

    if (isFlowMode) {
      return {
        title: "Help: flow mode",
        description: "Flow mode steps through the behavior of your model.",
        shortcuts: editing,
        functions: [
          "Mark a start and an end element, then run or step through the flow from the toolbar.",
          "The flow card shows progress, the current tick and the active elements.",
        ],
      };
    }

    return {
      title: "Help: models",
      description: "A model is built from elements typed by the metamodels it references.",
      shortcuts: editing,
      functions: [
        "Add elements tab: click a type to place an element of it, or drag it to where you want it. Search finds types across all referenced metamodels.",
        "Double-click an element to set its attribute values; the definition of an attribute opens in its own editor.",
        "Validate checks elements and relationships against the metamodel and your model rules, and lists what to fix.",
        "Select two or more elements to align them or to save them as a reusable pattern.",
      ],
    };
  }, [isFlowMode, projectType]);
}
