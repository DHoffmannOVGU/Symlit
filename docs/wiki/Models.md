# Models

A model is built from elements typed by the metamodels it references. A model can reference
more than one metamodel.

## Adding elements

The **Add elements** tab lists all types of the referenced metamodels at once, grouped and
searchable. Click a type to place an element of it, or drag it to where you want it.

Double-click an element to set its attribute values.

## Relationships

Drag from a side handle to another element, or onto empty canvas to create a new element
there. Symlit offers the relationships the metamodel allows between the two types.

## Several diagrams

A project can have several diagrams. An element is stored once and can appear in more than
one diagram, so each diagram can show a different aspect of the same model. To show an existing
element in the open diagram, open the **Diagrams** tab, list the elements of the diagram it is
in (the arrow next to the diagram's name) and press the arrow next to the element. Its name and
values are the same everywhere; its position and its relationships belong to each diagram.

## Several metamodels

The metamodel selector in the header (*1 Metamodel selected*) chooses which metamodels a model
uses. Each adds a group of types to the palette. A relationship between elements of two
metamodels is allowed when one of them defines it, for which it has to build on the other and
show its type.

## Checking the model

**Validate** checks elements and relationships against the metamodel and your model rules and
lists what to fix in a panel beside the canvas. See
[Patterns, rules and validation](Patterns-Rules-and-Validation).
