import { expect, test } from "@playwright/test";
import { CALC_TUTORIAL as T } from "../shared/tutorial-calc";
import {
  addAttribute,
  addElementOfType,
  addRule,
  attributeIndex,
  cancelEditor,
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

// The tutorial on calculated attributes, walked as a learner would.

test("Calculate with attributes: formulas on a type, results on every job, a rule on the margin", async ({ page }) => {
  test.setTimeout(240_000);
  await startTutorial(page, T);
  await expectProgress(page, T, 0);
  const panel = page.getByTestId("node-attribute-panel");

  // --- Lesson 1: attributes have types ---
  await openEditor(page, "Print job");
  await expectDone(page, "open-job-type");
  await expect(panel).toContainText("Yes/No");
  await cancelEditor(page);
  await openOtherProject(page, "Cable clip");
  await expectDone(page, "open-model");
  await openEditor(page, "Cable clip");
  // The list is chosen from, the numbers are typed.
  await panel.getByTestId(`input-attr-value-${await attributeIndex(page, "material")}`).click();
  await page.getByRole("option", { name: "PETG", exact: true }).click();
  await setValues(page, { mass: 20, "print time": 1, price: 6 });
  await saveEditor(page);
  await saveDiagram(page);
  // Saved, but rush order is still No: the step asks for all values given.
  await expectNotDone(page, "fill-job");
  await openEditor(page, "Cable clip");
  await panel.getByTestId(`input-attr-value-${await attributeIndex(page, "rush order")}`).click();
  await saveEditor(page);
  // Applied but not saved: the step asks for both.
  await expectNotDone(page, "fill-job");
  await saveDiagram(page);
  await finishLesson(page, T, 0, { wrongFirst: true });

  // --- Lesson 2: a first formula ---
  await openOtherProject(page, "Print job");
  await openEditor(page, "Print job");
  await addAttribute(page, { name: "machine rate", value: 4 });
  await saveEditor(page);
  await expectDone(page, "add-rate");
  // A formula with the rate typed in as a number is not what the step asks for.
  await openEditor(page, "Print job");
  await addAttribute(page, { name: "machine cost", type: "Derived Formula", formula: "[print time] * 4" });
  await saveEditor(page);
  await expectNotDone(page, "add-machine-cost");
  await openEditor(page, "Print job");
  const machineCost = await attributeIndex(page, "machine cost");
  await page.getByTestId(`button-attr-open-${machineCost}`).click();
  await page.getByTestId(`input-attr-formula-${machineCost}`).fill("[print time] * [machine rate]");
  // On the type the result cannot be calculated yet, and that does not block anything.
  await expect(page.getByTestId("attribute-editor-dialog")).toContainText('Not calculated yet: "print time" has no value yet.');
  await page.getByTestId("button-attribute-done").click();
  await saveEditor(page);
  await expectDone(page, "add-machine-cost");
  // Saving with the keyboard counts as saving.
  await page.keyboard.press("ControlOrMeta+s");
  await finishLesson(page, T, 1);

  // --- Lesson 3: formulas build on formulas ---
  // Renaming an input: the formula follows the new name.
  await openEditor(page, "Print job");
  const rate = await attributeIndex(page, "machine rate");
  await page.getByTestId(`button-attr-open-${rate}`).click();
  await page.getByTestId(`input-attr-name-${rate}`).fill("hourly rate");
  await page.getByTestId("button-attribute-done").click();
  await page.getByTestId(`button-attr-open-${await attributeIndex(page, "machine cost")}`).click();
  await expect(page.getByTestId(`input-attr-formula-${await attributeIndex(page, "machine cost")}`)).toHaveValue(
    "[print time] * [hourly rate]",
  );
  await page.getByTestId("button-attribute-done").click();
  await saveEditor(page);
  await expectDone(page, "rename-rate");
  await openEditor(page, "Print job");
  // Without the conversion from grams the material cost is a thousand times too high.
  await addAttribute(page, { name: "material price" });
  await addAttribute(page, { name: "material cost", type: "Derived Formula", formula: "[mass] * [material price]" });
  await saveEditor(page);
  await expectNotDone(page, "add-material-cost");
  await openEditor(page, "Print job");
  const materialCost = await attributeIndex(page, "material cost");
  await page.getByTestId(`button-attr-open-${materialCost}`).click();
  await page.getByTestId(`input-attr-formula-${materialCost}`).fill("[mass] / 1000 * [material price]");
  await page.getByTestId("button-attribute-done").click();
  await saveEditor(page);
  await expectDone(page, "add-material-cost");
  await openEditor(page, "Print job");
  await addAttribute(page, { name: "total cost", type: "Derived Formula", formula: "[machine cost] + [material cost]" });
  // The margin the wrong way round: a job that loses money would look profitable.
  await addAttribute(page, { name: "margin", type: "Derived Formula", formula: "[total cost] - [price]" });
  await saveEditor(page);
  await expectDone(page, "add-total-cost");
  await expectNotDone(page, "add-margin");
  await openEditor(page, "Print job");
  const margin = await attributeIndex(page, "margin");
  await page.getByTestId(`button-attr-open-${margin}`).click();
  await page.getByTestId(`input-attr-formula-${margin}`).fill("[price] - [total cost]");
  await page.getByTestId("button-attribute-done").click();
  await saveEditor(page);
  await expectDone(page, "add-margin");
  await saveDiagram(page);
  await finishLesson(page, T, 2);

  // --- Lesson 4: from the type to the jobs ---
  await openOtherProject(page, "Phone stand");
  await openEditor(page, "Phone stand");
  await expect(page.getByTestId("attributes-missing-from-type")).toContainText("defines 6 attributes this element does not have");
  await page.getByTestId("button-add-missing-attributes").click();
  await setValues(page, { "material price": 25 });
  // The job calculates with its own numbers, and with the default it was given.
  await expect(panel.getByTestId(`attribute-summary-${await attributeIndex(page, "total cost")}`)).toContainText("13.5");
  await saveEditor(page);
  await expectDone(page, "add-missing");
  for (const job of ["Gear housing", "Cable clip"]) {
    await openEditor(page, job);
    await page.getByTestId("button-add-missing-attributes").click();
    await saveEditor(page);
  }
  // Without a material price the margin cannot be calculated: not done yet.
  await expectNotDone(page, "complete-jobs");
  await page.getByTestId("button-toolbar-table").click();
  await tableCell(page, "Gear housing", "material price").locator("input").fill("30");
  await tableCell(page, "Cable clip", "material price").locator("input").fill("30");
  // Calculated cells follow what is typed into the table.
  await expect(tableCell(page, "Gear housing", "margin")).toContainText("-3.2");
  await expect(tableCell(page, "Cable clip", "total cost")).toContainText("4.6");
  await expectDone(page, "complete-jobs");
  await page.getByTestId("button-toolbar-graph").click();
  await addElementOfType(page, "Print job");
  await openEditor(page, "New Print job");
  await page.getByTestId("input-node-label").fill("Lamp shade");
  await setValues(page, { mass: 180, "print time": 11, price: 55, "material price": 25 });
  await saveEditor(page);
  await finishLesson(page, T, 3);

  // --- Lesson 5: let the model answer ---
  await page.getByTestId("button-toolbar-table").click();
  await expectDone(page, "read-margins");
  await expect(tableCell(page, "Lamp shade", "margin")).toContainText("6.5");
  await page.getByTestId("button-toolbar-graph").click();
  await page.getByTestId("button-model-rules").click();
  // A rule that looks at the price is not the rule on the margin.
  await addRule(page, {
    name: "Cheap jobs",
    choices: [[0, "Print job"], [3, "price"], [4, "is less than"], [5, "report an issue"]],
    value: "0",
  });
  await expectNotDone(page, "add-rule");
  await addRule(page, {
    name: "No job below cost",
    choices: [[0, "Print job"], [3, "margin"], [4, "is less than"], [5, "report an issue"]],
    value: "0",
  });
  await expectDone(page, "add-rule");
  await page.getByTestId("model-rules-panel").getByLabel("Close model rules").click();
  await page.getByTestId("button-toolbar-validate").click();
  const issues = page.getByTestId("validation-results");
  await expect(issues).toContainText("No job below cost: Gear housing");
  await expect(issues).not.toContainText("Phone stand");
  await expectDone(page, "validate");
  // Correcting the price in the table moves the margin at once.
  await page.getByTestId("button-toolbar-table").click();
  await tableCell(page, "Gear housing", "price").locator("input").fill("70");
  await expect(tableCell(page, "Gear housing", "margin")).toContainText("6.8");
  // Corrected but not saved: not done yet.
  await expectNotDone(page, "fix-price");
  await saveDiagram(page);
  await expectDone(page, "fix-price");
  await page.getByTestId("button-toolbar-graph").click();
  await page.getByTestId("button-toolbar-validate").click();
  await finishLesson(page, T, 4);

  // --- Lesson 6: on your own ---
  await openOtherProject(page, "Print job");
  await openEditor(page, "Print job");
  await addAttribute(page, { name: "energy price", value: 0.05 });
  await addAttribute(page, { name: "energy cost", type: "Derived Formula", formula: "[print time] * [energy price]" });
  await saveEditor(page);
  // The energy cost exists, but the total does not include it yet.
  await saveDiagram(page);
  await expectNotDone(page, "own-formula");
  await openEditor(page, "Print job");
  const totalCost = await attributeIndex(page, "total cost");
  await page.getByTestId(`button-attr-open-${totalCost}`).click();
  await page.getByTestId(`input-attr-formula-${totalCost}`).fill("[machine cost] + [material cost] + [energy cost]");
  await page.getByTestId("button-attribute-done").click();
  await saveEditor(page);
  await saveDiagram(page);
  await expectDone(page, "own-formula");
  await openOtherProject(page, "Lamp shade");
  await addElementOfType(page, "Print job");
  await openEditor(page, "New Print job");
  await page.getByTestId("input-node-label").fill("Planter");
  await setValues(page, { mass: 300, "print time": 16, price: 90, "material price": 25 });
  // 64 machine + 7.5 material + 0.8 energy.
  await expect(panel.getByTestId(`attribute-summary-${await attributeIndex(page, "total cost")}`)).toContainText("72.3");
  await saveEditor(page);
  await expectDone(page, "own-job");
  // Validated before saving: not done yet.
  await page.getByTestId("button-toolbar-validate").click();
  await expectNotDone(page, "own-validate");
  await saveDiagram(page);
  await page.getByTestId("button-toolbar-validate").click();

  await expectFinished(page, T);
});
