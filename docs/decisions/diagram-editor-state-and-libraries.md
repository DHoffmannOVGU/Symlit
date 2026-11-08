---
name: Diagram editor state and libraries
description: Why the diagram editor keeps React Flow, moves its state into a per-diagram Zustand store, why ELK was not adopted for Auto Layout, and which options are parked for later.
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
- **SysML v2 textual notation export (and maybe import).** Symlit already uses SysML v2 vocabulary
  (`partdef`, `actiondef`, metamodel/instance ≈ definition/usage). Export would make models
  diffable and connect to SysML v2 tools and the Systems Modeling API. Keep the store's model
  data separate from its on-screen form so an exporter stays easy to add.

**How to apply:** new editor state goes into the diagram store, not into `DiagramCanvas` props.
Revisit the library choice only if routing or performance needs exceed what React Flow plus a
layout engine can do.

## ELK evaluated for Auto Layout (2026-11): not adopted

ELK's layered algorithm (elkjs 0.12) was compared with the current dagre layout on the sample
diagrams in `client/src/components/flow/utils/layout-samples.ts`, with each element's four side
handles given to ELK as fixed-side ports. Measured with `layout-metrics.ts` (relationships as
straight lines between handles) and checked with screenshots:

| Diagram | dagre: crossings / facing handles | ELK (fixed sides) | ELK (free sides, handles re-attached) |
| --- | --- | --- | --- |
| Drone system (tree + side links, 13 elements) | 3 / 14 of 15 | 0 / 15 of 15 | 0 / 15 of 15 |
| Process chain (side to side, 6) | 0 / 4 of 6, one row | 0 / 5 of 6, diagonal staircase | 0 / 6 of 6, one column |
| Random mix (all handle sides, 15) | 14 / 5 of 22 | 18 / 7 of 22 | 6 / 22 of 22, tall and narrow |

**Why not adopted:** Symlit's diagrams use "relationships between side handles keep elements in
one row"; ELK's layered algorithm cannot express that and turns side links into diagonal
staircases, which looked worse than dagre's rows in every screenshot despite fewer crossings.
ELK's real advantage, orthogonal routing around elements, would also need the relationship
renderers to draw ELK's bend points. It costs a 1.6 MB lazy chunk.

**What did help:** re-attaching each relationship to the sides of its elements that face each other
after layout (possible since handles work in both directions). On top of dagre it made every
relationship's handles face each other in all samples, shortened lines by 20–27 % and removed a
crossing or two, while keeping rows. Decision: it is part of Auto Layout (one click
for a clean diagram), see `attachToFacingSides` in `autolayout.ts`.

**Revisit ELK when** relationships should be routed around elements (bend points), or for large
diagrams where crossing minimisation matters more than rows. `autolayout-quality.test.ts` keeps
dagre's current quality as a floor.
