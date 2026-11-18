# Metamodels

A metamodel defines the types and relationships that models can be built from.

## Types

On the **Add elements** tab, click a kind to place a new type in a free spot, or drag it to
where you want it. The kinds are:

Object · Behavior · Concern · Performer · Need · Event · Capability

When you create the metamodel you choose its purpose, which decides the kinds and
relationships offered in the palette.

Double-click a type to edit it:

- **Attributes:** named values of eight kinds: Text, Number (with a unit from the unit catalog),
  Yes/No, Date, List (one choice from options), Multiselect (any number of choices from options),
  Derived Formula and Related Formula (both calculated, see below). The value given on a type is the default each new
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

## Calculated over related elements

An attribute of the kind **Related Formula** is calculated over the elements this one is related
to. It reads as it means:

```
count(of "consists of")
sum([mass] of "consists of")
sum([mass] of "consists of" where [status] = "released")
max([lead time] of incoming "supplies" where [critical] = yes and [lead time] > 30)
[mass] + sum([total mass] of "consists of")
```

- `count`, `sum`, `avg` (or `average`), `min` and `max`, then `of` and which related elements:
  `of "name"` follows relationships of that name to the elements they lead to, `of incoming
  "name"` to the elements they come from, `of all` takes every related element (`of all
  outgoing`, `of all incoming`). Names are matched in any case.
- Inside the parentheses, attributes are those of the related element; outside, those of this
  one. What is added up can be calculated: `sum([mass] * [quantity] of "consists of")`.
- `where` keeps some related elements: an attribute, `type` or `name` compared with a number, a
  text in quotes or yes/no, with `=`, `!=`, `<`, `>`, `<=`, `>=`, `contains`, `is set` and `is not
  set`, combined with `and`, `or` and parentheses. It compares as a model rule does.
- One step only. For a total over several levels, the related elements read their own Related
  Formula, as in the last example; a circle is reported.
- The relationships of **all diagrams** of the project count, each once, with the open diagram as
  it is now (unsaved changes included). That is unlike model rules' conditions on connected
  elements, which look at the open diagram.
- Over no related elements, `count` and `sum` give 0 and `avg`, `min` and `max` are *not
  calculated yet*. Related elements without the attribute do not take part; one whose value is
  still empty makes the result not calculated yet.
- References are linked, as in a Derived Formula: a renamed attribute or relationship keeps working and
  shows by its new name. This element's own attributes are always linked. Inside an aggregate, a
  reference is linked when the related elements share the attribute, because they got it from one type
  (or from a type it specializes). A relationship's name is linked when it stands for one relationship
  of the metamodel: a model's relationship records which metamodel relationship it was made from when
  Symlit's suggestion is used, and older ones are linked once when Symlit starts. Anything else is
  matched by name; the editor says so. On a type, the metamodel's relationships tell which types an
  aggregate reaches, including a type related to itself ("Part consists of Part").
- The editor shows which related elements it used and how many a `where` left out, and offers this
  element's relationships to insert. A Derived Formula can use a Related Formula of its element.

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
