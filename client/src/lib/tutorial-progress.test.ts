import assert from "node:assert/strict";
import test from "node:test";
import {
  TUTORIAL_LESSONS,
  TUTORIAL_STEPS,
  tutorialSignals,
  type TutorialElement,
  type TutorialModelState,
} from "@shared/tutorial";
import {
  answerQuestion,
  applyModelState,
  applySignal,
  closeRecap,
  countDone,
  currentLessonIndex,
  currentStep,
  EMPTY_TUTORIAL_PROGRESS,
  isTutorialFinished,
  lastCompletedStep,
  normalizeTutorialProgress,
  noteHelpUsed,
  pendingRecap,
  returnToSkipped,
  skippedSteps,
  skipStep,
  stepState,
  totalHelpUsed,
  tutorialMinutes,
  type TutorialProgress,
} from "./tutorial-progress";

// --- a small model to check steps against ------------------------------------

const element = (
  id: string,
  name: string,
  type: string,
  attributes: Record<string, string> = {},
): TutorialElement => ({
  id,
  name,
  type,
  attributes: Object.entries(attributes).map(([attribute, value]) => ({ name: attribute, value })),
});

const model = (
  scope: TutorialModelState["scope"],
  elements: TutorialElement[],
  extra: Partial<TutorialModelState> = {},
): TutorialModelState => ({ scope, elements, relationships: [], editingId: null, rules: [], dirty: false, ...extra });

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

test("the tutorial definition is consistent", () => {
  const ids = TUTORIAL_STEPS.map((candidate) => candidate.id);
  assert.equal(new Set(ids).size, ids.length, "step ids are unique");
  assert.equal(new Set(TUTORIAL_LESSONS.map((lesson) => lesson.id)).size, TUTORIAL_LESSONS.length);
  for (const lesson of TUTORIAL_LESSONS) {
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
  for (const candidate of TUTORIAL_STEPS) {
    assert.ok(candidate.signal || candidate.check, `${candidate.id} can complete`);
    if (candidate.signal) assert.ok((tutorialSignals as readonly string[]).includes(candidate.signal), candidate.id);
    assert.ok(candidate.instruction.length > 20, `${candidate.id} explains what to do`);
    assert.ok(candidate.done.length > 20, `${candidate.id} explains what happened`);
  }
});

test("most steps check a result in the model, not only that a button was pressed", () => {
  const checked = TUTORIAL_STEPS.filter((candidate) => candidate.check).length;
  assert.ok(checked / TUTORIAL_STEPS.length >= 0.6, `${checked} of ${TUTORIAL_STEPS.length} steps check the model`);
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
    model("metamodel", cameraWithAttribute, { relationships: [{ from: "new", to: "drone" }] }),
  );
  assert.equal(stepState(progress, step("add-attribute")), "done");
  assert.equal(stepState(progress, step("relate-types")), "current");
  progress = applyModelState(
    progress,
    model("metamodel", cameraWithAttribute, { relationships: [{ from: "drone", to: "new" }] }),
  );
  assert.equal(stepState(progress, step("relate-types")), "done");
});

test("a signal only completes its step when the model agrees", () => {
  let progress = atLesson("define-type");
  // Saving the untouched metamodel is not "save the metamodel with the new type".
  progress = applySignal(progress, "saved", "metamodel", model("metamodel", startingTypes));
  assert.equal(stepState(progress, step("save-metamodel")), "open");
  // Without knowing the model, nothing that depends on it completes.
  progress = applySignal(progress, "saved", "metamodel", null);
  assert.equal(stepState(progress, step("save-metamodel")), "open");
  const withCamera = [...startingTypes, element("new", "Camera", "Object")];
  progress = applySignal(progress, "saved", "metamodel", model("metamodel", withCamera));
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
  const seeded = { reportsIssue: true, attributes: ["capacity"] };
  progress = applyModelState(progress, model("instance", fixed, { rules: [seeded, { reportsIssue: false, attributes: ["range"] }] }));
  assert.equal(stepState(progress, step("add-rule")), "open");
  const withRule = model("instance", fixed, { rules: [seeded, { reportsIssue: true, attributes: ["Range"] }] });
  progress = applyModelState(progress, withRule);
  assert.equal(stepState(progress, step("add-rule")), "done");
});

test("the unguided lesson asks for a saved, related, valued result", () => {
  let progress = atLesson("on-your-own");
  const charger = element("charger", "Charger", "Object", { power: "" });
  const related = { relationships: [{ from: "charger", to: "battery" }] };
  progress = applyModelState(progress, model("metamodel", [...startingTypes, charger], { ...related, dirty: true }));
  assert.equal(stepState(progress, step("own-type")), "current", "not saved yet");
  progress = applyModelState(progress, model("metamodel", [...startingTypes, element("charger", "Charger", "Object")], related));
  assert.equal(stepState(progress, step("own-type")), "current", "no attribute");
  progress = applyModelState(progress, model("metamodel", [...startingTypes, charger], related));
  assert.equal(stepState(progress, step("own-type")), "done");

  const chargerElement = element("c1", "Depot charger", "Charger", { power: "300" });
  const connected = model("instance", [...startingModel, chargerElement], { relationships: [{ from: "c1", to: "b" }] });
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
