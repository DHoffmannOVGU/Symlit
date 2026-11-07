---
name: Playwright edge visual assertions
description: How browser tests should verify React Flow relationship line styling.
---

React Flow edge line styles set through the renderer's `style` prop are exposed as computed CSS, while marker references remain SVG attributes. Assert dashed or solid lines with computed CSS and assert diamonds or triangles with marker attributes.

**Why:** Browser inspection showed `stroke-dasharray` was rendered in the inline style and normalized by Chromium to pixel values, so checking for an SVG attribute was brittle even though the line was visibly dashed.

**How to apply:** Use computed-style assertions such as `stroke-dasharray: 5px, 5px` for line patterns, and use the edge path's `marker-start` or `marker-end` URL plus the renderer class for relationship marker/type checks.