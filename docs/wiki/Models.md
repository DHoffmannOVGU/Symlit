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
one diagram, so each diagram can show a different aspect of the same model.

## Build and flow mode

- **Build mode** is for editing the model.
- **Flow mode** steps through the behavior of your model: mark a start and an end element,
  then run or step through the flow from the toolbar. The flow card shows progress, the
  current tick and the active elements.

## Checking the model

**Validate** checks elements and relationships against the metamodel and your model rules and
lists what to fix in a panel beside the canvas. See
[Patterns, rules and validation](Patterns-Rules-and-Validation).
