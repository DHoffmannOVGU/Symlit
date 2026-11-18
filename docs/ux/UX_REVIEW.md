# UI/UX review

The principles the interface is judged against, the words it uses, and what is still open. Fixed
findings are in the [changelog](../../CHANGELOG.md) and the git history.

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
- **Miller / chunking:** 6 lessons, short steps, grouped toolbar sections.
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

## Vocabulary

One word per concept in everything a user reads (labels, tooltips, help, tutorial):

- **element**: anything placed on a diagram. In a metamodel its elements are **types**; built-in kinds are Object,
  Behavior, Concern, Performer, Need, Event and Capability.
- **relationship**: a connection between two elements.
- **diagram**: never "view" (the code and API still say view).
- Sidebar, the same in both project kinds: **Add elements** and **Diagrams** tabs, **Model rules** and
  **Export Project** below, **All projects** at the bottom.

## Open

- **Element editor focus.** Clicking the Name field once did not focus it, so the name could not be changed;
  later it worked. Not reproduced since (opened by double-click). Watch for it, and note what was open just
  before (a menu, the tutorial's Show me, the table).
- **Auto-save default.** Two levels of saving (an editor's Apply, then the diagram's Save; the rules panel has
  its own). Auto-save is a setting, off by default; whether it becomes the default is still to decide.
- The remaining interface items are in [`docs/BACKLOG.md`](../BACKLOG.md) under Client.
