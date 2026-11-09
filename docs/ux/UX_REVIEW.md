# UI/UX review

A working document for the UI/UX strand. It holds the principles we judge against, a snapshot
of the app as it is, and the findings list. Findings move to "Done" with the commit that fixed them,
like `docs/BACKLOG.md`.

## Principles we use

### Nielsen's 10 usability heuristics, read for a diagram editor
1. **Visibility of system status:** saved/unsaved, validation state, tutorial progress, what is selected, which project you are in.
2. **Match with the real world:** use the modeller's words (type, element, relationship), not implementation words (node, handle).
3. **User control and freedom:** undo/redo everywhere, Escape closes, the tutorial can be skipped, collapsed and left.
4. **Consistency and standards:** one name per concept, the same tab/button in the same place in both project kinds, familiar shortcuts (Ctrl+S, Delete, Ctrl+Z).
5. **Error prevention:** block relationships the metamodel forbids before they are drawn; confirm destructive actions.
6. **Recognition rather than recall:** labelled tools instead of bare icons, types shown on elements, hints where the action happens.
7. **Flexibility and efficiency:** shortcuts, drag *and* click to add, multi-select, Auto Layout for experts.
8. **Aesthetic and minimalist design:** every panel competes with the canvas; show the diagram, not chrome.
9. **Help users recover from errors:** validation messages that say which element and what to do.
10. **Help and documentation:** contextual (the coach, "Show me"), searchable, short.

### Laws of UX that matter most here
- **Fitts:** frequent targets (save, add, handles) big and near where the pointer already is.
- **Hick:** fewer, grouped choices in the palette and toolbar make decisions faster.
- **Jakob:** people expect Figma / draw.io / Miro conventions on a canvas.
- **Miller / chunking:** 7 lessons, short steps, grouped toolbar sections.
- **Doherty threshold:** feedback in under ~400 ms (saving, layout, validation).
- **Goal-gradient & Zeigarnik:** visible progress and an open next step pull people through the tutorial.
- **Peak-end:** the end of the tutorial should feel like an achievement and point to a real next step.
- **Aesthetic-usability:** polish buys tolerance, but must not hide problems.

### Onboarding / tutorial practice
- Learn by doing in the real UI beats reading; the coach should point at the exact control ("Show me").
- Never block the work: the coach must not cover what the step asks you to use.
- Always skippable, resumable, and dismissible; progress kept.
- One action per step, written with the exact UI label the user will see.
- Contextual help afterwards (pull) is worth more than a long first-run tour (push).

*Note: the source pages (nngroup.com, lawsofux.com) could not be fetched from this environment;
the summary above is from established, widely published material.*

## Current state (snapshot, 2026-11-09, v0.1.0)

- **Project list:** hero greeting, tutorial card, three count tiles, search + filter, project cards.
- **Editor:** dark left sidebar (two tabs, palette or element list, Model/Instance Rules and Export at the bottom,
  Projects Overview), breadcrumb + save state at the top, icon toolbar on the canvas
  (graph, table, panels, AI, patterns, validate, screenshot, help), undo/redo, zoom controls.
- **Element editor:** right-hand sheet "Configure Node" with Content and Styling tabs, attributes as cards.
- **Tutorial:** docked coach card bottom right; 7 lessons, 15 steps; Show me / Hint / Skip; collapsible;
  steps complete on app signals (`shared/tutorial.ts`, `client/src/components/tutorial/`).

## First observations (from screenshots, not yet discussed)

| # | Where | Observation | Heuristic |
| --- | --- | --- | --- |
| O1 | Canvas | Element cards are very large (~310 px wide, ~30 px title); three elements fill a 1440×900 screen. | 8 |
| O2 | Canvas toolbar | Eight icon-only buttons, no visible labels; several icons (sliders, wand, grid) are ambiguous. | 6 |
| O3 | Tutorial coach | At 1280×720 the coach covers the Battery element the tutorial talks about. | Tutorial: don't block |
| O4 | Sidebar | Tab names differ by project kind ("Create Nodes / Show Views" vs "Metamodels / Diagram Views"), likewise "Model Rules" vs "Instance Rules". | 4 |
| O5 | Wording | "Node", "element", "type" and "Object" are used for overlapping things ("Configure Node", "Create Nodes", "Add a new type"). | 2, 4 |
| O6 | Sidebar palette | Only 3–5 of 7 types visible without scrolling; no cue that more are below. | 6, 8 |
| O7 | Project list | Greeting uses the username: "Good to see you, local." | 2 |
| O8 | Element editor | Attributes are headed "Attribute 1/2" instead of their names; the "Inherit" button gives no hint what it does. | 6 |
| O9 | Save button | The button label shows state ("No Changes") rather than the action. | 1, 4 |
| O10 | Tutorial coach | Step text is set larger than the lesson text around it; the orange "This happens in …" line reads like a warning. | 8 |

## Findings from the drone tutorial walk-through

_To be filled with your notes._

## Done
