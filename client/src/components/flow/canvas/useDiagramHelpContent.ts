import { useMemo } from "react";
import { FORMULA_FUNCTIONS } from "@shared/formula";
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
  /** How calculated attributes work; shown where elements and types have attributes. */
  formulas?: string[];
};

/** Calculated attributes (Derived Formula), the same in metamodels and models. */
const FORMULAS: string[] = [
  "An attribute of the type Derived Formula is calculated from other attributes of the same element, for example [print time] * [machine rate].",
  "A formula uses numbers (with a point: 0.5), + - * /, parentheses and minus signs (2 * -3). Other attributes go in square brackets, by name; typing [ offers them.",
  `Functions take values separated by commas, for example max([price], 10) or round([mass] / 7, 1): ${Object.values(
    FORMULA_FUNCTIONS,
  )
    .map((fn) => `${fn.signature}, ${fn.description}`)
    .join("; ")}. They work on the attributes of the same element, not across elements.`,
  "A formula can use another calculated attribute, so a calculation can be built up in steps. It cannot use itself, directly or in a circle.",
  "When an attribute it uses has no value yet, or it would divide by zero, the result is not calculated yet: it stays empty, and nothing is blocked.",
  "Results follow their inputs wherever those are edited: in the element's editor, in the table, and for a new element of a type.",
  "Units are labels. Nothing converts them: grams to kilograms is a division by 1000 in the formula.",
  "A formula defined on a type is copied to each new element, which calculates with its own values. Changing the formula on the type later does not reach existing elements.",
  "Model rules can test a calculated value like any other, for example margin is less than 0.",
];

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
      { key: "F2", description: "Rename the selected element on its card (Enter confirms, Esc cancels)." },
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
        formulas: FORMULAS,
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
      formulas: FORMULAS,
    };
  }, [isFlowMode, projectType]);
}
