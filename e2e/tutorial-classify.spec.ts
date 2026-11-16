import { expect, test, type Page } from "@playwright/test";
import { CLASSIFY_TUTORIAL as T } from "../shared/tutorial-classify";
import {
  cancelEditor,
  card,
  expectDone,
  expectFinished,
  expectNotDone,
  expectProgress,
  finishLesson,
  openEditor,
  openOtherProject,
  saveDiagram,
  saveEditor,
  setValues,
  startTutorial,
  tableCell,
} from "./support/tutorial";

// The tutorial on rules that tag, walked as a learner would.

const rulesPanel = (page: Page) => page.getByTestId("model-rules-panel");

async function openRules(page: Page) {
  if (!(await rulesPanel(page).isVisible())) await page.getByTestId("button-model-rules").click();
  await expect(rulesPanel(page)).toBeVisible();
}

async function closeRules(page: Page) {
  if (await rulesPanel(page).isVisible()) await rulesPanel(page).getByLabel("Close model rules").click();
  await expect(rulesPanel(page)).toBeHidden();
}

/**
 * Adds a rule that tags components. A new rule's lists are: elements,
 * all/any, then for each condition what it is about, the field and the
 * comparison, and last the outcome.
 */
async function addTagRule(
  page: Page,
  rule: { name: string; conditions: Array<[string, string, string?]>; tag: string; match?: "all" | "any" },
) {
  await openRules(page);
  const panel = rulesPanel(page);
  await page.getByTestId("button-add-rule").click();
  await panel.getByLabel("Rule name").last().fill(rule.name);
  const first = (await panel.getByRole("combobox").count()) - 6;
  const choose = async (offset: number, option: string) => {
    await panel.getByRole("combobox").nth(first + offset).click();
    await page.getByRole("option", { name: option, exact: true }).click();
  };
  await choose(0, "Component");
  if (rule.match) await choose(1, rule.match);
  for (const [index, [field, comparison, value]] of Array.from(rule.conditions.entries())) {
    if (index > 0) await panel.getByRole("button", { name: "Condition" }).last().click();
    await choose(3 + index * 3, field);
    await choose(4 + index * 3, comparison);
    if (value !== undefined) await panel.getByPlaceholder("value").last().fill(value);
  }
  await panel.getByPlaceholder("e.g. Heavy").last().fill(rule.tag);
  await page.getByTestId("button-save-rules").click();
  await expect(page.getByText("Model rules saved").first()).toBeVisible();
}

const visibleRows = (page: Page) =>
  page.locator('[data-testid="table-element-row"]').evaluateAll((rows) => rows.map((row) => (row as HTMLElement).dataset.elementName));

test("Classify and review: rules that tag, combined, for every model, reviewed in the table", async ({ page }) => {
  test.setTimeout(240_000);
  await startTutorial(page, T);
  await expectProgress(page, T, 0);

  // --- Lesson 1: a tag instead of an issue ---
  await openEditor(page, "Component");
  await expectDone(page, "open-part-type");
  await cancelEditor(page);
  await openOtherProject(page, "Safety relay");
  await expectDone(page, "open-model");
  // A rule that reports an issue is not a tag.
  await openRules(page);
  await addTagRule(page, { name: "Long lead time", conditions: [["lead time", "is greater than", "60"]], tag: "Long lead" });
  await expectDone(page, "tag-long-lead");
  await closeRules(page);
  // The tag is on the cards, and validation has nothing to report.
  await expect(card(page, "PLC")).toContainText("Long lead");
  await expect(card(page, "HMI panel")).toContainText("Long lead");
  await expect(card(page, "Fan")).not.toContainText("Long lead");
  await openEditor(page, "HMI panel");
  await setValues(page, { "lead time": 30 });
  await saveEditor(page);
  await expect(card(page, "HMI panel")).not.toContainText("Long lead");
  await finishLesson(page, T, 0, { wrongFirst: true });

  // --- Lesson 2: conditions on facts and choices ---
  await addTagRule(page, { name: "One supplier", conditions: [["single source", "is true"]], tag: "Single source" });
  await expectDone(page, "tag-single-source");
  // A rule for another value of the list is not the rule for critical parts.
  await addTagRule(page, { name: "Critical part", conditions: [["criticality", "equals", "medium"]], tag: "Critical" });
  await expectNotDone(page, "tag-critical");
  await rulesPanel(page).getByPlaceholder("value").last().fill("high");
  await page.getByTestId("button-save-rules").click();
  await expectDone(page, "tag-critical");
  await closeRules(page);
  await expect(card(page, "Fan")).not.toContainText("Critical");
  await openEditor(page, "Fan");
  await page.getByTestId("node-attribute-panel").getByTestId("input-attr-value-2").click();
  await page.getByRole("option", { name: "high", exact: true }).click();
  await saveEditor(page);
  await expect(card(page, "Fan")).toContainText("Critical");
  await finishLesson(page, T, 1);

  // --- Lesson 3: combine conditions ---
  // With "any", one condition is enough: that is not the question.
  await addTagRule(page, {
    name: "Needs a second supplier",
    conditions: [["single source", "is true"], ["criticality", "equals", "high"]],
    tag: "Second source",
    match: "any",
  });
  await expectNotDone(page, "tag-second-source");
  const lists = rulesPanel(page).getByRole("combobox");
  await lists.nth((await lists.count()) - 8).click();
  await page.getByRole("option", { name: "all", exact: true }).click();
  await page.getByTestId("button-save-rules").click();
  await expectDone(page, "tag-second-source");
  await rulesPanel(page).getByLabel("Enable One supplier").click();
  await rulesPanel(page).getByLabel("Enable Critical part").click();
  await page.getByTestId("button-save-rules").click();
  await expectDone(page, "switch-off");
  await closeRules(page);
  await expect(card(page, "Safety relay")).toContainText("Second source");
  await expect(card(page, "Safety relay")).not.toContainText("Single source");
  await page.getByTestId("button-toolbar-table").click();
  // Tags have a column in the table.
  await expect(page.getByTestId("table-tags-column")).toBeVisible();
  await expect(page.locator('[data-testid="table-element-row"][data-element-name="PLC"] [data-testid="table-tags"]')).toContainText("Second source");
  await finishLesson(page, T, 2);

  // --- Lesson 4: a rule for every cabinet ---
  await page.getByTestId("button-toolbar-graph").click();
  await saveDiagram(page);
  await openOtherProject(page, "Cabinet");
  await addTagRule(page, {
    name: "Needs a second supplier",
    conditions: [["single source", "is true"], ["criticality", "equals", "high"]],
    tag: "Second source",
  });
  await expectDone(page, "meta-rule");
  await closeRules(page);
  await openOtherProject(page, "Safety relay");
  await openRules(page);
  await expectDone(page, "see-inherited");
  // The inherited rule is listed with the name of its type, and cannot be edited.
  const inherited = page.getByTestId("inherited-model-rules");
  await expect(inherited).toContainText("Meta rule");
  await expect(inherited).toContainText("For Component:");
  // Opening the panel is not removing the copy.
  await expectNotDone(page, "remove-local");
  await rulesPanel(page).getByLabel("Delete Needs a second supplier").click();
  await page.getByTestId("button-save-rules").click();
  await finishLesson(page, T, 3);

  // --- Lesson 5: review in the table ---
  await closeRules(page);
  // The tag now comes from the metamodel.
  await expect(card(page, "PLC")).toContainText("Second source");
  await page.getByTestId("button-toolbar-table").click();
  await page.getByTestId("input-node-table-filter").fill("Second source");
  await expectDone(page, "filter-table");
  expect(await visibleRows(page)).toEqual(["PLC", "Safety relay"]);
  await tableCell(page, "Safety relay", "single source").locator("select").selectOption("false");
  await expectDone(page, "edit-in-table");
  await expect.poll(() => visibleRows(page)).toEqual(["PLC"]);
  await page.getByTestId("input-node-table-filter").fill("");
  await saveDiagram(page);
  await page.getByTestId("button-export-project").click();
  // The project file is not the CSV the step asks for.
  await page.getByTestId("select-export-format").click();
  await page.getByRole("option", { name: "Model elements (CSV)" }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("dialog").getByRole("button", { name: "Download" }).click();
  expect((await download).suggestedFilename()).toMatch(/\.csv$/);
  await finishLesson(page, T, 4);

  // --- Lesson 6: on your own ---
  await openOtherProject(page, "Cabinet");
  await addTagRule(page, {
    name: "Order early",
    conditions: [["lead time", "is greater than", "30"], ["criticality", "equals", "high"]],
    tag: "Order early",
  });
  await expectDone(page, "own-rule");
  await closeRules(page);
  await openOtherProject(page, "Safety relay");
  await page.getByTestId("button-toolbar-table").click();
  await page.getByTestId("input-node-table-filter").fill("Order early");
  await expectDone(page, "own-result");
  expect(await visibleRows(page)).toEqual(["PLC", "Safety relay"]);
  await tableCell(page, "PLC", "lead time").locator("input").fill("10");

  await expectFinished(page, T);
});
