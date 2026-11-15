import { expect, test, type Page } from "@playwright/test";
import { tutorialSteps, type TutorialDefinition } from "../shared/tutorial";
import { BASICS_TUTORIAL } from "../shared/tutorial-basics";
import { PPR_TUTORIAL } from "../shared/tutorial-ppr";

// Full-stack: the real server creates the tutorial projects.
// Tutorials are per workspace (one database), so these tests run one after
// the other and must not run concurrently with themselves; avoid
// `--repeat-each` for this file.
test.describe.configure({ mode: "serial" });

const TUTORIAL_LESSONS = BASICS_TUTORIAL.lessons;
const TOTAL = tutorialSteps(BASICS_TUTORIAL).length;

const stepState = (page: Page, id: string) => page.getByTestId(`tutorial-step-${id}`).getAttribute("data-state");
const expectDone = (page: Page, id: string) => expect.poll(() => stepState(page, id), { message: id }).toBe("done");
const expectProgress = (page: Page, done: number, total = TOTAL) =>
  expect(page.getByTestId("tutorial-progress-count")).toContainText(`${done} of ${total}`);
const card = (page: Page, name: string) => page.locator(".react-flow__node", { hasText: name });

async function startTutorial(page: Page, tutorial: TutorialDefinition = BASICS_TUTORIAL) {
  await page.request.delete("/api/tutorial");
  await page.goto("/projects");
  await page.getByTestId(`button-tutorial-start-${tutorial.id}`).click();
  await expect(page.getByTestId("tutorial-coach")).toBeVisible();
  await expect(page.getByTestId("tutorial-title")).toHaveText(tutorial.title);
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
}

/** Opens the other tutorial project with the coach's button and waits for its diagram. */
async function openOtherProject(page: Page, expectCard: string) {
  await page.getByTestId("button-tutorial-open-project").click();
  await expect(card(page, expectCard).first()).toBeVisible();
}

/** Waits until the diagram has stopped moving (it re-fits when the coach changes sides). */
async function waitForStillCanvas(page: Page) {
  const viewport = page.locator(".react-flow__viewport");
  let previous = "";
  let stableFor = 0;
  for (let attempt = 0; attempt < 40 && stableFor < 3; attempt += 1) {
    const current = (await viewport.getAttribute("style")) ?? "";
    stableFor = current === previous ? stableFor + 1 : 0;
    previous = current;
    await page.waitForTimeout(100);
  }
}

async function connect(page: Page, from: string, fromSide: string, to: string, toSide: string) {
  await waitForStillCanvas(page);
  const center = async (name: string, side: string) => {
    const handle = card(page, name).first().locator(`.react-flow__handle[data-handlepos="${side}"]`).first();
    const box = (await handle.boundingBox())!;
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  };
  const start = await center(from, fromSide);
  const end = await center(to, toSide);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 12 });
  await page.mouse.up();
}

const saveEditor = async (page: Page) => {
  await page.getByTestId("button-save-attributes").click();
  await expect(page.getByTestId("node-attribute-panel")).toBeHidden();
};
const cancelEditor = async (page: Page) => {
  await page.getByTestId("button-cancel-attributes").click();
  await expect(page.getByTestId("node-attribute-panel")).toBeHidden();
};
const saveDiagram = async (page: Page) => {
  await page.getByTestId("button-save-diagram-header").click();
  await expect(page.getByTestId("button-save-diagram-header")).toBeDisabled();
};

/** Answers the lesson's question (optionally wrongly first) and moves on. */
async function finishLesson(
  page: Page,
  lessonIndex: number,
  options: { wrongFirst?: boolean; tutorial?: TutorialDefinition } = {},
) {
  const lessons = (options.tutorial ?? BASICS_TUTORIAL).lessons;
  const lesson = lessons[lessonIndex];
  const recap = page.getByTestId("tutorial-recap");
  await expect(recap).toContainText(`You can now ${lesson.goal}`);
  // The explanation of the lesson's last step is still shown.
  await expect(recap.getByTestId("tutorial-step-done-text")).toContainText(lesson.steps[lesson.steps.length - 1].done);
  const right = lesson.question!.options.findIndex((option) => option.correct);
  if (options.wrongFirst) {
    const wrong = right === 0 ? 1 : 0;
    await page.getByTestId(`tutorial-answer-${wrong}`).click();
    await expect(page.getByTestId("tutorial-answer-feedback")).toContainText("Not quite.");
  }
  await page.getByTestId(`tutorial-answer-${right}`).click();
  await expect(page.getByTestId("tutorial-answer-feedback")).toHaveText(lesson.question!.options[right].feedback);
  await page.getByTestId("button-tutorial-next-lesson").click();
  await expect(page.getByTestId("tutorial-lesson-title")).toHaveText(lessons[lessonIndex + 1].title);
}

test("a learner works through the whole tutorial, and every step checks the result", async ({ page }) => {
  test.setTimeout(180_000);
  await startTutorial(page);

  // --- Lesson 1: types and elements ---
  // Arriving completes nothing: the first step asks the learner to do something.
  await expectProgress(page, 0);
  await expect(page.getByTestId("tutorial-lesson-why")).toContainText("Symlit works on two levels");
  await card(page, "Drone").dblclick();
  await expectDone(page, "open-type");
  await expect(page.getByTestId("tutorial-step-done-text")).toContainText("Drone is a type");
  await cancelEditor(page);
  await openOtherProject(page, "Courier X1");
  await expectDone(page, "open-instance");
  await card(page, "Courier X1").dblclick();
  await expect(page.getByTestId("tutorial-recap")).toBeVisible();
  await cancelEditor(page);
  await finishLesson(page, 0, { wrongFirst: true });
  await expectProgress(page, 3);

  // --- Lesson 2: define a type ---
  await openOtherProject(page, "Battery");
  await page.getByTestId("button-create-sidebar-partdef").click();
  await expectDone(page, "add-type");
  // A type with another name is not the Camera the next lessons build on.
  await card(page, "New Object").dblclick();
  await page.getByTestId("input-node-label").fill("Lens");
  await saveEditor(page);
  await expect.poll(() => stepState(page, "name-type")).toBe("current");
  await card(page, "Lens").dblclick();
  await page.getByTestId("input-node-label").fill("Camera");
  await saveEditor(page);
  await expectDone(page, "name-type");
  await card(page, "Camera").dblclick();
  await page.getByTestId("button-add-attribute").click();
  await page.getByTestId("input-attr-name-0").fill("resolution");
  await page.getByTestId("button-attribute-done").click();
  await saveEditor(page);
  await expectDone(page, "add-attribute");
  // The direction counts: Camera to Drone is not what the step asks for.
  await connect(page, "Camera", "top", "Battery", "bottom");
  await expect.poll(() => stepState(page, "relate-types")).toBe("current");
  await connect(page, "Drone", "bottom", "Camera", "left");
  await expectDone(page, "relate-types");
  await saveDiagram(page);
  await finishLesson(page, 1);

  // --- Lesson 3: build a typed model ---
  await openOtherProject(page, "Courier X1");
  await page.locator('[data-testid^="button-insert-referenced-class-"]', { hasText: "Camera" }).click();
  await expectDone(page, "insert-typed");
  // The camera comes with its type's attribute; the step is done once it has a value.
  await card(page, "New Camera").dblclick();
  await expect(page.getByTestId("attribute-name-0")).toHaveText("resolution");
  await page.getByTestId("input-node-label").fill("Nose camera");
  await page.getByTestId("input-attr-value-0").fill("12");
  await saveEditor(page);
  await expectDone(page, "set-value");
  await connect(page, "Courier X1", "top", "Nose camera", "top");
  await expectDone(page, "connect-instances");
  await saveDiagram(page);
  await finishLesson(page, 2);

  // --- Lesson 4: check the model ---
  // The model starts with a gap, so validation has something to say.
  await page.getByTestId("button-toolbar-validate").click();
  await expect(page.getByTestId("validation-issue-0")).toContainText("Pack B: No capacity entered.");
  await expectDone(page, "validate");
  // Validating again without fixing does not pass the next steps.
  await page.getByTestId("button-validate-again").click();
  await expect.poll(() => stepState(page, "fix-issue")).toBe("current");
  await expect.poll(() => stepState(page, "validate-again")).toBe("open");
  await page.getByTestId("validation-issue-0").click();
  await card(page, "Pack B").dblclick();
  await page.getByTestId("input-attr-value-0").fill("160");
  await saveEditor(page);
  await expectDone(page, "fix-issue");
  await page.getByTestId("button-validate-again").click();
  await expectDone(page, "validate-again");
  await page.getByTestId("button-model-rules").click();
  await expectDone(page, "open-rules");
  // Write the rule that answers the question.
  const rules = page.getByTestId("model-rules-panel");
  await expect(rules.getByLabel("Rule name")).toHaveValue("Every battery needs a capacity");
  await page.getByTestId("button-add-rule").click();
  await rules.getByLabel("Rule name").last().fill("Range covers the city route");
  const lists = rules.getByRole("combobox");
  const firstOfNewRule = (await lists.count()) - 6;
  const choose = async (offset: number, option: string) => {
    await lists.nth(firstOfNewRule + offset).click();
    await page.getByRole("option", { name: option, exact: true }).click();
  };
  await choose(0, "Drone");
  await choose(3, "range");
  await choose(4, "is less than");
  await rules.getByPlaceholder("value").last().fill("15");
  // A rule that only adds a tag is not a check yet.
  await page.getByTestId("button-save-rules").click();
  await expect(page.getByText("Model rules saved").first()).toBeVisible();
  await expect.poll(() => stepState(page, "add-rule")).toBe("current");
  await choose(5, "report an issue");
  await page.getByTestId("button-save-rules").click();
  await expectDone(page, "add-rule");
  await rules.getByLabel("Close model rules").click();
  await page.getByTestId("button-toolbar-validate").click();
  await finishLesson(page, 3);

  // --- Lesson 5: read and reuse ---
  await page.getByTestId("button-toolbar-table").click();
  await expectDone(page, "table-mode");
  // The coach makes room for the table.
  await expect(page.getByTestId("tutorial-coach")).toHaveAttribute("data-side", "left");
  await page.getByTestId("button-toolbar-graph").click();
  await expect(page.getByTestId("tutorial-coach")).toHaveAttribute("data-side", "right");
  await page.getByTestId("button-toolbar-auto-layout").click();
  await expectDone(page, "auto-layout");
  await card(page, "Courier X1").click({ position: { x: 12, y: 12 } });
  await card(page, "Pack A").click({ modifiers: ["ControlOrMeta"], position: { x: 12, y: 12 } });
  await page.getByTestId("button-toolbar-save-pattern").click();
  await page.getByRole("dialog").locator("input").first().fill("Drone with battery");
  await page.getByRole("dialog").getByRole("button", { name: "Save Pattern" }).click();
  await expectDone(page, "save-pattern");
  await page.getByRole("tab", { name: "Diagrams" }).click();
  const insert = page.locator('[data-testid^="button-insert-pattern-"]');
  await insert.hover();
  await insert.click();
  await expect(card(page, "Courier X1")).toHaveCount(2);
  await finishLesson(page, 4);

  // --- Lesson 6: on your own ---
  await saveDiagram(page);
  await openOtherProject(page, "Battery");
  await page.getByTestId("button-create-sidebar-partdef").click();
  await card(page, "New Object").dblclick();
  await page.getByTestId("input-node-label").fill("Charger");
  await page.getByTestId("button-add-attribute").click();
  await page.getByTestId("input-attr-name-0").fill("power");
  await page.getByTestId("button-attribute-done").click();
  await saveEditor(page);
  await connect(page, "Charger", "top", "Battery", "bottom");
  // Built but not saved: the model could not use it yet.
  await expect(page.getByTestId("button-save-diagram-header")).toBeEnabled();
  await expect.poll(() => stepState(page, "own-type")).toBe("current");
  await saveDiagram(page);
  await expectDone(page, "own-type");
  await openOtherProject(page, "Nose camera");
  await page.getByRole("tab", { name: "Add elements" }).click();
  await page.locator('[data-testid^="button-insert-referenced-class-"]', { hasText: "Charger" }).click();
  await card(page, "New Charger").dblclick();
  await page.getByTestId("input-attr-value-0").fill("300");
  await saveEditor(page);
  await connect(page, "New Charger", "top", "Pack B", "bottom");
  await expectDone(page, "own-element");
  await page.getByTestId("button-toolbar-validate").click();
  await expectDone(page, "own-validate");
  await saveDiagram(page);
  await page.getByTestId("button-export-project").click();
  const download = page.waitForEvent("download");
  await page.getByRole("dialog").getByRole("button", { name: "Download" }).click();
  await download;

  // --- The end says what was done and answers the question ---
  const finished = page.getByTestId("tutorial-finished");
  await expect(finished).toBeVisible();
  await expect(page.getByTestId("tutorial-finished-title")).toHaveText("You built, checked and extended a model");
  await expect(page.getByTestId("tutorial-finished-summary")).toContainText(`${TOTAL} of ${TOTAL} steps done`);
  await expect(finished).toContainText("Yes: its 18 km of range covers the 15 km route");
  await expect(page.getByTestId("tutorial-skipped-list")).toHaveCount(0);
  // It points to the tutorial that builds on this one.
  await expect(page.getByTestId("button-tutorial-next-tutorial")).toContainText(PPR_TUTORIAL.title);
});

test("the PPR tutorial leads from a requirement to product, process and resource", async ({ page }) => {
  test.setTimeout(180_000);
  const P = PPR_TUTORIAL;
  const total = tutorialSteps(P).length;
  const lesson = (index: number, options: { wrongFirst?: boolean } = {}) =>
    finishLesson(page, index, { ...options, tutorial: P });
  const add = async (type: string, name: string, value?: string) => {
    await page.getByRole("tab", { name: "Add elements" }).click();
    await page.locator('[data-testid^="button-insert-referenced-class-"]', { hasText: new RegExp(`^${type}`) }).click();
    await card(page, `New ${type}`).dblclick();
    await page.getByTestId("input-node-label").fill(name);
    if (value !== undefined) await page.getByTestId("input-attr-value-0").fill(value);
    await saveEditor(page);
  };
  const issues = page.getByTestId("validation-results");
  await startTutorial(page, P);
  await expect(page.locator(".react-flow__node")).toHaveCount(5);
  await expectProgress(page, 0, total);

  // --- Lesson 1: product, process, resource ---
  await card(page, "Process").dblclick();
  await expectDone(page, "open-process-type");
  await cancelEditor(page);
  await openOtherProject(page, "Laser cutting");
  await expectDone(page, "open-model");
  await card(page, "Laser cutting").dblclick();
  await expect(page.getByTestId("tutorial-recap")).toBeVisible();
  await cancelEditor(page);
  await lesson(0, { wrongFirst: true });

  // --- Lesson 2: start from the requirements ---
  // The metamodel first has to allow PPR elements to satisfy requirements.
  await openOtherProject(page, "PPR element");
  await connect(page, "PPR element", "top", "Requirement", "bottom");
  await expectDone(page, "relate-satisfies");
  await saveDiagram(page);
  await expectDone(page, "save-metamodel");
  await openOtherProject(page, "Bracket");
  // The trace runs from what satisfies to the requirement, not back.
  await connect(page, "Carries 5 kg", "left", "Bracket", "left");
  await expect.poll(() => stepState(page, "trace-load")).toBe("current");
  await connect(page, "Bracket", "top", "Carries 5 kg", "bottom");
  await expectDone(page, "trace-load");
  await add("Requirement", "Mounting angle", "90 degrees, plus or minus 1");
  await expectDone(page, "add-requirement");
  await connect(page, "Bracket", "right", "Mounting angle", "right");
  await lesson(1);

  // --- Lesson 3: derive the process ---
  await add("Process", "Bending", "15");
  await expectDone(page, "add-process");
  await connect(page, "Blank", "bottom", "Bending", "top");
  await expectDone(page, "process-input");
  await connect(page, "Bending", "left", "Bracket", "top");
  await lesson(2);

  // --- Lesson 4: check completeness ---
  // The trace drawn the wrong way round above is not in the metamodel: it is reported.
  await page.getByTestId("button-toolbar-validate").click();
  await expect(issues).toContainText("Corrosion protection: Nothing satisfies this requirement yet.");
  await expect(issues).toContainText("is not allowed");
  await expectDone(page, "validate");
  await page.getByTestId("validation-issue-1").click();
  await page.keyboard.press("Delete");
  const confirmDelete = page.getByRole("alertdialog").getByRole("button", { name: /delete/i });
  if (await confirmDelete.isVisible().catch(() => false)) await confirmDelete.click();
  // The sidebar stays usable while the results are open.
  await expect(page.getByTestId("tutorial-coach")).toHaveAttribute("data-side", "right");
  await page.getByTestId("button-model-rules").click();
  await expectDone(page, "open-rules");
  const rules = page.getByTestId("model-rules-panel");
  await page.getByTestId("button-add-rule").click();
  await rules.getByLabel("Rule name").last().fill("Every process has a resource");
  const lists = rules.getByRole("combobox");
  const firstOfNewRule = (await lists.count()) - 6;
  const choose = async (offset: number, option: string) => {
    await lists.nth(firstOfNewRule + offset).click();
    await page.getByRole("option", { name: option, exact: true }).click();
  };
  await choose(0, "Process");
  await choose(2, "Incoming from");
  await choose(3, "none");
  await choose(4, "Resource");
  await choose(5, "Name");
  await choose(6, "is set");
  await choose(7, "report an issue");
  await page.getByTestId("button-save-rules").click();
  await expectDone(page, "add-rule");
  await rules.getByLabel("Close model rules").click();
  await page.getByTestId("button-toolbar-validate").click();
  // The learner's rule finds the process nobody executes, and only that one.
  await expect(issues).toContainText("Every process has a resource: Bending");
  await expect(issues).not.toContainText("Every process has a resource: Laser cutting");
  await lesson(3);

  // --- Lesson 5: assign the resource ---
  await add("Resource", "Press brake", "45");
  await expectDone(page, "add-resource");
  await connect(page, "Press brake", "top", "Bending", "right");
  await expectDone(page, "assign-resource");
  await page.getByTestId("button-validate-again").click();
  await expect(issues).not.toContainText("Bending");
  await lesson(4);

  // --- Lesson 6: close the last gap, without instructions ---
  await add("Process", "Powder coating");
  await add("Product", "Coated bracket");
  await connect(page, "Bracket", "bottom", "Powder coating", "left");
  // A process with nothing coming out is not finished.
  await expect.poll(() => stepState(page, "own-process")).toBe("current");
  await connect(page, "Powder coating", "right", "Coated bracket", "left");
  await expectDone(page, "own-process");
  await add("Resource", "Coating booth");
  await connect(page, "Coating booth", "top", "Powder coating", "bottom");
  await expectDone(page, "own-resource");
  await connect(page, "Powder coating", "top", "Corrosion protection", "bottom");
  await expectDone(page, "own-trace");
  await page.getByTestId("button-toolbar-validate").click();

  const finished = page.getByTestId("tutorial-finished");
  await expect(finished).toBeVisible();
  await expect(page.getByTestId("tutorial-finished-title")).toHaveText(P.finishedTitle);
  await expect(page.getByTestId("tutorial-finished-summary")).toContainText(`${total} of ${total} steps done`);
  await expect(finished).toContainText(P.answer);
  // The last tutorial has no next one to point to.
  await expect(page.getByTestId("button-tutorial-next-tutorial")).toHaveCount(0);
});

test("skipping is not doing, the coach stays out of the way, and the tutorial can start over", async ({ page, request }) => {
  await startTutorial(page);

  // The diagram is fitted clear of the coach, and not zoomed in beyond 100%.
  await expect
    .poll(() =>
      page.evaluate(() => {
        const coach = document.querySelector('[data-testid="tutorial-coach"]')!.getBoundingClientRect();
        return Array.from(document.querySelectorAll(".react-flow__node")).filter((node) => {
          const box = node.getBoundingClientRect();
          return box.right > coach.left && box.bottom > coach.top && box.top < coach.bottom;
        }).length;
      }),
    )
    .toBe(0);
  const zoom = await page.locator(".react-flow__viewport").evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a);
  expect(zoom).toBeLessThanOrEqual(1);
  // A freshly opened tutorial diagram has no unsaved changes, so the coach can navigate freely.
  await expect(page.getByTestId("button-save-diagram-header")).toBeDisabled();

  // "Show me" points at the element to open.
  await page.getByTestId("button-tutorial-show-me").click();
  await expect(card(page, "Drone")).toHaveClass(/tutorial-spotlight/);

  // With an editor open the coach moves aside, stays readable and usable,
  // and using it does not close the editor.
  await card(page, "Battery").dblclick();
  const editor = page.getByTestId("node-attribute-panel");
  await expect(editor).toBeVisible();
  const coach = page.getByTestId("tutorial-coach");
  await expect(coach).toHaveAttribute("data-side", "left");
  const overlap = await page.evaluate(() => {
    const a = document.querySelector('[data-testid="tutorial-coach"]')!.getBoundingClientRect();
    const b = document.querySelector('[data-testid="node-attribute-panel"]')!.getBoundingClientRect();
    return a.right > b.left && a.left < b.right;
  });
  expect(overlap).toBe(false);
  await page.getByTestId("button-tutorial-hint").click();
  await expect(coach).toContainText("seven built-in kinds");
  await expect(editor).toBeVisible();
  // Opening another type than the one asked for completes nothing.
  await expectProgress(page, 0);
  await cancelEditor(page);
  await expect(coach).toHaveAttribute("data-side", "right");

  // Skipping moves on, is counted apart, and never reads as done.
  await page.getByTestId("button-tutorial-skip").click();
  await expect(page.getByTestId("tutorial-step-open-type")).toHaveAttribute("data-state", "skipped");
  await expectProgress(page, 0);
  await expect(page.getByTestId("tutorial-skipped-count")).toContainText("1 skipped");

  // Progress survives a reload, and the coach can be minimised.
  await page.getByTestId("button-tutorial-collapse").click();
  await page.reload();
  await expect(page.getByTestId("button-tutorial-expand")).toContainText(`0/${TOTAL}`);
  await page.getByTestId("button-tutorial-expand").click();
  await expect(page.getByTestId("tutorial-step-open-type")).toHaveAttribute("data-state", "skipped");

  // Skip everything else; each lesson's question can be left unanswered.
  const skip = page.getByTestId("button-tutorial-skip");
  const next = page.getByTestId("button-tutorial-next-lesson");
  const finished = page.getByTestId("tutorial-finished");
  await expect(async () => {
    if (await finished.isVisible()) return;
    if (await next.isVisible()) await next.click({ timeout: 2_000 });
    else await skip.click({ timeout: 2_000 });
    await expect(finished).toBeVisible({ timeout: 250 });
  }).toPass({ timeout: 60_000, intervals: [50] });

  // The end is honest about it and offers the way back.
  await expect(page.getByTestId("tutorial-finished-title")).toContainText(`0 of ${TOTAL} steps done`);
  await expect(page.getByTestId("tutorial-skipped-list").locator("li")).toHaveCount(TOTAL);
  await expect(finished).not.toContainText("Yes: its 18 km of range");
  await page.getByTestId("button-tutorial-return-to-skipped").click();
  await expect(page.getByTestId("tutorial-lesson-title")).toHaveText(TUTORIAL_LESSONS[0].title);
  await expect(page.getByTestId("tutorial-step-open-type")).toHaveAttribute("data-state", "current");

  // Starting over replaces the projects and the progress.
  const projectsBefore = (await (await request.get("/api/projects")).json()) as Array<{ id: number; templateId: string | null }>;
  await page.getByTestId("button-tutorial-restart").click();
  await page.getByTestId("button-tutorial-restart-confirm").click();
  await expect(page.locator(".react-flow__node")).toHaveCount(3);
  await expectProgress(page, 0);
  await expect(page.getByTestId("tutorial-skipped-count")).toHaveCount(0);
  const projectsAfter = (await (await request.get("/api/projects")).json()) as Array<{ id: number; templateId: string | null }>;
  const tutorialIds = (list: typeof projectsAfter) => list.filter((project) => project.templateId === "tutorial").map((project) => project.id);
  expect(tutorialIds(projectsAfter)).toHaveLength(2);
  expect(tutorialIds(projectsAfter).some((id) => tutorialIds(projectsBefore).includes(id))).toBe(false);

  // The project list shows where to continue, and removing cleans up.
  await page.goto("/projects");
  await expect(page.getByTestId("tutorial-card-basics")).toContainText(`0 of ${TOTAL} steps done`);
  // The other tutorial is offered independently of this one.
  await expect(page.getByTestId("button-tutorial-start-ppr")).toBeVisible();
  await page.getByTestId("button-tutorial-remove-basics").click();
  await expect(page.getByTestId("button-tutorial-start-basics")).toBeVisible();
  const remaining = (await (await request.get("/api/projects")).json()) as Array<{ templateId: string | null }>;
  expect(remaining.filter((project) => project.templateId?.startsWith("tutorial"))).toEqual([]);
});
