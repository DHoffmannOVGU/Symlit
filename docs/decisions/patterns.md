---
name: Patterns
description: What patterns are, where they live, and the rules for saving and inserting them
---

**Naming.** *Patterns* are reusable model snippets. *Starter projects* are
the projects new users start from (tutorial, examples). The word "template"
is avoided in the product for now; code still says `project-templates` /
`templateId` for starter projects (to be renamed with the starter-project work).

**Decisions (2026-11):**
- Patterns are snippets of **instance-level** elements: one or more
  elements, with or without relationships between them.
- Instance projects have their own patterns; **metamodels can ship a library
  of patterns**, offered to every project that references the metamodel,
  directly or through other metamodels (the **whole chain**).
- **Clone and own:** saving copies the selection, inserting copies the
  pattern again. Copies are independent.
- Copies **record where they came from** (`data.pattern`:
  `patternId`, `projectId`, `elementId`, `insertionId`) so a pattern can
  later be re-applied.
- **Types must be known**: every type a pattern uses must be known where it
  is saved and where it is inserted; otherwise the request is refused.

## Requirements (tested in `server/patterns.test.ts`)

Capturing
- **C1** Any selection of one or more elements can be saved as a pattern.
- **C2** A relationship is included only when both ends are in the pattern;
  the server rejects relationships (and nesting) pointing outside it.
- **C3** Types, labels, descriptions, attribute values, relationship types,
  sides, labels and the relative layout are kept.
- **C4** A pattern is a copy: editing the source does not change it, and
  editing the pattern does not change the source.
- **C5** Nesting is kept; nested elements stay relative to their parent.
- A pattern saved from inserted copies is a new pattern (origins dropped).

Where patterns live
- **L1** A project's own patterns are usable in all its diagrams.
- **L2** Patterns of every metamodel in the reference chain are listed (with
  the metamodel's name) and can be inserted, but not edited, from the
  instance project. Patterns of unrelated projects cannot be inserted.
- **L3** Pattern elements are not part of the model (element lists, types,
  validation, exports of the model).
- **L4** Deleting a pattern keeps the copies already made from it.

Inserting
- **I1** Each insert is a new copy with new ids, recording its origin; one
  insertion id per insert.
- **I2** The copy is centred where it is inserted, keeping the layout.
- **I3** Inserting keeps unsaved edits and is one undo step: the server only
  builds the copy (`POST /api/views/:viewId/patterns/:patternId/instantiate`),
  the editor adds it to the open diagram and saves it with the diagram.
- **I4** Types must be known (see above); type definitions cannot be put in
  patterns. Patterns are inserted into instance models only.

## Not done yet (planned for v0.2)
- **Authoring patterns inside a metamodel.** The server accepts them; the
  editor has no instance-level pattern diagram in metamodels yet, so "Save
  Pattern" is only offered in instance projects.
- **Re-applying a pattern** to its copies (uses the recorded origin).
- **Import** of exported patterns (P1).
