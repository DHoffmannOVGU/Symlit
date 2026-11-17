import { expect, test, type Page } from "@playwright/test";
import { REUSE_TUTORIAL as T } from "../shared/tutorial-reuse";
import {
  addElementOfType,
  cancelEditor,
  card,
  confirmSuggestion,
  connect,
  expectDone,
  expectFinished,
  expectNotDone,
  expectProgress,
  finishLesson,
  openEditor,
  openOtherProject,
  saveDiagram,
  saveEditor,
  startTutorial,
  stepState,
  waitForStillCanvas,
} from "./support/tutorial";

// The tutorial on reuse, walked as a learner would. Most of it happens in a
// copy of the tutorial's model, and on the project list.

type ProjectRow = { id: number; name: string; projectType: string; templateId: string | null; referencedMetamodels: number[] | null };
const projects = async (page: Page) => (await (await page.request.get("/api/projects")).json()) as ProjectRow[];

async function pickColour(page: Page, element: string, colour: string) {
  await openEditor(page, element);
  await page.getByRole("tab", { name: "Styling" }).click();
  await page.getByTestId("button-pick-color").click();
  await page.getByTestId(`button-color-${colour}`).click();
  await saveEditor(page);
}

async function rename(page: Page, element: string, name: string) {
  await waitForStillCanvas(page);
  await card(page, element).first().click({ position: { x: 12, y: 12 } });
  await page.keyboard.press("F2");
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type(name);
  await page.keyboard.press("Enter");
  await expect(card(page, name).first()).toBeVisible();
}

async function deleteElement(page: Page, element: string) {
  await waitForStillCanvas(page);
  await card(page, element).first().click({ position: { x: 12, y: 12 } });
  await page.keyboard.press("Delete");
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await expect(card(page, element)).toHaveCount(0);
}

async function deleteProject(page: Page, project: ProjectRow) {
  await page.getByTestId(`button-delete-project-${project.id}`).click();
  const dialog = page.getByRole("alertdialog");
  await dialog.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByTestId(`button-delete-project-${project.id}`)).toHaveCount(0);
}

test("Reuse and variants: styles, a copy, a pattern library, a second metamodel, a file", async ({ page }, testInfo) => {
  test.setTimeout(300_000);
  await startTutorial(page, T);
  await expectProgress(page, T, 0);

  // --- Lesson 1: a style for every element of a type ---
  await pickColour(page, "Battery", "Amber");
  await expectDone(page, "style-type");
  await saveDiagram(page);
  await expectDone(page, "save-style");
  await openOtherProject(page, "Battery pack");
  // The element follows its type's new colour.
  await expectDone(page, "see-style");
  // Opening the Controller and closing it again does not give it a style of its own.
  await openEditor(page, "Controller");
  await page.getByRole("tab", { name: "Styling" }).click();
  await cancelEditor(page);
  await expect.poll(() => stepState(page, "own-style")).toBe("current");
  await pickColour(page, "Controller", "Rose");
  await finishLesson(page, T, 0, { wrongFirst: true });

  // --- Lesson 2: a variant from a copy ---
  await saveDiagram(page);
  await expect(page.getByTestId("button-tutorial-open-project")).toHaveText("Go to All projects");
  await page.getByTestId("button-tutorial-open-project").click();
  // The coach is on the project list too.
  await expect(page.getByTestId("tutorial-coach")).toBeVisible();
  await page.getByRole("button", { name: "Duplicate Tutorial · Sensor node S1" }).click();
  // The copy opens, and the coach follows into it.
  await expect(card(page, "Battery pack")).toBeVisible();
  await expect(page.getByTestId("tutorial-coach")).toContainText("in Copy of Tutorial · Sensor node S1");
  await expectDone(page, "duplicate");
  await rename(page, "S1", "S2");
  await expectDone(page, "rename-node");
  await openEditor(page, "Temperature sensor");
  await page.getByTestId("input-node-label").fill("Humidity sensor");
  await page.getByTestId("node-attribute-panel").getByTestId("input-attr-value-0").click();
  await page.getByRole("option", { name: "humidity", exact: true }).click();
  await saveEditor(page);
  await expectNotDone(page, "change-sensor");
  await saveDiagram(page);
  await expectDone(page, "change-sensor");
  await openOtherProject(page, "Temperature sensor");
  await expect(card(page, "S1")).toBeVisible();
  await finishLesson(page, T, 1);

  // --- Lesson 3: from the metamodel's library ---
  await expect(page.getByTestId("button-tutorial-open-project")).toHaveText("Open your copy of Sensor node S1");
  await openOtherProject(page, "Humidity sensor");
  await page.getByRole("tab", { name: "Diagrams" }).click();
  const library = page.locator('[data-testid^="library-pattern-"]');
  await expect(library).toContainText("Solar supply");
  await expect(library).toContainText("Tutorial · Sensor node types");
  await library.hover();
  await page.locator('[data-testid^="button-insert-pattern-"]').click();
  await expect(card(page, "Battery 3000")).toBeVisible();
  await expectDone(page, "insert-pattern");
  await page.getByTestId("button-toolbar-auto-layout").click();
  await connect(page, "Battery 3000", "top", "Controller", "top");
  await confirmSuggestion(page, "powers");
  await expectDone(page, "connect-supply");
  await deleteElement(page, "Battery pack");
  // Deleted but not saved: not done yet.
  await expectNotDone(page, "remove-old");
  await saveDiagram(page);
  await finishLesson(page, T, 2);

  // --- Lesson 4: a second metamodel ---
  await page.getByTestId("button-metamodel-selector").click();
  await page.getByRole("option", { name: /Tutorial · Radio modules/ }).click();
  await page.keyboard.press("Escape");
  await expectDone(page, "add-metamodel");
  await addElementOfType(page, "LoRa module");
  // Validating before the radio is connected does not count.
  await page.getByTestId("button-toolbar-validate").click();
  await expectNotDone(page, "validate");
  await page.getByTestId("button-toolbar-auto-layout").click();
  // The relationship is defined in the second metamodel, from a type of the first.
  await connect(page, "S2", "right", "New LoRa module", "top");
  await confirmSuggestion(page, "sends via");
  await expectDone(page, "add-radio");
  await page.getByTestId("button-toolbar-validate").click();
  await finishLesson(page, T, 3);

  // --- Lesson 5: hand it on ---
  await saveDiagram(page);
  await page.getByTestId("button-tutorial-open-project").click();
  const copy = (await projects(page)).find((project) => project.name === "Copy of Tutorial · Sensor node S1")!;
  await page.getByTestId(`button-edit-project-${copy.id}`).click();
  await page.getByTestId("input-edit-project-name").fill("Sensor node S2");
  await page.getByTestId("button-save-project-changes").click();
  await expectDone(page, "rename-variant");
  await expect(page.getByTestId("button-tutorial-open-project")).toHaveText("Open your copy of Sensor node S1");
  await page.getByTestId("button-tutorial-open-project").click();
  await expect(card(page, "S2")).toBeVisible();
  // A file of the model alone does not count: it could not be imported elsewhere.
  await page.getByTestId("button-export-project").click();
  const exportDialog = page.getByRole("dialog");
  const modelOnly = page.waitForEvent("download");
  await exportDialog.getByRole("button", { name: "Download" }).click();
  await modelOnly;
  await expectNotDone(page, "export");
  // Without the metamodels the file could not be imported: tick them.
  await page.getByTestId("button-export-project").click();
  await exportDialog.getByText("Referenced metamodel definitions").click();
  const download = page.waitForEvent("download");
  await exportDialog.getByRole("button", { name: "Download" }).click();
  const file = testInfo.outputPath("sensor-node-s2.json");
  await (await download).saveAs(file);
  await expectDone(page, "export");
  await page.getByTestId("button-tutorial-open-project").click();
  await page.getByTestId("input-import-project").setInputFiles(file);
  // The imported model opens, outside the tutorial: no coach there.
  await expect(card(page, "S2")).toBeVisible();
  await expect(page.getByTestId("tutorial-coach")).toHaveCount(0);
  await page.goto("/projects");
  await expect(page.getByTestId("tutorial-coach")).toBeVisible();
  await expectDone(page, "import");
  // Remove the three imported projects, marked because their names are taken;
  // deleting a metamodel names the model that uses it.
  const all = await projects(page);
  const marked = all.filter((project) => project.name.endsWith(" (imported)"));
  expect(marked.map((project) => project.name).sort()).toEqual([
    "Sensor node S2 (imported)",
    "Tutorial · Radio modules (imported)",
    "Tutorial · Sensor node types (imported)",
  ]);
  const importedModel = marked.find((project) => project.projectType === "instance")!;
  const importedMetamodels = marked.filter((project) => project.projectType === "metamodel");
  await expect(page.getByRole("link", { name: "Open project Sensor node S2 (imported)" })).toBeVisible();
  await page.getByTestId(`button-delete-project-${importedMetamodels[0].id}`).click();
  await expect(page.getByTestId("delete-project-dependents")).toBeVisible();
  await page.getByRole("alertdialog").getByRole("button", { name: "Cancel" }).click();
  await deleteProject(page, importedModel);
  await expectNotDone(page, "remove-imported");
  for (const metamodel of importedMetamodels) await deleteProject(page, metamodel);
  // That was the lesson's last step: its question follows.
  await finishLesson(page, T, 4);

  // --- Lesson 6: on your own ---
  await page.getByRole("button", { name: "Duplicate Sensor node S2" }).click();
  await expect(card(page, "S2")).toBeVisible();
  await expectDone(page, "own-copy");
  await rename(page, "S2", "S3");
  await addElementOfType(page, "Bluetooth module");
  await page.getByTestId("button-toolbar-auto-layout").click();
  await connect(page, "S3", "right", "New Bluetooth module", "top");
  await confirmSuggestion(page, "sends via");
  // The LoRa module is still there.
  await expectNotDone(page, "own-radio");
  await deleteElement(page, "New LoRa module");
  await expectDone(page, "own-radio");
  await page.getByTestId("button-toolbar-validate").click();
  await expectFinished(page, T);

  // Removing the tutorial also removes the copies made from its model, and says so first.
  await saveDiagram(page);
  await page.getByTestId("button-tutorial-remove").click();
  const removed = page.getByTestId("tutorial-removed-projects").locator("li");
  await expect(removed).toHaveCount(5);
  expect((await removed.filter({ hasText: "(made by you)" }).allTextContents()).sort()).toEqual([
    "Copy of Sensor node S2 (made by you)",
    "Sensor node S2 (made by you)",
  ]);
  await page.getByTestId("button-confirm-tutorial-remove").click();
  await expect(page).toHaveURL(/\/projects$/);
  const left = await projects(page);
  expect(left.filter((project) => project.name.includes("Sensor node"))).toEqual([]);
});
