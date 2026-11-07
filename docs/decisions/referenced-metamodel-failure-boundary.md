---
name: Referenced metamodel failure boundary
description: Product behavior for unavailable or failed referenced metamodel loading
---

An instance project’s saved metamodel reference is meaningful even when the
referenced project or flow cannot currently be loaded. Keep that reference
visible as unavailable so the user can understand and remove it; do not replace
it with built-in types or silently present an empty palette. Clear previously
resolved types, relationships, and rules before a new reference load completes
or fails.

**Why:** Filtering unavailable IDs out of the project list made a selected
reference look like an unexplained empty/fallback modeling vocabulary and could
leave stale types visible after a later load failed.

**How to apply:** Any future reference selector, project hydration, or
metamodel-loader change must preserve unresolved IDs in the user-visible state
and treat each load as a replacement of the prior resolved vocabulary.

React Query can retain a successful referenced flow when a project is removed
and re-added. Treat re-enabled referenced flows as stale and hide cached
palette data while they revalidate or report an error.

**Why:** A failed replacement otherwise leaves the previous classes looking
current even though the selected reference has not successfully loaded.

**How to apply:** Reference-flow queries should revalidate on re-enable, and
palette rendering should use fetching/error state rather than cached data alone.