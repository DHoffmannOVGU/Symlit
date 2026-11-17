# Metamodels

A metamodel defines the types and relationships that models can be built from.

## Types

On the **Add elements** tab, click a kind to place a new type in a free spot, or drag it to
where you want it. The kinds are:

Object · Behavior · Concern · Performer · Need · Event · Capability

When you create the metamodel you choose its purpose, which decides the kinds and
relationships offered in the palette.

Double-click a type to edit it:

- **Attributes:** named values of seven kinds: Text, Number (with a unit from the unit catalog),
  Yes/No, Date, List (one choice from options), Multiselect (any number of choices from options)
  and Derived Formula (calculated, see below). The value given on a type is the default each new
  element starts with; a Multiselect starts with nothing chosen unless the type ticks some.
- **Style:** icon, colour, shape and border.

A new element of the type gets copies of its attributes and follows its style. Later changes to
the type's attributes do not reach existing elements; their editor offers to add attributes the
type gained. Later changes to the style reach every element that still matches its type.

## Calculated attributes

An attribute of the kind **Derived Formula** is calculated from other attributes of the same
element:

- numbers (written with a point, `0.5`), `+ - * /`, parentheses and minus signs (`2 * -3`);
- functions, their values separated by commas: `min`, `max`, `sum`, `avg` (or `average`) over
  any number of values, `round(x)` or `round(x, decimals)` (halves away from zero), `floor`,
  `ceil`, `abs` and `sqrt`. For example `max([price], 10)` or `round([mass] / 7, 1)`;
- other attributes in square brackets, by name: `[print time] * [machine rate]`. Typing `[`
  offers them. A formula can use another calculated attribute, but not itself.
- When an attribute it uses has no value yet, or it would divide by zero, the result is *not
  calculated yet*: it stays empty and nothing is blocked.
- Results follow their inputs wherever those are edited: in the editor, in the table, and for a
  new element of a type.
- Units are labels; nothing converts them. Grams to kilograms is `/ 1000` in the formula.
- A formula sees only its own element. `sum` adds up values of that element; there is no sum
  over other elements.

Model rules can test a calculated value like any other. The editor's **Help** lists the same.

## Relationships between types

Drag from a side handle of one type to another to draw a relationship:

Association · Aggregation · Composition · Generalization · Dependency · Realization

A relationship between two types defines which relationships are **allowed between their
elements** in a model.

**Generalization** is inheritance, drawn from the specialised type to the general one. A
specialised type inherits the general type's **allowed relationships** (an element of it may be
used wherever the general type is allowed) and its **attributes** (a new element gets them as
well as the specialised type's own; an attribute the specialised type defines itself wins). The
style is not inherited: each type has its own.

## Model rules and pattern libraries

A metamodel can carry [model rules](Patterns-Rules-and-Validation) and a library of
[patterns](Patterns-Rules-and-Validation) for the models that use it.

## The AI assistant

With a Gemini API key configured, the [AI metamodel assistant](AI-Assistant) can propose
types and relationships for you to review.
