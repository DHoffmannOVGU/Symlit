# Diagram editor

The same editor is used for metamodels and models.

## Canvas

- Each element has one handle per side; drag from a handle to draw a relationship.
- **Auto Layout** arranges the diagram.
- Select two or more elements to align them or to save them as a [pattern](Patterns-Rules-and-Validation).
- **Screenshot** exports the diagram as an image.

## Table view

Table view lists the elements of the diagram as rows, with their attributes as columns.

## Saving

- **Save** in the header writes the diagram; its state is shown beside it. `Ctrl/Cmd + S` saves too.
- The element and relationship panels say **Apply**: they change the diagram, Save writes it.
- **Auto-save** is optional and is turned on in the canvas settings.
- If the diagram was changed elsewhere (another tab, or through another diagram), Symlit does
  not overwrite it silently: a dialog lets you choose which version to keep.
- Leaving a diagram with unsaved changes asks first.

## Shortcuts

| Key | Action |
| --- | --- |
| `Ctrl/Cmd + S` | Save the diagram |
| `Ctrl/Cmd + Z` | Undo. Add `Shift` (or use `Ctrl + Y`) to redo |
| `Ctrl/Cmd + C` / `V` | Copy and paste the selected elements |
| `F2` | Rename the selected element on its card (`Enter` confirms, `Esc` cancels) |
| `Delete` / `Backspace` | Delete the selected elements or relationships |
| Double-click | Open the editor of an element or relationship |
| `Shift` + drag | Select several elements with a box. `Ctrl/Cmd`-click adds one at a time |
| Drag from a side handle | Draw a relationship to another element, or onto empty canvas to create one there |
| `Esc` | Close a menu or dialog |

The **Help** button in the editor shows this list together with tips for the current mode.

## Damaged diagrams

If a diagram cannot be opened as stored, a guided recovery dialog explains what is wrong and
offers to repair it.
