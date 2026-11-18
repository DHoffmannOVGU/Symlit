# Patterns, rules and validation

## Patterns

A pattern is a reusable snippet of elements and relationships.

- **Save:** select two or more elements and save the selection as a pattern.
- **Insert:** pick the pattern and insert it into a diagram; you get new copies of its elements.
- **Libraries:** a metamodel can ship patterns for the models that use it.

## Model rules

A model rule has a condition. When it holds for an element, the rule either **tags** the
element or **reports an issue**. Rules are defined in the rules panel. Tags show on the cards
and in the table as long as the condition holds; issues are listed when you validate.

A condition compares a field of the element (its name, description, type or an attribute) or of
the elements a relationship leads to. Several conditions can be combined: **all** of them must
hold, or **any** of them.

On a Multiselect attribute a condition looks at the chosen options: *equals* holds when one of
them is the value, *contains* when one of them contains it, *is set* when at least one is chosen.

A rule in a **metamodel** applies to every model built from it; in the model it is listed under
*Rules from metamodels* and cannot be changed there. A rule in a model's diagram applies to that
diagram.

## Validation

**Validate** checks:

- that every element has a type from a referenced metamodel,
- that every relationship is allowed between the types of its two ends,
- your model rules.

A relationship drawn with Symlit's suggestion records which metamodel relationship it is. When that
relationship is renamed in the metamodel, the model's relationships drawn before keep their old label
and stay valid.

The results appear in a panel beside the canvas, so you can fix things while the list stays open.

The server applies the same checks when saving: elements and relationships that do not fit
the stored format are refused with a message rather than stored.
