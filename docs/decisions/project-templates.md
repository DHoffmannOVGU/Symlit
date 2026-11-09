---
name: Project templates
description: What a project template is, the project file format it uses, and how importing works
---

**Naming.** *Project templates* are what new projects are created from
(examples, the tutorial). *Patterns* are reusable model snippets inside
projects (see `patterns.md`). "Starter projects" is no longer used.

**Decisions (2026-11):**
- A project template is a **bundle**: a main project plus the metamodels it
  references (directly or through other metamodels), with their patterns.
  The tutorial (a metamodel and a model typed by it) is an ordinary template.
- Templates use **the project file format, which is the JSON export**: an
  export with its referenced metamodels and patterns can be used as a
  template, and a template file is a valid export. An optional `template`
  block names the template (`id`, `name`, `description`, `listed`).
- **Clone and own, origin recorded:** every project created from a template
  stores the template's id (`projects.template_id`); later changes to the
  template never reach it.
- Built-in templates are files in `server/templates/`. Saving projects as
  templates, user template files and a template library come in v0.2.

## Format (`shared/project-file.ts`)
`{ template?, export: { version: 1 }, project, views, patterns?, referencedMetamodels?: [{ project, views, patterns? }] }`.
Ids in a file only connect things within the file. Reading ignores fields
it does not need (an export carries database details such as `createdAt`).

## Requirements
Built-in templates (`server/project-templates.test.ts`, `e2e/project-templates.spec.ts`)
- **T1** Listed templates are offered with their project type, name, and
  included metamodels; the tutorial's template is not listed.
- **T2** Each creation makes new projects with fresh ids.
- **T3** Every created project records the template id.
- **T4** The main project's name, description and (for metamodels) setup
  can be chosen; otherwise the template's are used. The template decides the
  project type; only "Blank project" (no template) lets you choose it.
- **T5** The tutorial is created from the `tutorial` template; its model is
  fully typed by the new metamodel.
- **T6** An unknown template is refused and creates nothing.

Importing a project file (`server/services/project-import.ts`)
- **F1** All projects of the bundle are created in one transaction;
  metamodel references and element types (`mm:<project>:<element>`) point at
  the new projects and elements.
- **F2** Metamodel elements placed in an instance diagram become the new
  metamodel's elements.
- **F3** Model rule targets are rewired like types.
- **F4** An element shown in several diagrams stays one element, with its
  own position in each diagram.
- **F5** Patterns come along, also those of the metamodels.
- **F6** Copies of a pattern in the file keep pointing at the imported
  pattern; origins pointing outside the file are dropped.
- **F7** A broken file (a reference or element outside the file, a
  relationship to an element outside its diagram, an unknown version) is
  refused as a whole: nothing is saved.
- **F8** Exporting a project with its metamodels and patterns and importing
  the file gives the same model.

## Not done yet (v0.2)
- Saving a project as a template, template files from users, a template
  library (structure to be decided).
- An "Import project file" action in the UI (the importer exists).
