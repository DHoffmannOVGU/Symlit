---
name: AI proposal review boundary
description: Safety rules for AI-generated metamodel additions and their path into the diagram editor.
---

AI-generated metamodel output is an untrusted additions proposal, never a direct canvas mutation. The active vocabulary and current model must constrain generation, while the client review step must expose overlaps and invalid items before selection. Only the explicitly selected, structurally valid subset may cross into canonical diagram conversion.

**Why:** A valid provider response can still duplicate existing concepts, reference missing endpoints, or request relationship semantics that the configured metamodel does not support. Silent filtering makes user intent and model integrity hard to audit.

**How to apply:** Enforce vocabulary and endpoint checks server-side, keep review/filter logic pure and testable, default overlaps and invalid items out of the selection, and preserve the final apply as one additions-only undoable action.