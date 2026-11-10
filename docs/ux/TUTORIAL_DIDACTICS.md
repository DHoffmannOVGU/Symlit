# Guided tutorial: didactic review and improvement plan

## Status

Steps 1 to 3 of the plan below are built; the review that follows describes the tutorial as it was
before (7 lessons, 15 steps) and is kept as the reasoning behind the redesign.

| Plan | State |
| --- | --- |
| Step 1: fix the content that misleads | Done. |
| Step 2: give the tutorial a problem to solve | Done: the question "Can the drone Courier X1 fly the city route?", Pack B without a capacity, the rule that finds it, a rule the learner writes, inserting the pattern, six lessons. |
| Step 3: check outcomes and support thinking | Done, with the differences listed below. |
| Step 4: test it with learners | Open. Nobody from the intended audience has gone through it yet; the targets at the end of this document are unverified. |

Where the result differs from the plan:

- **Steps of a later lesson wait** until that lesson is reached, instead of completing early and being
  marked "already done". What was built in the meantime counts on arrival; a button pressed early
  (Table, Validate) has to be pressed again in its lesson.
- **"Show me" was kept for the hard steps by pointing at the element to work on** (the card to open, the
  field to fill in). There are no looping illustrations. Steps of the last lesson have no "Show me".
- **Only the whole tutorial can be reset** ("Start the tutorial over" recreates both projects). A single
  lesson cannot be reset on its own.
- **Per-step records** (when a step was done, hints and "Show me" used) are stored with the progress in
  the browser's local storage (`symlit_tutorial:<project id>`); the end screen shows the duration and the
  number of hints. There is no export of these records yet.
- **Found on the way:** the coach was hidden behind the element editor, so steps inside the editor could
  not be read while doing them. It now moves to the bottom left while an editor, the rules panel, the
  validation results or the table is open. The old step "pick a relationship such as Composition" described
  a choice the metamodel editor does not offer when drawing a relationship; the new text says what happens.

## The second tutorial: Production with PPR

`shared/tutorial-ppr.ts` and `server/templates/tutorial-ppr.json`. Where the basics tutorial teaches
the tool, this one teaches a method with it, and assumes the basics: its steps say what to achieve,
not where to click.

**The structure it follows.** PPR describes production with three kinds of things that are kept
apart: products (what is made), processes (what is done) and resources (what does it). The metamodel
*PPR types* has exactly these relationships: a Product goes into a Process, a Process produces a
Product, a Resource executes a Process. Product, Process and Resource are specializations of *PPR
element*, so that one relationship, drawn by the learner, lets any of them satisfy a Requirement.

**The requirements analysis** runs through all lessons rather than being a lesson of its own:

| # | Lesson | Requirements view | PPR view |
| --- | --- | --- | --- |
| 1 | Product, process, resource | | read one complete step: product in, process, product out, resource |
| 2 | Start from the requirements | state a requirement with a criterion; trace it to the product | |
| 3 | Derive the process | a product requirement leads to a process | a process is defined by what goes in and what comes out |
| 4 | Check completeness | a rule finds requirements nothing satisfies | a rule the learner writes finds processes nobody executes |
| 5 | Assign the resource | | process and resource are separate, so each can change alone |
| 6 | Close the last gap | take one open requirement through product, process and resource, unguided | |

**Design choices, and their reasons.**

- The order is requirement, product, process, resource: the order in which an engineer derives one
  from the other, not the order of the letters in PPR.
- The model starts incomplete in two ways. Nothing produces the Bracket (lessons 3 and 5 fix that),
  and nothing satisfies *Corrosion protection* (reported from lesson 4 on, and left open on purpose
  as the unguided task of lesson 6).
- The rules are about relationships, not values, which the basics tutorial did not cover. The
  learner's rule is written before the resource is assigned, so that it visibly reports Bending and
  then visibly stops doing so.
- Checks ask for the PPR direction: a trace from the requirement to the product, or a process
  pointing at the product that should go into it, does not complete a step.
- In lesson 6 either the coated product or the coating process may satisfy the requirement. Both
  are defensible, and the check accepts both.

**Limits.** The rule *Every requirement is satisfied* counts any incoming relationship, also one
the metamodel does not allow; validation reports such a relationship separately. Capabilities
(matching what a process needs with what a resource can do) and numeric process requirements are
named at the end as next steps, not taught. Like the basics tutorial, it has not been tried with
learners.

## Scope of the review

The guided tutorial (7 lessons, 15 steps) as it was defined in `shared/tutorial.ts`, its two
projects in `server/templates/tutorial.json`, and the coach in `client/src/components/tutorial/`.
`docs/ux/UX_REVIEW.md` already covers the tutorial as an interface (placement, wording, not blocking
the canvas). This review asks a different question: **what does a learner know and can do
afterwards, and how does the tutorial make sure of it?**

Basis: reading the lesson text, the template content, the completion logic and the browser test.
The tutorial was not run with real learners; step 4 of the plan closes that gap.

## Verdict

The tutorial is a good *feature tour* and a weak *lesson*. It gets someone to click through the
main controls in the real interface, which is the right format. But it checks that a control was
touched, not that anything was understood or built, and its three most important ideas (types
versus elements, validation, model rules) are stated in text that is collapsed by default and are
never demonstrated. A learner can reach "You know your way around Symlit" without having read a
concept, seen a validation issue, or produced a model that differs from the starting one.

## What already works

- Learning by doing in the real interface, on a small, concrete, likeable example (a delivery drone).
- The order follows the real workflow: metamodel first, then a model typed against it.
- Each lesson has a "why"; steps are short; "Show me" points at the control.
- Skippable, resumable, collapsible; progress is visible. Drag steps offer a click alternative.
- The drone example reuses the same names in both projects, so the type/element link is visible.

## Findings

Ordered by how much they limit learning.

### A. Completion measures clicks, not outcomes

1. **Steps complete on a signal, whatever the result.** Any element dropped in the metamodel
   completes "Add a new type"; any relationship completes "Relate two types"; opening the rules
   panel completes "Open the model rules" (`applySignal` in `client/src/lib/tutorial-progress.ts`).
   Nothing checks that the Camera exists, has an attribute, or is connected to the Drone.
2. **The first lesson completes without the learner doing or reading anything.** Starting the
   tutorial opens the metamodel (step 1 done), and one press of "Show me" opens the model (step 2
   done). The lesson that introduces the central distinction is over in one click.
3. **Steps tick off out of order and across lessons.** Pressing Table during lesson 2 completes a
   lesson 5 step. That is forgiving, but the step is then marked done before its lesson's "why" was
   ever shown, and the learner never returns to it.
4. **Skipping counts as doing.** Skipped steps fill the progress bar and lead to the same end
   screen, which says "You defined types, built a typed model, checked it…" even if every step was
   skipped (the browser test reaches it exactly that way).

### B. The key concepts are told, not shown

5. **Validation never finds anything.** The starting model is valid and the learner is steered
   towards a valid addition, so "Run validation and read the result" shows "No issues found". The
   learner does not see what an issue looks like, how it leads to an element, or how to fix it.
6. **Model rules are opened, not used.** The template has no rules (`"modelRules": []`). The lesson
   text mentions "every Battery needing a capacity" as an example, but no such rule exists, none is
   created, and none fires.
7. **The type-to-element link is not experienced.** After adding a Camera type with a `resolution`
   attribute, the learner inserts a Camera element but is never asked to look at it or give
   `resolution` a value. That attributes arrive on the element is the payoff of lessons 2 and 3, and
   it is only mentioned inside an optional hint.
8. **A claim and a hint contradict each other.** Lesson 2 says "Changing a type once updates every
   model that uses it"; its hint says "New elements of this type get a copy of its attributes".
   What actually happens to existing elements (style follows, attributes are copied, there is an
   Inherit dialog) needs one correct sentence, and ideally a step that shows it.
9. **"Reuse structures" does not reuse.** The lesson ends once a pattern is saved; it is never
   inserted, so the benefit stays hypothetical.
10. **There is no question the model answers.** The learner is never told why one would model a
    drone at all. Without a purpose ("can Courier X1 fly the city route on Pack A?"), validation,
    rules, units and attributes are features rather than tools.

### C. Sequencing and step design

11. **The Camera is never named.** "Add a new type" says the Object "will become a Camera", but no
    step asks the learner to rename it. Lesson 3 then refers to "your new Camera", which may be
    called "Object" on the learner's screen.
12. **One step holds four actions.** "Give it an attribute" asks to open the editor, add an
    attribute, choose a unit and save the editor. This breaks the project's own rule of one action
    per step, and it is the hardest step in the tutorial.
13. **Two kinds of saving meet unexplained.** "Save the editor" is followed by "Save the metamodel".
    The UX review lists this as a known source of confusion (R1); the tutorial walks straight into
    it without a word.
14. **The hardest steps have no "Show me" target.** Opening the editor, drawing a relationship
    between types and connecting elements have no highlight; "Show me", the primary button, then
    does nothing visible. The easy steps (Save, Export) are the ones with highlights.
15. **Lessons are uneven.** 2, 4, 3, 2, 2, 1 and 1 steps. Lessons 6 and 7 are single clicks; the
    "about 15 minutes" promise is hard to reconcile with several one-click lessons.
16. **Conceptual text is hidden.** The "why" is cut to two lines behind "More", and hints are behind
    a button, while "Show me" is the prominent action. The design rewards clicking over reading.

### D. Vocabulary and concept load

17. **Three levels, never laid out.** Symlit has built-in *kinds* (Object, Behavior…), user-defined
    *types* (Drone, Battery) and *elements* (Courier X1). The tutorial says "drag an Object" to "add
    a new type" without saying an Object is a kind. Delivery is a Behavior; why is not explained.
18. **Terms arrive before experience.** Lesson 1 opens with "metamodel", "instance models",
    "vocabulary of a domain" in one sentence, before the learner has seen either diagram.
19. **Relationship kinds are picked blind.** The learner is told to pick "a relationship such as
    Composition" with no reason to prefer it over Association, although the template itself uses
    both ("powered by", "performs") and could explain the difference with them.

### E. No consolidation or transfer

20. **No stated goals, no recap, no check.** Lessons do not say what the learner will be able to
    do, and nothing looks back. There is no moment of retrieval (not even one question).
21. **No unguided task.** Every action is prescribed. The learner never has to decide anything, so
    the tutorial cannot tell (and neither can the learner) whether the workflow has been understood.
22. **The end points nowhere specific.** "Start your own project" opens a blank project. There is
    no bridge: no suggested first exercise, no pointer to templates, help or the features the
    tutorial left out (several diagrams per project, flow mode, derived formulas, generalization).
23. **No way back to a clean start.** "Go through it again" clears progress but keeps the modified
    projects, and nothing helps a learner who deleted or broke something mid-way.

## Improvement plan

Four steps, each shippable on its own. Steps 1 and 2 are mostly content; step 3 changes the coach.

### Step 1: fix the content that misleads (small, text and template only)

| Change | Addresses |
| --- | --- |
| Add an explicit step "Name it Camera" after adding the type. | 11 |
| Split "Give it an attribute" into: open the editor; add `resolution` with a unit; save the editor. Say once that the editor's save keeps the element and the diagram's Save stores the diagram. | 12, 13 |
| Add a step in lesson 3: open the new Camera element and give `resolution` a value. Move the "elements get a copy of the type's attributes" sentence from the hint into the instruction. | 7 |
| Correct the lesson 2 "why" so it matches what really happens to existing elements. | 8 |
| Introduce kind, type and element in lesson 1 with the drone names ("Object is a kind, Drone is a type, Courier X1 is an element"). Say why Delivery is a Behavior. | 17, 18 |
| Explain Composition versus Association with the two relationships already in the template. | 19 |
| Show the "why" in full for the current lesson; keep "More/Less" only for lessons being browsed. | 16 |
| Make the end screen honest: list what was done, and name skipped steps with a way to go back to them. | 4 |

### Step 2: give the tutorial a problem to solve (template and lesson content)

The model should start slightly wrong, so that checking it finds something.

- **A guiding question** on the start card and in lesson 1: *"Can Courier X1 fly the city route?"*
- **A seeded flaw and a seeded rule.** Ship the template with a second battery ("Pack B") whose
  `capacity` is empty, and one model rule "Every Battery needs a capacity". Lesson 4 becomes:
  predict (will the model pass?), validate, read the issue, follow it to Pack B, fill in the value,
  validate again and see it pass. This is the single most valuable change. (5, 6, 10)
- **Write one rule.** After seeing the seeded rule fire, the learner adds a second one for their own
  type ("Every Camera needs a resolution"). (6)
- **Insert the pattern.** "Reuse structures" continues: insert the saved pattern to add a second
  drone with its battery. (9)
- **Rebalance.** Fold "Share your work" into the last lesson and aim for 3 to 4 steps per lesson. (15)

Suggested outline after steps 1 and 2:

| # | Lesson | The learner can afterwards… |
| --- | --- | --- |
| 1 | Types and elements | tell a kind, a type and an element apart, and find each on screen |
| 2 | Define a type | add a type, name it, give it an attribute with a unit, relate it to another type |
| 3 | Build a typed model | insert an element of a type, fill in its values, connect it |
| 4 | Check your model | run validation, read an issue, fix it, and write a simple rule |
| 5 | Read and reuse | switch between diagram and table, tidy the layout, save and insert a pattern |
| 6 | On your own | add a Charger type and one Charger element without step-by-step instructions, then export |

### Step 3: make the coach check outcomes and support thinking (code)

- **Outcome checks instead of click signals.** Let a step declare a condition on the model ("a type
  named Camera exists", "it has at least one attribute", "a relationship connects Drone and
  Camera", "validation ran with no issues") next to, or instead of, its signal. The tutorial test
  then asserts real results rather than skipping to the end. (1, 21)
- **Lesson 1 needs a real action.** Replace auto-completion with something the learner does, for
  example clicking Courier X1 and finding its type on the card. (2)
- **Out-of-order steps.** Keep accepting them, but when the learner later reaches that lesson, show
  its "why" and mark the step "already done" instead of silently passing over it. (3)
- **Skipped is not done.** Separate count and colour in the progress bar; offer "go back to skipped
  steps" at the end. (4)
- **One line of debrief per step.** After a step completes, show what just happened in the model
  ("Camera elements will now start with a resolution attribute"). This is where understanding is
  built; today the only feedback is a tick. (B in general)
- **"Show me" for the hard steps.** Highlight the connection handle, the element to double-click,
  the Add attribute button; where a selector cannot do it, a short looping illustration. Offer the
  hint before "Show me" so the learner tries first. (14, 16)
- **One recall question per lesson**, optional, single choice ("Where do you add a property every
  drone should have? In the type / in the element"). (20)
- **Reset and recovery.** "Go through it again" recreates the two projects; a "Reset this lesson"
  restores its starting state. (23)
- **A better ending.** Summary of what was built, the answer to the guiding question, and three
  concrete next steps: start from a template, the features not covered (several diagrams, flow
  mode, derived formulas, generalization) with links to help, and a blank project. (22)

### Step 4: test it with learners

- Watch 3 to 5 people from the intended audience (students or engineers new to MBSE) go through the
  tutorial thinking aloud; note where they stall, press "Show me" without trying, or skip.
- Afterwards, give an unguided transfer task in a blank project ("model a bicycle with two wheel
  types and check that every wheel has a diameter") and a five-question concept check.
- Log locally, per step: time, hints opened, "Show me" used, skipped. Review after each round.

Targets for calling the revision a success:

- At least 4 of 5 learners complete the unguided task in lesson 6 without help.
- At least 4 of 5 can explain the difference between a type and an element in their own words.
- Skip rate under 10% for every step; no step where more than half need "Show me".
- Median duration between 15 and 25 minutes.

## Order and effort

| Step | Touches | Effort | Value |
| --- | --- | --- | --- |
| 1 | `shared/tutorial.ts`, `TutorialCoach.tsx` (why text, end screen) | about a day | removes the misleading parts |
| 2 | `server/templates/tutorial.json`, `shared/tutorial.ts`, a few new signals, the browser test | 2 to 3 days | turns the tour into a lesson |
| 3 | coach, progress logic, per-step conditions, reset endpoint | about a week | makes completion mean something |
| 4 | no code beyond local logging | 2 to 3 sessions | tells us whether it worked |

Steps 1 and 2 give most of the benefit and do not depend on step 3. Step 4 should run once after
step 2 and again after step 3.
