---
name: Authentication session boundary
description: The server resolves the acting user; ids and names sent by the browser are never an authorization source.
---

Every API request is resolved to a user on the server before handlers run. In the local edition this is the single implicit local user (`server/auth.ts`). Ownership of the targeted project, view or node is then checked centrally by `authorizeWorkspaceApi()`. Usernames and user ids submitted by the browser are display or routing data only; for example, a new project is always owned by the resolved user, whatever `userId` the request body contains.

**Why:** The original MVP used a username stored in `localStorage` as identity, which let browser state impersonate another workspace. Keeping resolution and ownership checks on the server means future multi-user editions can plug in a different user resolver without touching handlers.

**How to apply:** Add new private APIs under `/api` so they pass through the central resolver and ownership middleware. Never authorize from client storage. Browser tests that mock the API mock `/api/auth/me` and `/api/config` explicitly (`e2e/support/local-session.ts`).
