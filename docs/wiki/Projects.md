# Projects

The project list (`/projects`) shows every metamodel and model, when each was last edited, and
can be sorted.

## Creating a project

**New project** asks in two steps:

1. **What to start from:** an empty metamodel, an empty model, or a template.
2. **Only what applies:** name and description; for a metamodel its purpose (which kinds and
   relationships it uses); for a model the metamodel it is based on.

Empty projects get a first diagram called **Main** and open on it.

A metamodel card also offers **New model from this metamodel**.

## Templates

Templates are example projects you can start from. A template can bring its metamodel along;
the confirmation names the metamodels it will create. Templates use the same JSON format as
the [export](Import-and-Export).

## Duplicate

Duplicating a project copies its elements, relationships and diagrams. A duplicated model
keeps using the same metamodels as the original.

## Import

**Import** on the project list opens a JSON export as a new project. See
[Import and export](Import-and-Export).

## Deleting

Deleting a metamodel warns you about the models that use it.
