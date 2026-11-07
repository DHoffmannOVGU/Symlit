# Metamodel-to-instance quality findings

Date: 2026-08-31

## Scope

This verification covers the connection between metamodel projects and instance
projects using deterministic local fixtures and mocked HTTP responses. It does
not call Gemini, external projects, or production data.

## Traceable test matrix

| Area | Scenarios covered | Verification |
| --- | --- | --- |
| Flow contracts | Normalization, malformed geometry, duplicate IDs, orphan endpoints, persisted record shape | Existing flow tests; browser reload fixture |
| Metamodel setup | Legacy defaults, configured node/relation vocabularies, setup normalization | `client/src/lib/metamodel-setup.test.ts`, relationship tests |
| Reference identity | Canonical `mm:<projectId>:<nodeId>` IDs, metadata, duplicate local IDs across projects | `metamodel-reference-resolution.test.ts` |
| Reference traversal | Nested references, cycles, duplicate references, malformed lists, missing projects | `metamodel-reference-resolution.test.ts` |
| Type resolution | Local fallback types, referenced type palette, typed instance IDs | Existing relationship tests and browser journey |
| Relationship resolution | Referenced relationship endpoints, inherited relationships, invalid type/label combinations | Utility and model-validation tests; existing relationship browser coverage |
| Persistence | Selected metamodel IDs, flow sync, persisted node type IDs and edges | Browser journey with mocked PATCH/POST/GET |
| Reload | Reload retains typed nodes and saved relationship | `metamodel-instance.spec.ts` |
| Failure behavior | Unavailable referenced project is visible and does not silently expose fallback types | `metamodel-instance.spec.ts` |
| Validation | Missing node types, unknown type IDs, missing edge endpoints, unsupported relations, invalid labels | `client/src/lib/model-validation.test.ts` |

## Findings

### Medium — unavailable references could disappear silently (fixed)

**Impact:** An instance project could retain a referenced metamodel ID that was
no longer present in the user's project list. The selector count could still
show a selected metamodel, while the sidebar received no referenced project,
making the failure look like an empty or fallback palette and leaving the user
without a clear way to remove the stale reference.

**Reproduction:** Load an instance project with `referencedMetamodels: [999]`
while `/api/projects/999` returns 404.

**Status:** Fixed. The workspace now retains a visible unavailable placeholder
for the selected reference, and the metamodel loader clears resolved type,
relationship, and rule state before a new load or after a load failure. The
browser test asserts the unavailable message and confirms built-in fallback
classes are not exposed.

**Recommended follow-up:** Consider a dedicated “remove unavailable reference”
action if the selector treatment becomes insufficient for larger projects.

### Low — validation previously ignored missing edge endpoints (fixed)

**Impact:** Programmatic validation did not report an edge whose source or
target node had disappeared. This could hide a structural problem until flow
persistence validation rejected it.

**Status:** Fixed. `validateInstanceModel` now reports the missing source and/or
target endpoint as an actionable edge issue.

## Passing areas

- Referenced types from different projects receive collision-resistant canonical
  IDs and retain source metadata.
- Nested reference cycles terminate without duplicate loading.
- Relationship matching honors type inheritance and configured relationship
  types.
- Invalid generated or persisted relationship labels are surfaced rather than
  accepted as valid.
- A user can select a metamodel, create two typed instances, create an allowed
  relationship, save, reload, and retain the type IDs and relationship.
- Legacy projects without references still use the built-in instance type
  fallback.

## Remaining test gaps

- The browser suite does not exercise a transient 500/network failure while a
  previously loaded referenced flow is being replaced; the pure loader-state
  behavior prevents stale state, but this specific network transition remains
  a useful future regression case.
- Browser coverage uses mocked API fixtures rather than a database-backed
  project created through the UI. Persistence contracts are covered at the
  service/unit layer and via mocked sync/reload requests.

## Verification baseline

- `npm run check` — passed
- `npm test` — passed, 47 tests
- `npm run test:e2e` — passed, 6 tests
- `npm run build` — passed

The build reports existing non-blocking warnings about stale Browserslist data
and large generated bundles; neither prevented the production build.