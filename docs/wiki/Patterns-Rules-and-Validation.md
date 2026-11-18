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

### Writing a rule

A rule is one line of text: which elements it looks at, and when its outcome applies.

```
for Drone where [range] < 15
for Component where [single source] is true and [criticality] = "high"
for Process where none of incoming "executes"
for Assembly where all of "consists of" have [status] = "released"
for Print job where [price] < [total cost]
for Machine where count(of "consists of") < 2
```

- `for` a type, or `for all elements`. Without `where`, the rule applies to every element of the type.
- Attributes go in square brackets, texts in quotes; `name`, `description` and `type` are the element's own.
- Compare with `=`, `!=`, `<`, `>`, `<=`, `>=` or `contains`; check with `is set`, `is not set`,
  `is true`, `is false`. Combine with `and`, `or`, `not` and parentheses.
- Both sides of a comparison can be values or calculations in the formula language, including
  aggregates over related elements as in a Related Formula: `[mass] + sum([mass] of "consists of") > [max mass]`.
- Related elements are checked with `any of`, `all of` or `none of`, then the relationship as in a
  Related Formula (`"consists of"`, `incoming "executes"`, `all`, `all outgoing`), `where` to keep some of
  them, and `has` (or `have`) for what they must meet. `where` and `has` take one comparison; several go
  in parentheses: `has ([capacity] < 100 and [mass] > 1)`. An `and` after them is about the element itself
  again. `all of` needs at least one related element.

The rules panel builds the common cases with lists: a comparison of the element's own field with a value,
or "Incoming from · none · Resource · exists" for related elements, optionally by one relationship
("Incoming “executes” from"). The comparisons offered fit the attribute (numbers, yes/no, lists), and a
list attribute suggests its options. The text and the lists edit the same rule and always show it the same
way; a condition the lists cannot show (two values compared, a calculation, `not`) is edited as text. The
outcome (tag and colour, or issue, severity and message) is chosen in its lists.

Rules look at the relationships of **all diagrams of the project**, each once, like Related Formulas. Like a
formula, a rule stores the attributes, relationships and types it names by id where a name stands for one of
them, so it keeps working when they are renamed. Rules saved before rules had text are read as before and
are written as text when they are next changed.

On a Multiselect attribute a condition looks at the chosen options: *equals* holds when one of
them is the value, *contains* when one of them contains it, *is set* when at least one is chosen.
An element without the attribute only meets *is not set*.

A rule in a **metamodel** applies to every model built from it; in the model it is listed under
*Rules from metamodels* (as its text) and cannot be changed there. A rule in a model's diagram applies to
that diagram.

## Validation

**Validate** checks:

- that every element has a type from a referenced metamodel,
- that every relationship is allowed between the types of its two ends,
- your model rules.

A relationship drawn with Symlit's suggestion records which metamodel relationship it is. When that
relationship is renamed in the metamodel, saving the metamodel renames the models' relationships made
from it too; the confirmation says how many. A relationship renamed in a model is its own and keeps its
name.

The results appear in a panel beside the canvas, so you can fix things while the list stays open.

The server applies the same checks when saving: elements and relationships that do not fit
the stored format are refused with a message rather than stored.
