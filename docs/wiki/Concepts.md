# Concepts

Symlit uses one vocabulary throughout: **element, type, relationship, diagram**.

| Term | Meaning |
| --- | --- |
| **Metamodel** | A project that defines the *types* and the *relationships allowed between them*. |
| **Model** | A project built from elements typed by one or more metamodels it references. (In the code and API this is an `instance` project.) |
| **Type** | An element of a metamodel, for example "Sensor" or "Requirement". Each type has a *kind*. |
| **Kind** | The built-in category of a type: Object, Behavior, Concern, Performer, Need, Event or Capability. |
| **Element** | A thing in a model, typed by a type from a referenced metamodel. |
| **Relationship** | A typed connection between two elements: Association, Aggregation, Composition, Generalization, Dependency or Realization. |
| **Attribute** | A named value on a type (with an optional unit or derived formula); elements fill in the values. |
| **Diagram** | A view of a project. An element is stored once per project and can appear in several diagrams. |
| **Pattern** | A saved selection of elements and relationships that can be inserted again. |
| **Model rule** | A condition that tags elements or reports issues when it holds. |

## How the pieces fit

1. In a **metamodel**, you create types and draw relationships between them. A relationship
   between two types means: elements of these types may be connected this way.
2. In a **model**, you reference one or more metamodels. The palette then offers their types,
   and Symlit checks every relationship you draw against what the metamodel allows.
3. **Validate** checks the model against the metamodel and your model rules and lists what to fix.

Elements belong to the project, not to a diagram: renaming an element or changing its
attributes changes it in every diagram it appears in.
