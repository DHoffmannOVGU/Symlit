import assert from "node:assert/strict";
import test from "node:test";
import { TUTORIAL_LESSONS, TUTORIAL_STEPS, tutorialSignals } from "@shared/tutorial";
import {
  applySignal,
  countDone,
  currentLessonIndex,
  currentStep,
  EMPTY_TUTORIAL_PROGRESS,
  isTutorialFinished,
  normalizeTutorialProgress,
  restartTutorial,
  skipStep,
} from "./tutorial-progress";

test("the tutorial definition is consistent", () => {
  const ids = TUTORIAL_STEPS.map((step) => step.id);
  assert.equal(new Set(ids).size, ids.length, "step ids are unique");
  assert.ok(TUTORIAL_LESSONS.every((lesson) => lesson.steps.length > 0));
  for (const step of TUTORIAL_STEPS) {
    assert.ok((tutorialSignals as readonly string[]).includes(step.signal), step.id);
    assert.ok(step.instruction.length > 20, `${step.id} explains what to do`);
  }
});

test("starts at the first step of the first lesson", () => {
  assert.equal(currentStep(EMPTY_TUTORIAL_PROGRESS)?.id, TUTORIAL_STEPS[0].id);
  assert.equal(currentLessonIndex(EMPTY_TUTORIAL_PROGRESS), 0);
  assert.equal(countDone(EMPTY_TUTORIAL_PROGRESS), 0);
});

test("a signal completes the first matching open step in the same project", () => {
  const afterMetamodel = applySignal(EMPTY_TUTORIAL_PROGRESS, "view-opened", "metamodel");
  assert.deepEqual(afterMetamodel.completed, ["open-metamodel"]);
  // Opening the metamodel again changes nothing.
  assert.equal(applySignal(afterMetamodel, "view-opened", "metamodel"), afterMetamodel);
  const afterInstance = applySignal(afterMetamodel, "view-opened", "instance");
  assert.deepEqual(afterInstance.completed, ["open-metamodel", "open-instance"]);
  assert.equal(currentStep(afterInstance)?.id, "add-type");
});

test("signals from the wrong project do not count", () => {
  const progress = applySignal(EMPTY_TUTORIAL_PROGRESS, "typed-node-created", "metamodel");
  assert.equal(progress, EMPTY_TUTORIAL_PROGRESS);
});

test("steps done out of order still count", () => {
  const progress = applySignal(EMPTY_TUTORIAL_PROGRESS, "exported", "instance");
  assert.deepEqual(progress.completed, ["export"]);
  assert.equal(currentStep(progress)?.id, "open-metamodel");
});

test("skipping moves on, and finishing every step ends the tutorial", () => {
  let progress = skipStep(EMPTY_TUTORIAL_PROGRESS, "open-metamodel");
  assert.equal(currentStep(progress)?.id, "open-instance");
  for (const step of TUTORIAL_STEPS) progress = applySignal(progress, step.signal, step.scope);
  assert.equal(isTutorialFinished(progress), true);
  assert.equal(countDone(progress), TUTORIAL_STEPS.length);
  assert.equal(currentStep(restartTutorial(progress))?.id, "open-metamodel");
});

test("stored progress is normalised", () => {
  assert.deepEqual(normalizeTutorialProgress(null), EMPTY_TUTORIAL_PROGRESS);
  assert.deepEqual(
    normalizeTutorialProgress({ completed: ["open-metamodel", "gone-step", 3], collapsed: true }),
    { completed: ["open-metamodel"], skipped: [], collapsed: true },
  );
});

test("finds both projects of a tutorial run from either side", async () => {
  const { findTutorialProjects, latestTutorialRun } = await import("./tutorial-projects");
  const base = { userId: 1, description: null, createdAt: null, metamodelSetup: null };
  const mm = { ...base, id: 10, name: "MM", projectType: "metamodel", referencedMetamodels: [], templateId: "tutorial" };
  const inst = { ...base, id: 11, name: "I", projectType: "instance", referencedMetamodels: [10], templateId: "tutorial" };
  const other = { ...base, id: 12, name: "Mine", projectType: "instance", referencedMetamodels: [10], templateId: null };
  const all = [mm, inst, other];
  assert.deepEqual(findTutorialProjects(mm, all), { metamodel: mm, instance: inst });
  assert.deepEqual(findTutorialProjects(inst, all), { metamodel: mm, instance: inst });
  assert.equal(findTutorialProjects(other, all), null, "own projects are not tutorial projects");
  assert.deepEqual(latestTutorialRun(all), { metamodel: mm, instance: inst });
  assert.equal(latestTutorialRun([other]), null);
});
