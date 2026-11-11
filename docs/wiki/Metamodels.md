# Metamodels

A metamodel defines the types and relationships that models can be built from.

## Types

On the **Add elements** tab, click a kind to place a new type in a free spot, or drag it to
where you want it. The kinds are:

Object · Behavior · Concern · Performer · Need · Event · Capability

When you create the metamodel you choose its purpose, which decides the kinds and
relationships offered in the palette.

Double-click a type to edit it:

- **Attributes:** named values, with a unit from the unit catalog or a derived formula.
- **Style:** icon, colour, shape and border.

Elements of the type start from both.

## Relationships between types

Drag from a side handle of one type to another to draw a relationship:

Association · Aggregation · Composition · Generalization · Dependency · Realization

A relationship between two types defines which relationships are **allowed between their
elements** in a model.

**Generalization** is inheritance: a specialised type inherits the attributes, style and
allowed relationships of the general one.

## Model rules and pattern libraries

A metamodel can carry [model rules](Patterns-Rules-and-Validation) and a library of
[patterns](Patterns-Rules-and-Validation) for the models that use it.

## The AI assistant

With a Gemini API key configured, the [AI metamodel assistant](AI-Assistant) can propose
types and relationships for you to review.
