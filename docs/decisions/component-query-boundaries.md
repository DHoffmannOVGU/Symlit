---
name: Component query boundaries
description: A durable rule for extracting React Query-backed presentation components without leaking unstable API response shapes.
---

When extracting a presentational child from a query-owning parent, keep React Query and API response details in the parent. Pass the child a small, explicit view model and callbacks, and normalize nullable or untyped payloads at that boundary.

**Why:** API responses may be nullable or wider than the canonical UI model. Exposing the raw query result makes extracted components tightly coupled to transport details and causes type drift.

**How to apply:** Use explicit child prop contracts for loading/error state, canonical arrays, and user actions. Cast or validate only at the parent-to-child boundary, never by weakening the shared diagram types globally.