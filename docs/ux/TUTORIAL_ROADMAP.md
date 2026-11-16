# Guided tutorials: roadmap

What to build next for the guided tutorials: which tutorials, which concepts each has to cover,
what the app has to be able to do first, and the checklists a step, a lesson and a whole tutorial
have to pass. The reasoning behind the two existing tutorials is in `TUTORIAL_DIDACTICS.md`.

## Basis and its limits

- A feature inventory of the app, made by reading the code, the browser tests and the wiki, and
  compared with every step of both tutorials. Three areas were inventoried in depth: attributes
  and formulas, building a metamodel, building a model. So was the tutorial system itself.
- The other areas (diagrams, patterns, rules and tags, canvas editing and style, table and export,
  projects) were only spot-checked. Their rows below are less certain and are marked *(spot check)*.
- The formula evaluator was run to confirm its syntax and its errors. Apart from that, nothing in
  the inventory was tried in a running browser; statements about what is reachable in the UI come
  from the code.
- No learner has gone through any tutorial yet.

## 1. Where the tutorials are today

| Tutorial | Example | Teaches |
| --- | --- | --- |
| Symlit basics | Delivery drone | the tool: types and elements, attributes, typed models, validation, a rule on a value, table view, auto layout, patterns, export |
| Production with PPR | Shelf bracket | a method: product, process, resource, requirements traced to what satisfies them, a rule on relationships |

Both only *mention* several things without letting the learner do them: the seven kinds, units,
default values, relationship kinds and names, Generalization, tags, CSV export, several diagrams,
undo, deleting a relationship.

## 2. What no tutorial practises

**Teachable now, with small additions to the tutorial system**

- Attribute types other than Number: Text, Yes/No, Date, List with options.
- Units from the catalog, and default values on a type.
- Derived attributes: a formula, references in `[ ]`, a formula that builds on another formula,
  the calculated value, what an invalid formula looks like.
- A type's attributes and formulas reaching new elements, and "add the missing attributes" for
  elements that existed before.
- A rule on a calculated value.
- Naming a relationship, choosing its kind, reversing its direction.
- Drawing a Generalization, and choosing among several allowed relationships in a model.
- Creating an element by dragging a relationship onto empty canvas.
- Rules that tag instead of reporting, conditions on Yes/No and List values, condition groups
  (all / any). *(spot check)*
- Editing values in the table view, filtering the table, CSV export. *(spot check)*
- Giving a type a style that its elements follow.

**Teachable only after the tutorial system or the app changes**

- Several diagrams and one element shown in two of them: the coach always opens a project's first
  diagram, does not know which diagram is open, and can only check the open one.
- Rules defined in a metamodel for every model built from it: a template cannot ship such a rule
  for one type today (the importer does not rewire it).
- Anything on the project list (templates, duplicating a project, import): the coach exists only
  inside a diagram.
- A model that uses two metamodels: a tutorial is exactly one metamodel and one model.

**Not teachable, because the feature is not there**

| Feature | State |
| --- | --- |
| Adding up values across elements (total mass of the parts, total cycle time) | does not exist; a formula sees only its own element |
| Attributes inherited along a Generalization | not implemented; only the allowed relationships are inherited. The wiki says otherwise |
| Flow mode (stepping through behaviour) | in the code and in the README, but nothing in the UI switches it on |
| Elements nested inside elements | stored, but no way to do it in the UI |
| A metamodel that builds on another metamodel | no control to set the reference |
| Changing which kinds and relationship kinds a metamodel offers after creating it | the create dialog promises it; no screen does it |
| Multiplicity and "mandatory part" being checked | notation only; validation ignores both |

## 3. Tutorials to include

Six in total: the two that exist and four new ones. Each new one has its own example and is built
around concepts the others do not practise.

| # | Tutorial | Example and question | Main concepts | Depends on |
| --- | --- | --- | --- | --- |
| 1 | Symlit basics *(exists)* | Delivery drone: can it fly the city route? | the tool | |
| 2 | Production with PPR *(exists)* | Shelf bracket: can the workshop produce it? | PPR, requirements tracing | 1 |
| 3 | **Calculate with attributes** | 3D-printing service: which print job loses money? | attribute types, units, formulas, calculated values, rule on a calculated value | 1 |
| 4 | **Classify and review** | Parts of a control cabinet: which parts need a second supplier? | tags, conditions on Yes/No and List, condition groups, rules for every model, editing in the table, CSV export | 1 |
| 5 | **Structure and views** | Espresso machine: what does replacing the pump affect? | relationship kinds and names, Generalization, several diagrams, one element in two diagrams | 1 |
| 6 | **Reuse and variants** | Sensor node family: how is the second variant built in a tenth of the time? | templates, duplicating, pattern libraries, a second metamodel, import, type styles | 1, 5 |

Not included: a behaviour tutorial around flow mode, and a layered-metamodel tutorial. Both wait
for the features in the table above.

### 3. Calculate with attributes

The tutorial asked for explicitly. The calculation has to live inside one element, because a
formula cannot see other elements; a quote for a print job does: every number belongs to the job.

- **Start:** a metamodel with the type *Print job* (mass, print time, price) and a model with three
  jobs, one of which loses money without anyone having noticed.
- **Lessons**
  1. *Attributes have types.* Read and fill in a number with a unit, a list (material), a Yes/No
     (rush order).
  2. *A first formula.* On the type: machine cost = `[print time] * [machine rate]`. References,
     the unit of the result, the calculated value.
  3. *Formulas build on formulas.* Material cost, then total cost from both. Predict what happens
     when a referenced attribute is renamed or deleted, then see it.
  4. *From the type to the elements.* A new job arrives with the formulas; the three old jobs are
     offered the missing attributes; each calculates its own result. Compare them in the table.
  5. *Let the model answer.* margin = `[price] - [total cost]`, and a rule: margin less than 0
     reports an issue. Validate, find the job, correct its price, see the margin follow.
  6. *On your own.* Add the energy cost to the total without step-by-step instructions.
- **The app has to do first**
  - Recalculate derived values whenever an input changes. Today the stored result only changes
    when the element's editor is applied: after an edit in the table, and for a new element, the
    table, the rules and the export show an old value.
  - Fix the formula bug with a minus sign after `*` or `/` (`2 * -3` gives -3).
  - Stop a division by an empty value from blocking the whole editor.
  - Describe the formula syntax in the help dialog; it is documented nowhere.
- **The tutorial system has to carry:** an attribute's type, unit, formula and calculated value.

### 4. Classify and review

- **Start:** a metamodel with *Part* (lead time, single source Yes/No, criticality as a list) and a
  model of a control cabinet with a dozen parts.
- **Lessons:** a tag instead of an issue (lead time over 60 days is tagged *Long lead*); conditions
  on Yes/No and List; two conditions combined (single source **and** critical is tagged *Risk*);
  the same rule moved into the metamodel so that every cabinet model gets it; correcting values in
  the table and filtering it; exporting the parts list as CSV for the review; unguided: a third tag.
- **Depends on:** the importer rewiring rules that target a type; tags and a rule's outcome in the
  tutorial state.

### 5. Structure and views

- **Start:** a metamodel whose setup offers Composition and Generalization, and a model with one
  diagram, *Structure*.
- **Lessons:** read a product structure; name a relationship and choose its kind, and reverse one
  drawn the wrong way; draw a Generalization (Pump and Heater are Components) and use it; add a
  second diagram, *Water path*, and place existing elements in it; rename the pump in one diagram
  and find it renamed in the other, which answers the question; unguided: the grinder and its
  diagram.
- **Depends on:** the coach handling several diagrams; relationship kind and name in the tutorial
  state; a fix in the importer (an element that appears in several diagrams of a template loses
  data); the decision on attribute inheritance (see section 6).

### 6. Reuse and variants

- **Lessons:** start a project from a template; duplicate it for a variant; insert a pattern from
  the metamodel's library; add a second metamodel to the model; give a type a style its elements
  follow; export and import the variant.
- **Depends on:** a tutorial with more than two projects, the coach on the project list, and a way
  to author pattern libraries. The largest piece of groundwork, so it comes last.

## 4. Concepts and where each is practised

P = the learner does it and the result is checked. m = only mentioned. An empty cell = not touched.

| Concept | 1 Basics | 2 PPR | 3 Calculate | 4 Classify | 5 Structure | 6 Reuse |
| --- | --- | --- | --- | --- | --- | --- |
| Kind, type, element | P | P | | | P | |
| Metamodel and model, saving in two steps | P | P | | | | |
| Number attribute, value on an element | P | P | P | P | | |
| Unit, default value | m | | P | | | |
| Text, List, Yes/No, Date attributes | | | P | P | | |
| Formula, references, calculated value | | | P | | | |
| A type's attributes and formulas reach its elements | P | | P | | | |
| Draw a relationship, direction matters | P | P | | | P | |
| Name a relationship, choose its kind, reverse it | m | m | | | P | |
| Generalization | | m | | | P | |
| Choose among several allowed relationships | | | | | P | |
| Validate, read and fix an issue | P | P | P | P | | |
| Rule on a value | P | | P | P | | |
| Rule on relationships | | P | | | | |
| Tag, condition groups, Yes/No and List conditions | m | | | P | | |
| Rule in a metamodel for every model | | | | P | | |
| Table view: read / edit and filter | P / | | P / | / P | | |
| Auto layout | P | | | | P | |
| Several diagrams, one element in two | m | m | | | P | |
| Pattern: save and insert / library | P / | | | | | / P |
| Export: project file / CSV / import | P / m / | | | / P / | | / / P |
| Template, duplicate, second metamodel, type style | | | | | | P |
| A model answers a question | P | P | P | P | P | P |
| Work without step-by-step instructions | P | P | P | P | P | P |

Every concept in the first column is practised at least once across the six, and the ones a
modeller needs daily (attributes, relationships, validation, rules) come back in a second example.

## 5. Checklists

### A step is worth having when

- [ ] It asks for **one result**, named as a result ("Bending has a cycle time"), not as a click.
- [ ] The learner has to **do or decide** something. Nothing completes on arrival.
- [ ] Completion is **checked on the model**. The check accepts every correct way of getting there
      and rejects the typical wrong one (wrong direction, wrong element, empty value).
- [ ] It introduces **at most one** new concept or one new skill, and uses what the step before left.
- [ ] The instruction says **where** (project, diagram), **what** and **with which values**, in at
      most three sentences, with the **labels the app shows today**.
- [ ] The **hint** helps to think (why, or which way round) before "Show me" points.
- [ ] "Show me" points at the element or control to use, and that control is **not covered** by the coach.
- [ ] The text shown afterwards says **what changed in the model and why it matters**, and is true
      for every way the check accepts.
- [ ] The **typical mistake** is named, with the way back (reverse, delete, undo).
- [ ] It is **needed for the question** the tutorial answers. Otherwise it goes.
- [ ] A browser test does it the right way and **one wrong way**.

### A lesson is worth having when

- [ ] Its goal is a **capability**: "Afterwards you can …".
- [ ] Its reason connects to the tutorial's **question**, not to a feature.
- [ ] It has **three to five** steps, and they form one piece of work.
- [ ] Somewhere the learner **predicts, then sees** (will validation pass? what will the formula give?).
- [ ] It ends with **one question about the concept**, not about a button, and every wrong answer
      gets an explanation that names the misunderstanding.
- [ ] It starts from a **defined state** and leaves the model in a state the next lesson can use.

### A tutorial is worth having when

- [ ] It has **one question**, asked at the start and answered by the model at the end.
- [ ] Its **example is its own**: another domain than the other tutorials, small, and familiar
      enough to need no explanation.
- [ ] The model **starts incomplete or wrong** in a way the learner finds and repairs.
- [ ] Support **fades**: a worked example to read, guided steps, then a last lesson with only the
      result given.
- [ ] It introduces **no more than about six** new concepts, and says what it assumes.
- [ ] It practises **at least three concepts** no other tutorial practises (section 4).
- [ ] **Every sentence is true** of the app as it is, and none relies on a feature with a known fault.
- [ ] Skipped steps **do not count** as done, and the end says what was and was not practised.
- [ ] The end names **what it left out** and points to the next tutorial.
- [ ] It takes **30 minutes or less**, measured with learners, not estimated.
- [ ] One browser test **walks the whole tutorial**; unit tests cover its checks.
- [ ] **Three to five people** from the audience have done it while thinking aloud, and at least
      four of five complete the last, unguided lesson without help.

### The set of tutorials is worth having when

- [ ] Every concept a modeller needs is **practised somewhere**; the daily ones **twice, in
      different examples**.
- [ ] The order is clear: what each tutorial assumes is taught by an earlier one.
- [ ] No two tutorials use the same domain.
- [ ] The project list offers six tutorials **without filling the screen**.
- [ ] A finished tutorial stays marked as finished after its projects are removed.

## 6. Next steps

**Done with this document (on the branch, not yet on `main`)**

- The undo history was lost after saving a diagram that contained a new element. This is what made
  the browser check on `main` fail. Fixed, with a unit test, and the browser test now waits for the
  reload instead of passing by luck.
- Nine steps of the two tutorials told the learner to press "Save Changes"; the button is called
  "Apply". Corrected, together with the claim that Generalization inherits attributes.

**Decisions needed before building**

1. **Adding up across elements.** Mass and cost budgets are the classic use of calculated
   attributes in systems engineering, and they need a sum over parts. Build it (then tutorial 3
   can grow a seventh lesson, or tutorial 5 gets a budget), or keep formulas inside one element?
2. **Attributes along a Generalization.** Implement the inheritance the wiki describes, or correct
   the wiki? Tutorial 5 teaches whichever is true.
3. **Flow mode.** Make it reachable (then a behaviour tutorial is worth planning), or take it out
   of the README until it is?
4. **The examples** in section 3: print jobs, control cabinet, espresso machine, sensor nodes.

**Then, in this order**

| Step | What | Rough size |
| --- | --- | --- |
| 1 | Tutorial-system groundwork: attribute type, unit, formula and calculated value, relationship kind and name, tags and rule outcome in the state; save steps that also accept Ctrl+S; checks tightened to what the texts claim; a compact tutorial list on the project list; completion remembered | 2 to 3 days |
| 2 | App fixes for tutorial 3 (recalculation, the minus bug, division by an empty value, formula help), then **tutorial 3** | 3 to 4 days |
| 3 | Importer fix for rules that target a type, then **tutorial 4** | 2 to 3 days |
| 4 | The coach across several diagrams, the importer fix for shared elements, then **tutorial 5** | 4 to 5 days |
| 5 | Tutorials with more than two projects, the coach on the project list, then **tutorial 6** | about a week |
| 6 | A first round with learners after step 2, a second after step 4 | 2 to 3 sessions each |

The sizes are estimates. Steps 1 and 2 give the tutorial that was asked for; steps 3 and 4 close
most of the remaining gaps in section 4.

## Known weaknesses of the tutorial system

Found while mapping it; step 1 above addresses the first five.

- Saving with Ctrl+S, or with "Save and leave", does not complete a "save" step.
- A "save" step completes when the save is requested, not when it succeeded.
- Several checks are looser than the text that follows them. The basics rule step accepts any
  issue rule that mentions *range*, and the next text then states that 18 km covers 15 km.
- A skipped earlier step takes the next matching action, so the learner has to validate twice.
- Progress is stored under the metamodel project's number. After the database is reset, numbers
  repeat and a new run starts with old progress.
- Each tutorial takes about 200 px of the project list before it is started.
- "Show me" for a field assumes the attribute is the first in the list.
