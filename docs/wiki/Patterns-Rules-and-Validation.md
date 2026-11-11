# Patterns, rules and validation

## Patterns

A pattern is a reusable snippet of elements and relationships.

- **Save:** select two or more elements and save the selection as a pattern.
- **Insert:** pick the pattern and insert it into a diagram; you get new copies of its elements.
- **Libraries:** a metamodel can ship patterns for the models that use it.

## Model rules

A model rule has a condition. When it holds for an element, the rule either **tags** the
element or **reports an issue**. Rules are defined in the rules panel and run when you validate.

## Validation

**Validate** checks:

- that every element has a type from a referenced metamodel,
- that every relationship is allowed between the types of its two ends,
- your model rules.

The results appear in a panel beside the canvas, so you can fix things while the list stays open.

The server applies the same checks when saving: elements and relationships that do not fit
the stored format are refused with a message rather than stored.
