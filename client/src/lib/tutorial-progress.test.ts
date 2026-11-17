import assert from "node:assert/strict";
import test from "node:test";
import {
  TUTORIALS,
  tutorialSignals,
  tutorialSteps,
  type TutorialAttribute,
  type TutorialElement,
  type TutorialModelState,
  type TutorialRelationship,
  type TutorialRule,
  type TutorialRuleCondition,
} from "@shared/tutorial";
import { BASICS_TUTORIAL } from "@shared/tutorial-basics";
import { PPR_TUTORIAL } from "@shared/tutorial-ppr";
import * as progressOf from "./tutorial-progress";
import {
  answerQuestion,
  EMPTY_TUTORIAL_PROGRESS,
  noteHelpUsed,
  returnToSkipped,
  totalHelpUsed,
  tutorialMinutes,
  type TutorialProgress,
} from "./tutorial-progress";

// Most tests follow the basics tutorial; the functions are bound to it here.
const T = BASICS_TUTORIAL;
const TUTORIAL_LESSONS = T.lessons;
const TUTORIAL_STEPS = tutorialSteps(T);
type Rest<F> = F extends (tutorial: typeof T, ...rest: infer R) => unknown ? R : never;
const bind =
  <F extends (tutorial: typeof T, ...rest: never[]) => unknown>(fn: F) =>
  (...rest: Rest<F>) =>
    fn(T, ...(rest as never[])) as ReturnType<F>;
const applyModelState = bind(progressOf.applyModelState);
const applySignal = bind(progressOf.applySignal);
const closeRecap = bind(progressOf.closeRecap);
const countDone = bind(progressOf.countDone);
const currentLessonIndex = bind(progressOf.currentLessonIndex);
const currentStep = bind(progressOf.currentStep);
const isTutorialFinished = bind(progressOf.isTutorialFinished);
const lastCompletedStep = bind(progressOf.lastCompletedStep);
const normalizeTutorialProgress = bind(progressOf.normalizeTutorialProgress);
const pendingRecap = bind(progressOf.pendingRecap);
const skippedSteps = bind(progressOf.skippedSteps);
const skipStep = bind(progressOf.skipStep);
const stepState = bind(progressOf.stepState);

// --- a small model to check steps against ------------------------------------

/** An attribute as the tutorial sees it; a number unless said otherwise. */
const attribute = (name: string, value: string, extra: Partial<TutorialAttribute> = {}): TutorialAttribute => ({
  name,
  value,
  type: "number",
  unit: "",
  formula: "",
  references: [],
  options: [],
  ...extra,
});

const element = (
  id: string,
  name: string,
  type: string,
  attributes: Record<string, string> | TutorialAttribute[] = {},
  extra: Partial<TutorialElement> = {},
): TutorialElement => ({
  id,
  name,
  type,
  attributes: Array.isArray(attributes)
    ? attributes
    : Object.entries(attributes).map(([attributeName, value]) => attribute(attributeName, value)),
  tags: [],
  color: "",
  ownStyle: false,
  ...extra,
});

/** A relationship from one element to another; an unnamed Association unless said otherwise. */
const link = (from: string, to: string, kind = "association", name = ""): TutorialRelationship => ({ from, to, kind, name });

/** One comparison of a rule, about the element itself unless said otherwise. */
const condition = (extra: Partial<TutorialRuleCondition>): TutorialRuleCondition => ({
  about: "self",
  direction: "",
  quantifier: "",
  type: "",
  field: "attribute",
  attribute: "",
  operator: "equals",
  value: "",
  ...extra,
});

/** A saved rule that reports an issue unless said otherwise. */
const rule = (target: string, conditions: TutorialRuleCondition[], extra: Partial<TutorialRule> = {}): TutorialRule => ({
  reportsIssue: true,
  tag: "",
  target,
  attributes: conditions.map((candidate) => candidate.attribute).filter(Boolean),
  connected: conditions.some((candidate) => candidate.about === "connected"),
  conditions,
  combinator: "all",
  ...extra,
});

const model = (
  scope: TutorialModelState["scope"],
  elements: TutorialElement[],
  extra: Partial<TutorialModelState> = {},
): TutorialModelState => ({
  scope,
  diagram: "Main",
  diagrams: ["Main"],
  metamodels: [],
  elements,
  relationships: [],
  editingId: null,
  editingRelationship: null,
  tableFilter: "",
  rules: [],
  dirty: false,
  ...extra,
});

const startingTypes = [
  element("drone", "Drone", "Object", { mass: "", range: "" }),
  element("battery", "Battery", "Object", { capacity: "" }),
  element("delivery", "Delivery", "Behavior", { distance: "" }),
];
const startingModel = [
  element("x1", "Courier X1", "Drone", { mass: "4.2", range: "18" }),
  element("a", "Pack A", "Battery", { capacity: "160" }),
  element("b", "Pack B", "Battery", { capacity: "" }),
  element("route", "City route delivery", "Delivery", { distance: "15" }),
];

const step = (id: string) => {
  const found = TUTORIAL_STEPS.find((candidate) => candidate.id === id);
  assert.ok(found, `step ${id} exists`);
  return found;
};

/** Progress at the start of a lesson: everything before it done, questions left behind. */
function atLesson(lessonId: string): TutorialProgress {
  const index = TUTORIAL_LESSONS.findIndex((lesson) => lesson.id === lessonId);
  assert.ok(index >= 0, `lesson ${lessonId} exists`);
  const before = TUTORIAL_LESSONS.slice(0, index);
  return {
    ...EMPTY_TUTORIAL_PROGRESS,
    completed: before.flatMap((lesson) => lesson.steps.map((candidate) => candidate.id)),
    recapped: before.map((lesson) => lesson.id),
    startedAt: 1,
  };
}

// --- the definition ------------------------------------------------------------

for (const tutorial of TUTORIALS) {
  test(`${tutorial.id}: the tutorial definition is consistent`, () => {
    const steps = tutorialSteps(tutorial);
    const ids = steps.map((candidate) => candidate.id);
    assert.equal(new Set(ids).size, ids.length, "step ids are unique");
    assert.equal(new Set(tutorial.lessons.map((lesson) => lesson.id)).size, tutorial.lessons.length);
    assert.ok(ids.includes(tutorial.answerStep), "the step that answers the question exists");
    assert.ok(tutorial.question.endsWith("?") && tutorial.answer.length > 20 && tutorial.summary.length > 60);
    for (const lesson of tutorial.lessons) {
      assert.ok(lesson.steps.length >= 3, `${lesson.id} is more than a click`);
      assert.ok(lesson.goal.length > 20 && lesson.why.length > 40, `${lesson.id} says what it is for`);
      if (lesson.question) {
        assert.equal(
          lesson.question.options.filter((option) => option.correct).length,
          1,
          `${lesson.id} has exactly one right answer`,
        );
        assert.ok(lesson.question.options.every((option) => option.feedback.length > 10));
      }
    }
    for (const candidate of steps) {
      assert.ok(candidate.signal || candidate.check || candidate.checkProjects, `${candidate.id} can complete`);
      // A step on the project list is checked there; elsewhere a check of the project list means nothing.
      assert.equal(candidate.scope === "projects", !!candidate.checkProjects, `${candidate.id} is checked where it happens`);
      if (candidate.signal) assert.ok((tutorialSignals as readonly string[]).includes(candidate.signal), candidate.id);
      assert.ok(candidate.instruction.length > 20, `${candidate.id} explains what to do`);
      assert.ok(candidate.done.length > 20, `${candidate.id} explains what happened`);
    }
  });

  test(`${tutorial.id}: most steps check a result in the model, not only that a button was pressed`, () => {
    const steps = tutorialSteps(tutorial);
    const checked = steps.filter((candidate) => candidate.check || candidate.checkProjects).length;
    assert.ok(checked / steps.length >= 0.6, `${checked} of ${steps.length} steps check the model`);
  });
}

test("tutorials are told apart by their id and their template", () => {
  assert.equal(new Set(TUTORIALS.map((tutorial) => tutorial.id)).size, TUTORIALS.length);
  assert.equal(new Set(TUTORIALS.map((tutorial) => tutorial.templateId)).size, TUTORIALS.length);
});

// --- what counts as done ---------------------------------------------------------

test("starts at the first step of the first lesson, which nothing completes by itself", () => {
  assert.equal(currentStep(EMPTY_TUTORIAL_PROGRESS)?.id, TUTORIAL_STEPS[0].id);
  assert.equal(currentLessonIndex(EMPTY_TUTORIAL_PROGRESS), 0);
  assert.equal(countDone(EMPTY_TUTORIAL_PROGRESS), 0);
  // Arriving in the metamodel is not enough: the learner has to open the type.
  const arrived = applySignal(EMPTY_TUTORIAL_PROGRESS, "view-opened", "metamodel", model("metamodel", startingTypes), 5);
  assert.equal(countDone(applyModelState(arrived, model("metamodel", startingTypes), 5)), 0);
  const opened = applyModelState(arrived, model("metamodel", startingTypes, { editingId: "drone" }), 5);
  assert.deepEqual(opened.completed, ["open-type"]);
  assert.equal(opened.startedAt, 5);
});

test("a step completes when the model shows its result, whatever was clicked", () => {
  let progress = atLesson("define-type");
  // Any new type completes "add a type"; only one named Camera completes "name it".
  const withNewType = [...startingTypes, element("new", "New Object 4", "Object")];
  progress = applyModelState(progress, model("metamodel", withNewType));
  assert.deepEqual(progress.completed.slice(-1), ["add-type"]);
  assert.equal(currentStep(progress)?.id, "name-type");

  const withCamera = [...startingTypes, element("new", "camera", "Object")];
  progress = applyModelState(progress, model("metamodel", withCamera));
  assert.equal(stepState(progress, step("name-type")), "done");
  assert.equal(stepState(progress, step("add-attribute")), "current");

  // A relationship that runs the wrong way does not count.
  const cameraWithAttribute = [...startingTypes, element("new", "Camera", "Object", { resolution: "" })];
  progress = applyModelState(
    progress,
    model("metamodel", cameraWithAttribute, { relationships: [link("new", "drone")] }),
  );
  assert.equal(stepState(progress, step("add-attribute")), "done");
  assert.equal(stepState(progress, step("relate-types")), "current");
  progress = applyModelState(
    progress,
    model("metamodel", cameraWithAttribute, { relationships: [link("drone", "new")] }),
  );
  assert.equal(stepState(progress, step("relate-types")), "done");
});

test("a signal only completes its step when the model agrees", () => {
  // The validation that answers the question counts only with the learner's rule in the model.
  let progress = atLesson("check-model");
  for (const id of ["validate", "fix-issue", "validate-again"]) progress = { ...progress, completed: [...progress.completed, id] };
  const fixed = [...startingModel.filter((candidate) => candidate.id !== "b"), element("b", "Pack B", "Battery", { capacity: "160" })];
  const seeded = rule("Battery", [condition({ attribute: "capacity", operator: "missing" })]);
  const learners = rule("Drone", [condition({ attribute: "range", operator: "less-than", value: "15" })]);
  progress = applySignal(progress, "validation-passed", "instance", model("instance", fixed, { rules: [seeded] }));
  assert.equal(stepState(progress, step("answer-question")), "open");
  // Without knowing the model, nothing that depends on it completes.
  progress = applySignal(progress, "validation-passed", "instance", null);
  assert.equal(stepState(progress, step("answer-question")), "open");
  progress = applySignal(progress, "validation-passed", "instance", model("instance", fixed, { rules: [seeded, learners] }));
  assert.equal(stepState(progress, step("answer-question")), "done");
});

test("a save step counts once the work before it is done and the diagram is saved", () => {
  let progress = atLesson("define-type");
  const withCamera = [...startingTypes, element("new", "Camera", "Object")];
  // Saved early, before the attribute and the relationship exist: that save did not store them.
  progress = applyModelState(progress, model("metamodel", withCamera, { dirty: false }));
  assert.equal(stepState(progress, step("save-metamodel")), "open");
  for (const id of ["add-type", "name-type", "add-attribute", "relate-types"]) progress = skipStep(progress, id);
  // Unsaved changes, or the untouched metamodel, are not it.
  progress = applyModelState(progress, model("metamodel", withCamera, { dirty: true }));
  assert.equal(stepState(progress, step("save-metamodel")), "current");
  progress = applyModelState(progress, model("metamodel", startingTypes, { dirty: false }));
  assert.equal(stepState(progress, step("save-metamodel")), "current");
  // Saved, however the save was started (the button, Ctrl+S, automatic saving): done.
  progress = applyModelState(progress, model("metamodel", withCamera, { dirty: false }));
  assert.equal(stepState(progress, step("save-metamodel")), "done");
});

test("steps only complete in the project they belong to", () => {
  const progress = atLesson("define-type");
  const sameShapeInTheModel = [...startingModel, element("new", "Camera", "Object")];
  assert.equal(applyModelState(progress, model("instance", sameShapeInTheModel)), progress);
});

test("steps of a later lesson wait until that lesson is reached", () => {
  // Pressing Table during lesson 2 does not tick off lesson 5.
  const early = applySignal(atLesson("define-type"), "table-mode", "instance", model("instance", startingModel));
  assert.equal(stepState(early, step("table-mode")), "open");
  const inLesson = applySignal(atLesson("read-and-reuse"), "table-mode", "instance", model("instance", startingModel));
  assert.equal(stepState(inLesson, step("table-mode")), "done");
});

test("checking the model: the seeded gap has to be found, fixed and checked again", () => {
  let progress = atLesson("check-model");
  const withCamera = [...startingModel, element("cam", "Nose camera", "Camera", { resolution: "12" })];
  const before = model("instance", withCamera);
  // The fix does not count while Pack B has no capacity.
  assert.equal(applyModelState(progress, before), progress);
  progress = applySignal(progress, "validation-run", "instance", before);
  assert.equal(stepState(progress, step("validate")), "done");

  const fixed = withCamera.map((candidate) =>
    candidate.id === "b" ? element("b", "Pack B", "Battery", { capacity: "160" }) : candidate,
  );
  progress = applyModelState(progress, model("instance", fixed));
  assert.equal(stepState(progress, step("fix-issue")), "done");
  progress = applySignal(progress, "validation-passed", "instance", model("instance", fixed));
  assert.equal(stepState(progress, step("validate-again")), "done");
  // That clean validation was for the fix, not yet for the learner's own rule.
  assert.equal(stepState(progress, step("answer-question")), "open");

  // The seeded rule is not the learner's rule; a tag rule is not a check either.
  const seeded = rule("Battery", [condition({ attribute: "capacity", operator: "missing" })]);
  const lessThan15 = condition({ attribute: "range", operator: "less-than", value: "15" });
  const notYet = [
    rule("Drone", [lessThan15], { reportsIssue: false, tag: "Short range" }), // a tag is not a check
    rule("Drone", [condition({ attribute: "range", operator: "greater-than", value: "15" })]), // the wrong way round
    rule("Drone", [condition({ attribute: "range", operator: "less-than", value: "50" })]), // not the route's 15 km
    rule("Battery", [lessThan15]), // not about drones
  ];
  for (const candidate of notYet) {
    progress = applyModelState(progress, model("instance", fixed, { rules: [seeded, candidate] }));
    assert.notEqual(stepState(progress, step("add-rule")), "done");
  }
  const withRule = model("instance", fixed, { rules: [seeded, rule("drone", [lessThan15])] });
  progress = applyModelState(progress, withRule);
  assert.equal(stepState(progress, step("add-rule")), "done");
});

test("the unguided lesson asks for a saved, related, valued result", () => {
  let progress = atLesson("on-your-own");
  const charger = element("charger", "Charger", "Object", { power: "" });
  const related = { relationships: [link("charger", "battery")] };
  progress = applyModelState(progress, model("metamodel", [...startingTypes, charger], { ...related, dirty: true }));
  assert.equal(stepState(progress, step("own-type")), "current", "not saved yet");
  progress = applyModelState(progress, model("metamodel", [...startingTypes, element("charger", "Charger", "Object")], related));
  assert.equal(stepState(progress, step("own-type")), "current", "no attribute");
  progress = applyModelState(progress, model("metamodel", [...startingTypes, charger], related));
  assert.equal(stepState(progress, step("own-type")), "done");

  const chargerElement = element("c1", "Depot charger", "Charger", { power: "300" });
  const connected = model("instance", [...startingModel, chargerElement], { relationships: [link("c1", "b")] });
  assert.equal(stepState(applyModelState(progress, model("instance", [...startingModel, chargerElement])), step("own-element")), "current");
  progress = applyModelState(progress, connected);
  assert.equal(stepState(progress, step("own-element")), "done");
});

// --- skipping, questions, the end ---------------------------------------------

test("skipping moves on but does not count as done", () => {
  const first = TUTORIAL_STEPS[0];
  const skipped = skipStep(EMPTY_TUTORIAL_PROGRESS, first.id, 10);
  assert.equal(currentStep(skipped)?.id, TUTORIAL_STEPS[1].id);
  assert.equal(countDone(skipped), 0);
  assert.deepEqual(skippedSteps(skipped).map((candidate) => candidate.id), [first.id]);
  assert.equal(stepState(skipped, first), "skipped");
  assert.equal(skipStep(skipped, first.id), skipped, "skipping twice changes nothing");
});

test("a skipped step can still be done later, and all of them can be reopened", () => {
  let progress = skipStep(EMPTY_TUTORIAL_PROGRESS, "open-type");
  progress = applyModelState(progress, model("metamodel", startingTypes, { editingId: "drone" }));
  assert.equal(stepState(progress, step("open-type")), "done");
  assert.equal(skippedSteps(progress).length, 0);

  let all = EMPTY_TUTORIAL_PROGRESS;
  for (const candidate of TUTORIAL_STEPS) all = skipStep(all, candidate.id);
  for (const lesson of TUTORIAL_LESSONS) all = closeRecap(all, lesson.id);
  assert.ok(isTutorialFinished(all));
  const reopened = returnToSkipped(all);
  assert.ok(!isTutorialFinished(reopened));
  assert.equal(currentStep(reopened)?.id, TUTORIAL_STEPS[0].id);
  // The questions were left behind and do not come back.
  assert.equal(pendingRecap(reopened), null);
});

test("a lesson ends with its question; the next lesson starts once it is left behind", () => {
  let progress = EMPTY_TUTORIAL_PROGRESS;
  const first = TUTORIAL_LESSONS[0];
  for (const candidate of first.steps) progress = skipStep(progress, candidate.id);
  assert.equal(pendingRecap(progress)?.id, first.id);
  assert.equal(currentStep(progress), null);
  assert.equal(currentLessonIndex(progress), 0);
  // While the question is open, the next lesson's steps do not complete.
  const withNewType = [...startingTypes, element("new", "New Object 4", "Object")];
  assert.equal(applyModelState(progress, model("metamodel", withNewType)), progress);

  progress = answerQuestion(progress, first.id, 1);
  assert.equal(progress.answers[first.id], 1);
  assert.equal(pendingRecap(progress)?.id, first.id, "answering is optional and does not move on");
  progress = closeRecap(progress, first.id);
  assert.equal(pendingRecap(progress), null);
  assert.equal(currentLessonIndex(progress), 1);
  assert.equal(currentStep(progress)?.id, TUTORIAL_LESSONS[1].steps[0].id);
  // What was built in the meantime counts as soon as the lesson is reached.
  assert.equal(stepState(applyModelState(progress, model("metamodel", withNewType)), step("add-type")), "done");
});

test("finishing records how long it took and what help was used", () => {
  let progress = noteHelpUsed(noteHelpUsed(EMPTY_TUTORIAL_PROGRESS, "open-type", "hints"), "open-type", "showMe");
  progress = noteHelpUsed(progress, "add-type", "hints");
  assert.equal(totalHelpUsed(progress, "hints"), 2);
  assert.equal(totalHelpUsed(progress, "showMe"), 1);

  const start = 1_000_000;
  TUTORIAL_STEPS.forEach((candidate, index) => {
    progress = skipStep(progress, candidate.id, start + index);
  });
  assert.equal(tutorialMinutes(progress), null, "not finished while questions are open");
  for (const lesson of TUTORIAL_LESSONS) progress = closeRecap(progress, lesson.id, start + 12 * 60_000);
  assert.ok(isTutorialFinished(progress));
  assert.equal(currentStep(progress), null);
  assert.equal(currentLessonIndex(progress), TUTORIAL_LESSONS.length - 1);
  assert.equal(tutorialMinutes(progress), 12);
});

test("the explanation shown is that of the step completed last", () => {
  assert.equal(lastCompletedStep(EMPTY_TUTORIAL_PROGRESS), null);
  const progress = applyModelState(EMPTY_TUTORIAL_PROGRESS, model("metamodel", startingTypes, { editingId: "drone" }));
  assert.equal(lastCompletedStep(progress)?.id, "open-type");
});

test("stored progress is cleaned up when read back", () => {
  assert.deepEqual(normalizeTutorialProgress(null), EMPTY_TUTORIAL_PROGRESS);
  assert.deepEqual(normalizeTutorialProgress("nonsense"), EMPTY_TUTORIAL_PROGRESS);
  const first = TUTORIAL_STEPS[0].id;
  const second = TUTORIAL_STEPS[1].id;
  const lesson = TUTORIAL_LESSONS[0].id;
  assert.deepEqual(
    normalizeTutorialProgress({
      completed: [first, first, "removed-step", 7],
      skipped: [first, second],
      recapped: [lesson, "removed-lesson"],
      answers: { [lesson]: 2, "removed-lesson": 0, bad: "x" },
      collapsed: true,
      startedAt: 5,
      finishedAt: "later",
      usage: { [first]: { hints: 2, showMe: -1, doneAt: 9 }, "removed-step": { hints: 1 } },
    }),
    {
      completed: [first],
      skipped: [second],
      recapped: [lesson],
      answers: { [lesson]: 2 },
      collapsed: true,
      startedAt: 5,
      finishedAt: null,
      usage: { [first]: { hints: 2, showMe: undefined, doneAt: 9 } },
    },
  );
  // Progress stored by the earlier tutorial (other step ids) starts over cleanly.
  assert.deepEqual(
    normalizeTutorialProgress({ completed: ["open-metamodel", "add-type-old"], skipped: [], collapsed: false }),
    EMPTY_TUTORIAL_PROGRESS,
  );
});

// --- the PPR tutorial -----------------------------------------------------------

test("PPR: requirement, product, process and resource have to be connected the PPR way", () => {
  const P = PPR_TUTORIAL;
  const pprStep = (id: string) => {
    const found = tutorialSteps(P).find((candidate) => candidate.id === id);
    assert.ok(found, `step ${id} exists`);
    return found;
  };
  const stateOf = (progress: TutorialProgress, id: string) => progressOf.stepState(P, progress, pprStep(id));
  /** Progress at the start of a PPR lesson. */
  const at = (lessonId: string): TutorialProgress => {
    const index = P.lessons.findIndex((lesson) => lesson.id === lessonId);
    assert.ok(index >= 0, `lesson ${lessonId} exists`);
    const before = P.lessons.slice(0, index);
    return {
      ...EMPTY_TUTORIAL_PROGRESS,
      completed: before.flatMap((lesson) => lesson.steps.map((candidate) => candidate.id)),
      recapped: before.map((lesson) => lesson.id),
    };
  };
  const start = [
    element("r1", "Carries 5 kg", "Requirement", { criterion: "No lasting deformation", source: "Customer" }),
    element("r2", "Corrosion protection", "Requirement", { criterion: "No rust", source: "Customer" }),
    element("sheet", "Steel sheet", "Product", { material: "Steel" }),
    element("cut", "Laser cutting", "Process", { "cycle time": "20" }),
    element("blank", "Blank", "Product", { material: "Steel" }),
    element("laser", "Laser cutter", "Resource", { "hourly rate": "60" }),
    element("bracket", "Bracket", "Product", { material: "Steel" }),
  ];
  const chain = [
    link("sheet", "cut"),
    link("cut", "blank"),
    link("laser", "cut"),
  ];

  // Requirements: a new one needs a criterion, and a product that has to satisfy it.
  let progress = at("requirements");
  progress = progressOf.skipStep(P, progressOf.skipStep(P, progress, "relate-satisfies"), "save-metamodel");
  const vague = element("r3", "Mounting angle", "Requirement", { criterion: "", source: "" });
  progress = progressOf.applyModelState(P, progress, model("instance", [...start, vague], { relationships: chain }));
  assert.equal(stateOf(progress, "add-requirement"), "open", "a requirement without a criterion is not captured yet");
  const angle = element("r3", "Mounting angle", "Requirement", { criterion: "90 degrees", source: "" });
  // A trace that points from the requirement to the product is the wrong way round.
  progress = progressOf.applyModelState(
    P,
    progress,
    model("instance", [...start, angle], { relationships: [...chain, link("r1", "bracket"), link("r3", "bracket")] }),
  );
  assert.equal(stateOf(progress, "add-requirement"), "done");
  assert.equal(stateOf(progress, "trace-load"), "current");
  assert.equal(stateOf(progress, "trace-new"), "open");
  const traced = [...chain, link("bracket", "r1"), link("bracket", "r3")];
  progress = progressOf.applyModelState(P, progress, model("instance", [...start, angle], { relationships: traced }));
  assert.equal(stateOf(progress, "trace-load"), "done");
  assert.equal(stateOf(progress, "trace-new"), "done");

  // Process: defined by the product that goes in and the product that comes out.
  progress = at("derive-process");
  const bending = element("bend", "Bending", "Process", { "cycle time": "15" });
  const withBending = [...start, angle, bending];
  progress = progressOf.applyModelState(P, progress, model("instance", withBending, { relationships: [...traced, link("bend", "blank")] }));
  assert.equal(stateOf(progress, "add-process"), "done");
  assert.equal(stateOf(progress, "process-input"), "current", "the product goes into the process, not the other way");
  const produced = [...traced, link("blank", "bend"), link("bend", "bracket")];
  progress = progressOf.applyModelState(P, progress, model("instance", withBending, { relationships: produced }));
  assert.equal(stateOf(progress, "process-output"), "done");

  // Completeness: the learner's rule is about processes and relationships.
  progress = at("check-completeness");
  const nothingPointsAtIt = condition({ about: "connected", direction: "incoming", quantifier: "none", field: "name", operator: "exists" });
  const seeded = rule("Requirement", [nothingPointsAtIt]);
  const pprModel = (extra: Partial<TutorialModelState>) => model("instance", withBending, { relationships: produced, ...extra });
  const notYet = [
    rule("Process", [condition({ attribute: "cycle time", operator: "missing" })]), // a rule on a value
    rule("Process", [nothingPointsAtIt]), // any element pointing at it would do, not only a Resource
    rule("Process", [{ ...nothingPointsAtIt, type: "Resource", direction: "outgoing" }]), // resources execute processes, not the reverse
    rule("Resource", [{ ...nothingPointsAtIt, type: "Process" }]), // the opposite rule
  ];
  for (const candidate of notYet) {
    progress = progressOf.applyModelState(P, progress, pprModel({ rules: [seeded, candidate] }));
    assert.equal(stateOf(progress, "add-rule"), "open");
  }
  const withRule = { rules: [seeded, rule("process", [{ ...nothingPointsAtIt, type: "Resource" }])] };
  progress = progressOf.applyModelState(P, progress, pprModel(withRule));
  assert.equal(stateOf(progress, "add-rule"), "done");

  // Resource: it has to execute the process, not just exist.
  progress = at("assign-resource");
  const press = element("press", "Press brake", "Resource", { "hourly rate": "45" });
  progress = progressOf.applyModelState(P, progress, model("instance", [...withBending, press], { relationships: produced }));
  assert.equal(stateOf(progress, "add-resource"), "done");
  assert.equal(stateOf(progress, "assign-resource"), "current");
  const executedBending = [...produced, link("press", "bend")];
  progress = progressOf.applyModelState(P, progress, model("instance", [...withBending, press], { relationships: executedBending }));
  assert.equal(stateOf(progress, "assign-resource"), "done");

  // The last lesson: every process transforms and is executed, every requirement is traced.
  progress = at("close-the-gap");
  const coating = element("coat", "Powder coating", "Process", { "cycle time": "" });
  const coated = element("coated", "Coated bracket", "Product", { material: "" });
  const booth = element("booth", "Coating booth", "Resource", { "hourly rate": "" });
  const all = [...withBending, press, coating, coated, booth];
  const halfDone = [...executedBending, link("bracket", "coat")];
  progress = progressOf.applyModelState(P, progress, model("instance", all, { relationships: halfDone }));
  assert.equal(stateOf(progress, "own-process"), "current", "a process with nothing coming out is not finished");
  const transformed = [...halfDone, link("coat", "coated")];
  progress = progressOf.applyModelState(P, progress, model("instance", all, { relationships: transformed }));
  assert.equal(stateOf(progress, "own-process"), "done");
  assert.equal(stateOf(progress, "own-resource"), "current");
  assert.equal(stateOf(progress, "own-trace"), "open");
  const complete = model("instance", all, {
    relationships: [...transformed, link("booth", "coat"), link("coat", "r2")],
    ...withRule,
  });
  progress = progressOf.applyModelState(P, progress, complete);
  assert.equal(stateOf(progress, "own-resource"), "done");
  assert.equal(stateOf(progress, "own-trace"), "done");
  // Only a clean validation answers the question, and the answer is kept by saving.
  assert.ok(!progressOf.isTutorialFinished(P, progress));
  progress = progressOf.applySignal(P, progress, "validation-passed", "instance", { ...complete, dirty: true });
  assert.equal(stateOf(progress, "own-validate"), "done");
  progress = progressOf.applyModelState(P, progress, { ...complete, dirty: true });
  assert.ok(!progressOf.isTutorialFinished(P, progress), "not saved yet");
  // Saved, before or after validating: the answer is kept.
  progress = progressOf.applyModelState(P, progress, complete);
  assert.ok(progressOf.isTutorialFinished(P, progress));

  // The typical wrong ways do not count.
  const checkOf = (id: string) => pprStep(id).check!;
  const isNotSet = rule("Process", [{ ...nothingPointsAtIt, type: "Resource", operator: "missing" }]);
  assert.equal(checkOf("add-rule")(pprModel({ rules: [seeded, isNotSet] })), false, "is not set reports every process");
  const laserBends = [...produced, link("laser", "bend")];
  assert.equal(
    checkOf("assign-resource")(model("instance", [...withBending, press], { relationships: laserBends })),
    false,
    "the Laser cutter cannot bend",
  );
  assert.equal(
    checkOf("trace-new")(model("instance", [...start, angle], { relationships: [...chain, link("blank", "r3")] })),
    false,
    "the Blank does not have to have the angle",
  );
  const unchanged = [...executedBending, link("bracket", "coat"), link("coat", "bracket")];
  assert.equal(checkOf("own-process")(model("instance", all, { relationships: unchanged })), false, "nothing was transformed");
  // A learner who skipped Mounting angle can still trace Corrosion protection and finish.
  const withoutAngle = all.filter((candidate) => candidate.id !== "r3");
  const tracedWithoutAngle = [...transformed, link("booth", "coat"), link("coat", "r2")].filter(
    (relationship) => relationship.to !== "r3",
  );
  assert.equal(checkOf("own-trace")(model("instance", withoutAngle, { relationships: tracedWithoutAngle })), true);
});

test("a step marked afterPrevious waits for the steps before it, even when its check holds from the start", async () => {
  const { REUSE_TUTORIAL: R } = await import("@shared/tutorial-reuse");
  const index = R.lessons.findIndex((lesson) => lesson.id === "copy");
  const before = R.lessons.slice(0, index);
  let progress: TutorialProgress = {
    ...EMPTY_TUTORIAL_PROGRESS,
    completed: before.flatMap((lesson) => lesson.steps.map((candidate) => candidate.id)),
    recapped: before.map((lesson) => lesson.id),
  };
  const original = model("instance", [
    element("s1", "S1", "Sensor node"),
    element("t", "Temperature sensor", "Sensor", [attribute("quantity", "temperature", { type: "list" })]),
  ]);
  // In S1 before anything was copied: the original looks as it always did, which proves nothing yet.
  progress = progressOf.applyModelState(R, progress, original);
  assert.equal(progressOf.stepState(R, progress, tutorialSteps(R).find((s) => s.id === "check-original")!), "open");
  // Once the copy was made and changed, the same look at S1 counts.
  for (const id of ["duplicate", "rename-node", "change-sensor"]) progress = progressOf.skipStep(R, progress, id);
  progress = progressOf.applyModelState(R, progress, original);
  assert.equal(progressOf.stepState(R, progress, tutorialSteps(R).find((s) => s.id === "check-original")!), "done");
});

test("reuse: the imported projects are told apart from the learner's own, also when Symlit marks them", async () => {
  const { REUSE_TUTORIAL: R } = await import("@shared/tutorial-reuse");
  const project = (id: number, name: string, kind: "metamodel" | "instance", metamodels: number[], ofTutorial = false) => ({
    id,
    name,
    kind,
    templateId: null,
    metamodels,
    ofTutorial,
  });
  const own = [
    project(1, "Tutorial · Sensor node types", "metamodel", [], true),
    project(2, "Tutorial · Radio modules", "metamodel", [1], true),
    project(3, "Tutorial · Sensor node S1", "instance", [1], true),
    project(4, "Sensor node S2", "instance", [1, 2]),
  ];
  const imported = [
    project(5, "Tutorial · Sensor node types (imported)", "metamodel", []),
    project(6, "Tutorial · Radio modules (imported)", "metamodel", [5]),
    project(7, "Sensor node S2 (imported)", "instance", [5, 6]),
  ];
  const workspace = (projects: typeof own) => ({ projects, tutorialMetamodels: [1, 2] });
  const checkOf = (id: string) => tutorialSteps(R).find((candidate) => candidate.id === id)!.checkProjects!;
  assert.equal(checkOf("import")(workspace(own)), false, "nothing imported yet");
  assert.equal(checkOf("import")(workspace([...own, ...imported])), true);
  // Without the mark (on a computer where the names were free) they are found by their names, too.
  const unmarked = imported.map((candidate) => ({ ...candidate, name: candidate.name.replace(" (imported)", "") }));
  assert.equal(checkOf("import")(workspace([...own, ...unmarked])), true);
  assert.equal(checkOf("remove-imported")(workspace([...own, imported[2]])), false, "the model is still there");
  assert.equal(checkOf("remove-imported")(workspace([...own, imported[0], imported[1]])), false, "the metamodels are still there");
  assert.equal(
    checkOf("remove-imported")(workspace([...own.slice(0, 3), imported[2]])),
    false,
    "deleting your own copy and the imported metamodels instead is not it",
  );
  assert.equal(checkOf("remove-imported")(workspace(own)), true);

  // Removing what was imported only counts after an import: skipping it is not enough.
  const index = R.lessons.findIndex((lesson) => lesson.id === "hand-on");
  const before = R.lessons.slice(0, index);
  let progress: TutorialProgress = {
    ...EMPTY_TUTORIAL_PROGRESS,
    completed: [...before.flatMap((lesson) => lesson.steps.map((candidate) => candidate.id)), "rename-variant", "export"],
    recapped: before.map((lesson) => lesson.id),
  };
  const removeStep = tutorialSteps(R).find((candidate) => candidate.id === "remove-imported")!;
  progress = progressOf.skipStep(R, progress, "import");
  progress = progressOf.applyWorkspaceState(R, progress, workspace(own));
  assert.notEqual(progressOf.stepState(R, progress, removeStep), "done");
  progress = progressOf.returnToSkipped(progress);
  progress = progressOf.applyWorkspaceState(R, progress, workspace([...own, ...imported]));
  progress = progressOf.applyWorkspaceState(R, progress, workspace(own));
  assert.equal(progressOf.stepState(R, progress, removeStep), "done");
});

test("reuse: an element's own style and a relationship's direction are checked", async () => {
  const { REUSE_TUTORIAL: R } = await import("@shared/tutorial-reuse");
  const checkOf = (id: string) => tutorialSteps(R).find((candidate) => candidate.id === id)!.check!;
  const controller = (extra: Partial<TutorialElement>) =>
    model("instance", [element("c", "Controller", "Microcontroller", {}, { color: "#2563eb", ...extra })]);
  assert.equal(checkOf("own-style")(controller({})), false);
  // The type got another colour and the controller follows it: not a style of its own.
  assert.equal(checkOf("own-style")(controller({ color: "#e11d48" })), false);
  assert.equal(checkOf("own-style")(controller({ color: "#e11d48", ownStyle: true })), true);

  const radio = (from: string, to: string) =>
    model("variant", [element("s2", "S2", "Sensor node"), element("lora", "New LoRa module", "LoRa module")], {
      relationships: [link(from, to, "association", "sends via")],
    });
  assert.equal(checkOf("add-radio")(radio("s2", "lora")), true);
  assert.equal(checkOf("add-radio")(radio("lora", "s2")), false, "the radio does not send via the node");
});

test("calc: a formula counts for what it calculates, not for the names it uses", async () => {
  const { CALC_TUTORIAL: C } = await import("@shared/tutorial-calc");
  const checkOf = (id: string) => tutorialSteps(C).find((candidate) => candidate.id === id)!.check!;
  const derived = (name: string, formula: string, references: string[]) =>
    attribute(name, "", { type: "derived", formula, references });
  const type = (...attributes: TutorialAttribute[]) => model("metamodel", [element("t", "Print job", "Object", attributes)]);

  const materialCost = (formula: string) => type(derived("material cost", formula, ["mass", "material price"]));
  assert.equal(checkOf("add-material-cost")(materialCost("[mass] * [material price]")), false, "grams are not kilograms");
  assert.equal(checkOf("add-material-cost")(materialCost("[mass] / 1000 * [material price]")), true);
  assert.equal(checkOf("add-material-cost")(materialCost("[material price] * ([mass] * 0.001)")), true, "written another way");

  const margin = (formula: string) => type(derived("margin", formula, ["price", "total cost"]));
  assert.equal(checkOf("add-margin")(margin("[total cost] - [price]")), false, "the wrong way round");
  assert.equal(checkOf("add-margin")(margin("[price] - [total cost]")), true);
  assert.equal(checkOf("add-margin")(margin("-[total cost] + [price]")), true);

  // Renaming the rate: machine cost has to refer to the renamed attribute, and the old name is gone.
  const renamed = (rateName: string) =>
    type(attribute(rateName, "4"), derived("machine cost", `[print time] * [${rateName}]`, ["print time", rateName]));
  assert.equal(checkOf("rename-rate")(renamed("machine rate")), false);
  assert.equal(checkOf("rename-rate")(renamed("hourly rate")), true);

  // Validating counts only when the rule has something to find.
  const job = (name: string, value: string) => element(name, name, "Print job", { margin: value });
  const marginRule = rule("Print job", [condition({ attribute: "margin", operator: "less-than", value: "0" })]);
  const orders = (gearMargin: string) =>
    model("instance", [job("Phone stand", "1.5"), job("Gear housing", gearMargin), job("Cable clip", "1.4")], {
      rules: [marginRule],
    });
  assert.equal(checkOf("validate")(orders("-3.2")), true);
  assert.equal(checkOf("validate")(orders("6.8")), false, "nothing is below cost: the rule finds nothing");
  // The corrected quote has to be saved.
  assert.equal(checkOf("fix-price")(orders("6.8")), true);
  assert.equal(checkOf("fix-price")({ ...orders("6.8"), dirty: true }), false);
});

test("classify: rules count with the values asked for, and tags only follow from rules", async () => {
  const { CLASSIFY_TUTORIAL: K } = await import("@shared/tutorial-classify");
  const checkOf = (id: string) => tutorialSteps(K).find((candidate) => candidate.id === id)!.check!;
  const tagRule = (tag: string, conditions: TutorialRuleCondition[], extra: Partial<TutorialRule> = {}) =>
    rule("Component", conditions, { reportsIssue: false, tag, ...extra });
  const leadTime = (operator: string, value: string) => condition({ attribute: "lead time", operator, value });
  const high = condition({ attribute: "criticality", operator: "equals", value: "high" });
  const single = condition({ attribute: "single source", operator: "is-true" });
  const metamodelWith = (...rules: TutorialRule[]) => model("metamodel", [element("c", "Component", "Object")], { rules });

  assert.equal(checkOf("own-rule")(metamodelWith(tagRule("Order early", [leadTime("greater-than", "60"), high]))), false);
  assert.equal(checkOf("own-rule")(metamodelWith(tagRule("Order early", [leadTime("greater-than", "30"), high]))), true);
  assert.equal(
    checkOf("own-rule")(metamodelWith(tagRule("Order early", [leadTime("greater-than", "30"), high], { combinator: "any" }))),
    false,
  );

  // Without a Long lead rule there was never a tag to lose.
  const hmi = (rules: TutorialRule[]) =>
    model("instance", [element("hmi", "HMI panel", "Component", { "lead time": "30" })], { rules });
  assert.equal(checkOf("tag-follows")(hmi([])), false);
  assert.equal(checkOf("tag-follows")(hmi([tagRule("Long lead", [leadTime("greater-than", "60")])])), true);

  const parts = (rules: TutorialRule[]) => model("instance", [element("plc", "PLC", "Component")], { rules });
  const secondSource = tagRule("Second source", [single, high]);
  assert.equal(checkOf("tag-second-source")(parts([tagRule("Second source", [single, high], { combinator: "any" })])), false);
  assert.equal(checkOf("tag-second-source")(parts([secondSource])), true);
  // Switched off or deleted, the helper rules are no longer active.
  assert.equal(checkOf("switch-off")(parts([secondSource, tagRule("Critical", [high])])), false);
  assert.equal(checkOf("switch-off")(parts([secondSource])), true);
});

test("classify: the inherited rule is only found after the metamodel has it", async () => {
  const { CLASSIFY_TUTORIAL: K } = await import("@shared/tutorial-classify");
  const index = K.lessons.findIndex((lesson) => lesson.id === "rule-for-all");
  const before = K.lessons.slice(0, index);
  let progress: TutorialProgress = {
    ...EMPTY_TUTORIAL_PROGRESS,
    completed: before.flatMap((lesson) => lesson.steps.map((candidate) => candidate.id)),
    recapped: before.map((lesson) => lesson.id),
  };
  const seeInherited = tutorialSteps(K).find((candidate) => candidate.id === "see-inherited")!;
  progress = progressOf.applySignal(K, progress, "rules-opened", "instance", model("instance", []));
  assert.notEqual(progressOf.stepState(K, progress, seeInherited), "done");
  progress = progressOf.skipStep(K, progress, "meta-rule");
  progress = progressOf.applySignal(K, progress, "rules-opened", "instance", model("instance", []));
  assert.equal(progressOf.stepState(K, progress, seeInherited), "done");
});

test("structure: the new relationship, the shown elements and the Generalization are told apart from look-alikes", async () => {
  const { STRUCTURE_TUTORIAL: S } = await import("@shared/tutorial-structure");
  const checkOf = (id: string) => tutorialSteps(S).find((candidate) => candidate.id === id)!.check!;
  const types = [element("boiler", "Boiler", "Object"), element("group", "Brew group", "Object")];
  const boilerToGroup = (...names: string[]) =>
    model("metamodel", types, { relationships: names.map((name) => link("boiler", "group", "association", name)) });
  assert.equal(checkOf("name-feeds")(boilerToGroup("feeds", "")), false, "heats was renamed instead");
  assert.equal(checkOf("name-feeds")(boilerToGroup("heats", "feeds")), true);

  const shown = (partNumbers: boolean) =>
    model(
      "instance",
      [
        ["Water tank", "E1-010"],
        ["Vibration pump", "E1-020"],
        ["Boiler", "E1-030"],
        ["Brew group", "E1-040"],
      ].map(([name, number]) => element(name, name, "Component", { "part number": partNumbers ? number : "" })),
      { diagram: "Water path", diagrams: ["Structure", "Water path"] },
    );
  assert.equal(checkOf("place-elements")(shown(false)), false, "new elements with the same names");
  assert.equal(checkOf("place-elements")(shown(true)), true);

  const generalization = (from: string, to: string) =>
    model("metamodel", [element("grinder", "Grinder", "Object"), element("component", "Component", "Object")], {
      relationships: [link(from, to, "generalization")],
    });
  assert.equal(checkOf("generalize")(generalization("component", "grinder")), false, "a Component is not a Grinder");
  assert.equal(checkOf("generalize")(generalization("grinder", "component")), true);
});

test("basics: deleting Pack B is no fix, a default is no value filled in, a lone drone is no pattern", () => {
  const checkOf = (id: string) => step(id).check!;
  const withCamera = [...startingModel, element("cam", "Nose camera", "Camera", { resolution: "12" })];
  const withoutPackB = withCamera.filter((candidate) => candidate.id !== "b");
  assert.equal(checkOf("fix-issue")(model("instance", withoutPackB)), false);
  // A camera fresh from the type, with a default value and its placeholder name, is not filled in yet.
  const fresh = [...startingModel, element("cam", "New Camera 5", "Camera", { resolution: "8" })];
  assert.equal(checkOf("set-value")(model("instance", fresh)), false);
  assert.equal(checkOf("set-value")(model("instance", withCamera)), true);
  // Two drones, each with a battery: the pattern brought both.
  const drones = (withBattery: boolean) =>
    model(
      "instance",
      [...startingModel, element("x2", "Courier X1", "Drone"), element("a2", "Pack A", "Battery")],
      { relationships: [link("x1", "a"), ...(withBattery ? [link("x2", "a2")] : [])] },
    );
  assert.equal(checkOf("insert-pattern")(drones(false)), false);
  assert.equal(checkOf("insert-pattern")(drones(true)), true);
});

test("a step that opens a diagram and asks for something in it is judged on that diagram", () => {
  const opening: typeof T = {
    ...T,
    lessons: [
      {
        ...T.lessons[0],
        steps: [
          {
            id: "open-structure",
            title: "Open Structure",
            instruction: "Open the diagram Structure and look at it.",
            done: "This is the diagram Structure.",
            signal: "view-opened",
            scope: "instance",
            view: "Structure",
          },
          ...T.lessons[0].steps.slice(1),
        ],
      },
      ...T.lessons.slice(1),
    ],
  };
  const openStep = opening.lessons[0].steps[0];
  let progress: TutorialProgress = { ...EMPTY_TUTORIAL_PROGRESS };
  // The signal comes before the new diagram is known: nothing is judged on the one open before.
  progress = progressOf.applySignal(opening, progress, "view-opened", "instance", null);
  assert.equal(progressOf.stepState(opening, progress, openStep), "current");
  // Another diagram opened first does not count; Structure does.
  progress = progressOf.applyOpenedView(opening, progress, "instance", model("instance", [], { diagram: "Main" }));
  assert.equal(progressOf.stepState(opening, progress, openStep), "current");
  progress = progressOf.applyOpenedView(opening, progress, "instance", model("instance", [], { diagram: "Structure" }));
  assert.equal(progressOf.stepState(opening, progress, openStep), "done");
});

test("calc: a lesson-2 step skipped before the rate was renamed can still be done after", async () => {
  const { CALC_TUTORIAL: C } = await import("@shared/tutorial-calc");
  const checkOf = (id: string) => tutorialSteps(C).find((candidate) => candidate.id === id)!.check!;
  const renamed = model("metamodel", [
    element("t", "Print job", "Object", [
      attribute("hourly rate", "4"),
      attribute("machine cost", "", {
        type: "derived",
        formula: "[print time] * [hourly rate]",
        references: ["print time", "hourly rate"],
      }),
    ]),
  ]);
  for (const id of ["add-rate", "add-machine-cost", "save-first"]) assert.equal(checkOf(id)(renamed), true, id);
});
