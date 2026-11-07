---
name: React Flow custom data boundary
description: How to preserve diagram node and edge data types around React Flow's renderer registry.
---

Use canonical, generic-aware node and edge types throughout diagram state, helpers, and history. Treat the custom renderer registry as the one boundary where edge data needs a documented cast. Persisted flow payloads must also be runtime-validated at the API boundary, including finite node coordinates and edge endpoints that reference nodes in the same payload.

**Why:** React Flow's renderer registry exposes broad default renderer props even when application state uses a custom edge data generic. Letting that broad type spread into state causes variance errors and repeated unsafe casts.

**How to apply:** New canvas helpers should accept the canonical diagram types. Validate unknown persisted JSON while loading it, then keep it strongly typed inside the editor. Reject invalid payloads before mapping and show a non-destructive recovery state. Do not widen state back to default React Flow node or edge types just to satisfy renderer props.