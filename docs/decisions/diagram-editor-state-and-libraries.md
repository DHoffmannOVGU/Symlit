---
name: Diagram editor state and libraries
description: Why the diagram editor keeps React Flow, moves its state into a per-diagram Zustand store, and which library and notation options are parked for later.
---

**Decision (2026-11):** keep React Flow (`@xyflow/react`) as the canvas library and move the
editor's own state (nodes, edges, selection, open panels, undo history) into one Zustand store
per open diagram, provided through React context.

**Why:** `DiagramCanvas.tsx` was ~1,300 lines although its logic was already split into hooks.
The size came from wiring: about 290 values were passed by hand between 20 hooks, and children
received 18–23 props each. A shared store lets each hook and panel read and write what it needs.
React Flow itself is built on Zustand and recommends the same pattern, so no new concept is added.

**Libraries considered and not chosen:**
- JointJS: strong ports and orthogonal routing, but not React-native; the useful parts are commercial (JointJS+).
- maxGraph (draw.io lineage): mature, UML shapes, but imperative SVG; all React element renderers would be rewritten.
- GoJS: excellent for modelling diagrams, commercial licence.
- Eclipse GLSP / Sprotty: built for modelling tools (incl. SysML editors), but a client/server architecture, i.e. a rewrite.
- tldraw: whiteboard-oriented, licence key required in production.

None of the problems found so far came from React Flow; its real gap for us is edge routing
(orthogonal lines around elements).

**Parked for later (see `docs/BACKLOG.md`):**
- **ELK (`elkjs`) for Auto Layout.** Understands ports with fixed sides (matching the four side
  handles) and routes edges orthogonally; could replace `dagre`, `entitree-flex` and the
  "side handles share a row" rule. ~1.5 MB, so lazy-load it when Auto Layout runs.
- **SysML v2 textual notation export (and maybe import).** Symlit already uses SysML v2 vocabulary
  (`partdef`, `actiondef`, metamodel/instance ≈ definition/usage). Export would make models
  diffable and connect to SysML v2 tools and the Systems Modeling API. Keep the store's model
  data separate from its on-screen form so an exporter stays easy to add.

**How to apply:** new editor state goes into the diagram store, not into `DiagramCanvas` props.
Revisit the library choice only if routing or performance needs exceed what React Flow plus a
layout engine can do.
