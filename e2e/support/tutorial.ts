import { expect, type Page } from "@playwright/test";
import { tutorialSteps, type TutorialDefinition } from "../../shared/tutorial";

/*
 * Helpers for walking a guided tutorial as a learner would.
 *
 * The tests are full-stack: the real server creates the tutorial projects.
 * Tutorials are per workspace (one database), so a test only ever removes its
 * own tutorial, and a file that runs a tutorial must not run concurrently
 * with itself (avoid `--repeat-each`).
 */

export const stepState = (page: Page, id: string) => page.getByTestId(`tutorial-step-${id}`).getAttribute("data-state");
export const expectDone = (page: Page, id: string) =>
  expect.poll(() => stepState(page, id), { message: id }).toBe("done");
export const expectNotDone = (page: Page, id: string) =>
  expect.poll(() => stepState(page, id), { message: id }).not.toBe("done");
export const expectProgress = (page: Page, tutorial: TutorialDefinition, done: number) =>
  expect(page.getByTestId("tutorial-progress-count")).toContainText(`${done} of ${tutorialSteps(tutorial).length}`);
export const card = (page: Page, name: string) => page.locator(".react-flow__node", { hasText: name });

export async function startTutorial(page: Page, tutorial: TutorialDefinition) {
  await page.request.delete(`/api/tutorial/${tutorial.id}`);
  await page.goto("/projects");
  await page.getByTestId(`button-tutorial-start-${tutorial.id}`).click();
  await expect(page.getByTestId("tutorial-coach")).toBeVisible();
  await expect(page.getByTestId("tutorial-title")).toHaveText(tutorial.title);
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
}

/** Follows the coach's button to where the current step happens and waits for a card there. */
export async function openOtherProject(page: Page, expectCard: string) {
  await page.getByTestId("button-tutorial-open-project").click();
  await expect(card(page, expectCard).first()).toBeVisible();
}

/** Waits until the diagram has stopped moving (it re-fits when the coach changes sides). */
export async function waitForStillCanvas(page: Page) {
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

/** Draws a relationship from a side handle of one card to a side handle of another. */
export async function connect(page: Page, from: string, fromSide: string, to: string, toSide: string) {
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

/** Draws a relationship from a side handle of one card and lets go in the middle of another card. */
export async function dropOnCard(page: Page, from: string, fromSide: string, to: string) {
  await waitForStillCanvas(page);
  const handle = card(page, from).first().locator(`.react-flow__handle[data-handlepos="${fromSide}"]`).first();
  const start = (await handle.boundingBox())!;
  const target = (await card(page, to).first().boundingBox())!;
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 12 });
  await page.mouse.up();
}

/** Opens a card's editor. */
export async function openEditor(page: Page, name: string) {
  await waitForStillCanvas(page);
  await card(page, name).first().dblclick();
  await expect(page.getByTestId("node-attribute-panel")).toBeVisible();
}

/** Applies the open element editor. */
export const saveEditor = async (page: Page) => {
  await page.getByTestId("button-save-attributes").click();
  await expect(page.getByTestId("node-attribute-panel")).toBeHidden();
};
export const cancelEditor = async (page: Page) => {
  await page.getByTestId("button-cancel-attributes").click();
  await expect(page.getByTestId("node-attribute-panel")).toBeHidden();
};
export const saveDiagram = async (page: Page) => {
  await page.getByTestId("button-save-diagram-header").click();
  await expect(page.getByTestId("button-save-diagram-header")).toBeDisabled();
};

/** The position of an attribute in the open editor's list, by its name. */
export async function attributeIndex(page: Page, name: string) {
  const names = await page.getByTestId("node-attribute-panel").locator('[data-testid^="attribute-name-"]').allInnerTexts();
  const index = names.findIndex((candidate) => candidate.trim() === name);
  expect(index, `attribute ${name}`).toBeGreaterThanOrEqual(0);
  return index;
}

/** Sets attribute values of the element whose editor is open (numbers and text). */
export async function setValues(page: Page, values: Record<string, string | number>) {
  for (const [name, value] of Object.entries(values)) {
    const index = await attributeIndex(page, name);
    await page.getByTestId("node-attribute-panel").getByTestId(`input-attr-value-${index}`).fill(String(value));
  }
}

/** Adds an attribute in the open editor through the attribute dialog. */
export async function addAttribute(
  page: Page,
  attribute: { name: string; type?: string; value?: string | number; formula?: string; options?: string },
) {
  await page.getByTestId("button-add-attribute").click();
  const dialog = page.getByTestId("attribute-editor-dialog");
  await expect(dialog).toBeVisible();
  await dialog.locator('[data-testid^="input-attr-name-"]').fill(attribute.name);
  if (attribute.type) {
    await dialog.locator('[data-testid^="select-attr-type-"]').click();
    await page.getByRole("option", { name: attribute.type, exact: true }).click();
  }
  if (attribute.options !== undefined) await dialog.locator('[data-testid^="input-attr-options-"]').fill(attribute.options);
  if (attribute.value !== undefined) {
    await dialog.locator('input[data-testid^="input-attr-value-"]').fill(String(attribute.value));
  }
  if (attribute.formula) await dialog.locator('[data-testid^="input-attr-formula-"]').fill(attribute.formula);
  await page.getByTestId("button-attribute-done").click();
  await expect(dialog).toBeHidden();
}

/** Places a new element of a type from the Add elements tab and returns nothing; it is named "New <type> n". */
export async function addElementOfType(page: Page, type: string) {
  await page.getByRole("tab", { name: "Add elements" }).click();
  await page.locator('[data-testid^="button-insert-referenced-class-"]', { hasText: new RegExp(`^${type}`) }).click();
  await expect(card(page, `New ${type}`).first()).toBeVisible();
}

/** A cell of the elements table, by the element's name and the attribute's name. */
export const tableCell = (page: Page, element: string, attribute: string) =>
  page
    .locator(`[data-testid="table-element-row"][data-element-name="${element}"]`)
    .locator(`[data-testid="table-attribute-${attribute}"]`);

/**
 * Adds a model rule in the open rules panel. The lists of a new rule are, in
 * order: elements, all/any, what the condition is about, the field, the
 * comparison, the outcome. `choices` maps their position to the option to pick.
 */
export async function addRule(
  page: Page,
  rule: { name: string; choices: Array<[number, string]>; value?: string; tag?: string },
) {
  const panel = page.getByTestId("model-rules-panel");
  await page.getByTestId("button-add-rule").click();
  await panel.getByLabel("Rule name").last().fill(rule.name);
  const lists = panel.getByRole("combobox");
  const first = (await lists.count()) - 6;
  for (const [offset, option] of rule.choices) {
    await lists.nth(first + offset).click();
    await page.getByRole("option", { name: option, exact: true }).click();
  }
  if (rule.value !== undefined) await panel.getByPlaceholder("value").last().fill(rule.value);
  if (rule.tag !== undefined) await panel.getByPlaceholder("e.g. Heavy").last().fill(rule.tag);
  await page.getByTestId("button-save-rules").click();
  await expect(page.getByText("Model rules saved").first()).toBeVisible();
}

/** Answers the lesson's question (optionally wrongly first) and moves on. */
export async function finishLesson(
  page: Page,
  tutorial: TutorialDefinition,
  lessonIndex: number,
  options: { wrongFirst?: boolean } = {},
) {
  const lesson = tutorial.lessons[lessonIndex];
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
  await expect(page.getByTestId("tutorial-lesson-title")).toHaveText(tutorial.lessons[lessonIndex + 1].title);
}

/** The end screen of a tutorial done without skipping. */
export async function expectFinished(page: Page, tutorial: TutorialDefinition) {
  const total = tutorialSteps(tutorial).length;
  const finished = page.getByTestId("tutorial-finished");
  await expect(finished).toBeVisible();
  await expect(page.getByTestId("tutorial-finished-title")).toHaveText(tutorial.finishedTitle);
  await expect(page.getByTestId("tutorial-finished-summary")).toContainText(`${total} of ${total} steps done`);
  await expect(finished).toContainText(tutorial.answer);
  await expect(page.getByTestId("tutorial-skipped-list")).toHaveCount(0);
}

/** Double-clicks the middle of a relationship's line: the one drawn last unless an index is given. */
export async function openRelationship(page: Page, index?: number) {
  await waitForStillCanvas(page);
  const paths = page.locator(".react-flow__edge .react-flow__edge-path");
  const count = await paths.count();
  const point = await paths.nth(index ?? count - 1).evaluate((path) => {
    const line = path as SVGPathElement;
    const at = line.getPointAtLength(line.getTotalLength() / 2);
    const matrix = line.getScreenCTM()!;
    return { x: at.x * matrix.a + at.y * matrix.c + matrix.e, y: at.x * matrix.b + at.y * matrix.d + matrix.f };
  });
  await page.mouse.dblclick(point.x, point.y);
  await expect(page.getByTestId("edge-attribute-panel")).toBeVisible();
}

/** Applies the open relationship editor. */
export async function saveRelationship(page: Page) {
  await page.getByTestId("button-save-edge").click();
  await expect(page.getByTestId("edge-attribute-panel")).toBeHidden();
}

/** Shows an element of another diagram in the open one, from the Diagrams tab. */
export async function showExistingElement(page: Page, fromDiagram: string, element: string) {
  await page.getByRole("tab", { name: "Diagrams" }).click();
  const insert = page.locator('[data-sidebar="sidebar"] li', { hasText: element }).last().locator('[data-testid^="button-insert-node-"]');
  if (!(await insert.count())) {
    await page.locator(`[data-testid^="button-toggle-view-elements-"][data-view-name="${fromDiagram}"]`).click();
  }
  await page.locator('[data-sidebar="sidebar"] li', { hasText: element }).last().hover();
  await insert.click();
  await expect(card(page, element).first()).toBeVisible();
}

/** Confirms the relationship Symlit suggests for the one just drawn, choosing by name when it offers several. */
export async function confirmSuggestion(page: Page, choose?: string) {
  const list = page.locator('select[aria-label="Choose metamodel relationship"]');
  // With one allowed relationship there is nothing to choose; with several, a list.
  if (choose && (await list.count()) > 0) {
    const label = (await list.locator("option").allInnerTexts()).find((option) => option.includes(choose));
    expect(label, `a suggested relationship named ${choose}`).toBeTruthy();
    await list.selectOption({ label: label! });
  } else if (choose) {
    await expect(page.locator('[aria-label^="Confirm metamodel relationship"]').first()).toHaveAttribute(
      "aria-label",
      new RegExp(choose),
    );
  }
  // The control sits on the line, which cards may overlap: click it directly.
  await page.locator('[aria-label^="Confirm metamodel relationship"]').first().dispatchEvent("click");
  await expect(page.locator('[aria-label^="Confirm metamodel relationship"]')).toHaveCount(0);
}
