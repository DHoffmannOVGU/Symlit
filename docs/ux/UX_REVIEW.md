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
| O11 | Canvas | An element near the top edge puts its edit/copy/delete bar over the canvas toolbar. | 8 |
| O12 | Sidebar (instance) | Types in the Metamodels palette can only be dragged; clicking does nothing, unlike the metamodel palette where a click places the element. | 4, 7 |
| O13 | Canvas | Opening an instance diagram whose typed elements were stored without their type's style marks it as changed ("Save Diagram" enabled) because the style is filled in on load. Seen with API-created diagrams. | 1 |
| O10 | Tutorial coach | Step text is set larger than the lesson text around it; the orange "This happens in …" line reads like a warning. | 8 |

## Findings from the drone tutorial walk-through

| # | Where | Finding | Status |
| --- | --- | --- | --- |
| F1 | Element editor | Clicking the Name field sometimes did not focus it, so the name could not be changed; later it worked. | Not reproduced (focus worked in 3 of 3 automated tries, opened by double-click). Watch for it; note what was open just before (a menu, the tutorial's Show me, table view). |
| F2 | Element editor | Icon and colour appeared twice and took up much of the panel. | Fixed: the style section rendered under both tabs. |
| F3 | Element editor | In the demo project the Type list showed every built-in type twice: "Object (Default)" and again as "Object". | Fixed: the built-ins were listed twice, with the same value. |
| F5 | Element card | Requirements engineers need the description on the card as much as the name: show it per element/type, and handle long text. | Done (see below). |
| F6 | Vocabulary | Rename the built-in kind "Requirement" to "Need", leaving room for requirement types defined in a metamodel. | Done (see below). |
| F7 | Element editor, attributes | Units are free text; the description is hidden behind an icon; a new attribute is not focused; every property is editable inline. A type's attributes reach instances only through an unexplained "Inherit" button. | Done (see below). |
| F4 | Element editor, Styling | Show only the current colour and icon; open the choices on click. Offer more styling than colour and icon, as relationships already do (thickness, line style, arrows, path). | Done (see below). |

## Done
- O12: clicking a type in an instance model's Metamodels palette (or pressing Enter/Space on it) places an element in the
  middle of the canvas, as in metamodels; dragging still places it where it is dropped.
- F7: attributes are listed in short form (name, type, description, value; values editable in place on instance elements).
  Adding or editing one opens a small editor (name focused, description visible, unit picker over a catalog grouped by
  quantity, `shared/units.ts`; custom units allowed and marked). Cancel restores the attribute. New typed elements get
  copies of their type's attributes (`client/src/lib/type-attributes.ts`); elements missing some are offered them.
  The Inherit button remains only as "Copy from parent…" for untyped elements with a Generalization parent.
- F6: the built-in kind "Requirement" is called "Need". Stored diagrams are read with the new name
  (`currentKindLabel` in `shared/metamodel-setup.ts`): metamodel elements of the kind and untyped instance elements;
  instance elements typed by a metamodel type that someone named "Requirement" keep that name.
- F5: "Description" in the Styling tab (Canvas setting / Show / Hide) overrides the canvas-wide "Show node descriptions" per
  element, and is part of the type's style, so a Need type can show the description on every requirement. Cards
  show descriptions on several lines (up to 8, up to 300 px wide); in a resized card the text fits the box. Text that does not
  fit gets smaller (name 18 to 11 px, description 12 to 9 px), then is cut after whole lines with "…"; the full text is the
  tooltip (`client/src/lib/fit-text.ts`).
- F4: the Styling tab shows a live preview, the current icon and colour as buttons that open their pickers, and new
  settings: border width and style, shape (square, rounded, pill), fill (plain, tint, solid) and the type label.
  "Match type styling" covers all of them. The rules live in one module, `client/src/lib/element-style.ts`
  (unit tests in `element-style.test.ts`); the metamodel-to-instance round trip is tested in `e2e/element-style.spec.ts`.
  Typed elements created by drag, click or the relationship menu now get the type's whole style, not just icon and colour.
- F2: the icon and colour pickers rendered under both the Content and Styling tabs (`NodeStyleTab` was not inside a `TabsContent`).
- F3: instance projects without a metamodel listed each built-in type twice in the element editor's Type menu.
