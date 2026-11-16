import { expect, test } from "@playwright/test";
import { STRUCTURE_TUTORIAL as T } from "../shared/tutorial-structure";
import {
  addElementOfType,
  attributeIndex,
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
  openRelationship,
  saveDiagram,
  saveEditor,
  saveRelationship,
  showExistingElement,
  startTutorial,
  waitForStillCanvas,
} from "./support/tutorial";

// The tutorial on relationships, Generalization and several diagrams, walked as a learner would.

test("Structure and views: what a relationship says, Generalization, one element in two diagrams", async ({ page }) => {
  test.setTimeout(300_000);
  await startTutorial(page, T);
  await expectProgress(page, T, 0);

  // --- Lesson 1: read a structure ---
  await page.locator(".react-flow__edgelabel-renderer").getByText("consists of", { exact: true }).dblclick();
  await expect(page.getByTestId("edge-attribute-panel")).toContainText("Composition");
  await expectDone(page, "open-composition");
  await page.getByTestId("button-cancel-edge").click();
  await openOtherProject(page, "Vibration pump");
  await expectDone(page, "open-model");
  await openEditor(page, "Vibration pump");
  // The pump has Component's attributes as well as its own.
  await attributeIndex(page, "pressure");
  await attributeIndex(page, "part number");
  await cancelEditor(page);
  await finishLesson(page, T, 0, { wrongFirst: true });

  // --- Lesson 2: say what a relationship means ---
  await openOtherProject(page, "Brew group");
  await connect(page, "Boiler", "bottom", "Brew group", "bottom");
  await expectDone(page, "draw-feeds");
  // Named the other way round it is not the relationship asked for.
  await openRelationship(page);
  await page.getByTestId("input-edge-label").fill("feeds");
  await saveRelationship(page);
  await expectDone(page, "name-feeds");
  await page.getByTestId("button-create-sidebar-partdef").click();
  await openEditor(page, "New Object");
  await page.getByTestId("input-node-label").fill("Grinder");
  await saveEditor(page);
  await expectDone(page, "add-grinder-type");
  await connect(page, "Grinder", "top", "Component", "right");
  // A plain Association is not yet "a Grinder is a Component".
  await expectNotDone(page, "generalize");
  await openRelationship(page);
  await page.getByTestId("toggle-edge-type").getByText("Generalization").click();
  await saveRelationship(page);
  await expectDone(page, "generalize");
  await saveDiagram(page);
  await finishLesson(page, T, 1);

  // --- Lesson 3: build with what the metamodel allows ---
  await openOtherProject(page, "Vibration pump");
  await addElementOfType(page, "Grinder");
  await openEditor(page, "New Grinder");
  // Grinder defines nothing itself: both attributes come from Component.
  await attributeIndex(page, "part number");
  await attributeIndex(page, "mass");
  await cancelEditor(page);
  await expectDone(page, "add-grinder");
  await connect(page, "E1", "right", "New Grinder", "top");
  await confirmSuggestion(page);
  await expectDone(page, "compose-grinder");
  await saveDiagram(page);
  await finishLesson(page, T, 2);

  // --- Lesson 4: a second diagram ---
  await page.getByRole("tab", { name: "Diagrams" }).click();
  await page.getByTestId("button-create-view-sidebar").click();
  await page.getByRole("dialog").locator("input").first().fill("Water path");
  await page.getByRole("dialog").getByRole("button", { name: "Create diagram" }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(0);
  await expectDone(page, "create-diagram");
  for (const element of ["Water tank", "Vibration pump", "Boiler", "Brew group"]) {
    await showExistingElement(page, "Structure", element);
  }
  await expectDone(page, "place-elements");
  await page.getByTestId("button-toolbar-auto-layout").click();
  await waitForStillCanvas(page);
  await connect(page, "Water tank", "bottom", "Vibration pump", "bottom");
  await confirmSuggestion(page);
  await connect(page, "Vibration pump", "bottom", "Boiler", "bottom");
  await confirmSuggestion(page);
  // Not done while the last relationship is missing.
  await expectNotDone(page, "connect-path");
  await connect(page, "Boiler", "bottom", "Brew group", "bottom");
  // Two relationships are allowed here: Symlit offers a list.
  await expect(page.locator('select[aria-label="Choose metamodel relationship"] option')).toHaveText(["heats", "feeds"]);
  await confirmSuggestion(page, "feeds");
  await expectDone(page, "connect-path");
  // Showing elements stored their placement already; saving is not a conflict.
  await saveDiagram(page);
  await expect(page.getByText("This diagram was changed somewhere else")).toHaveCount(0);
  await finishLesson(page, T, 3);

  // --- Lesson 5: one element, two diagrams ---
  await waitForStillCanvas(page);
  await card(page, "Vibration pump").click({ position: { x: 12, y: 12 } });
  await page.keyboard.press("F2");
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type("Rotary pump");
  await page.keyboard.press("Enter");
  await expect(card(page, "Rotary pump")).toBeVisible();
  // Renamed, not yet saved.
  await expectNotDone(page, "rename-pump");
  await saveDiagram(page);
  await expectDone(page, "rename-pump");
  // The coach opens the other diagram of the same project.
  await expect(page.getByTestId("button-tutorial-open-project")).toHaveText("Open the diagram Structure");
  await page.getByTestId("button-tutorial-open-project").click();
  await expect(card(page, "E1")).toBeVisible();
  await expect(card(page, "Rotary pump")).toBeVisible();
  await expect(card(page, "Vibration pump")).toHaveCount(0);
  await expectDone(page, "see-in-structure");
  // Table view in Structure does not count: the step is about Water path.
  await page.getByTestId("button-toolbar-table").click();
  await expectNotDone(page, "read-answer");
  await page.getByTestId("button-toolbar-graph").click();
  await page.getByTestId("button-tutorial-open-project").click();
  await expect(card(page, "Water tank")).toBeVisible();
  await page.getByTestId("button-toolbar-table").click();
  await expect(page.getByRole("row", { name: /Rotary pump/ }).first()).toBeVisible();
  await finishLesson(page, T, 4);

  // --- Lesson 6: on your own ---
  await page.getByTestId("button-toolbar-graph").click();
  await openOtherProject(page, "Grinder");
  await page.getByTestId("button-create-sidebar-partdef").click();
  await openEditor(page, "New Object");
  await page.getByTestId("input-node-label").fill("Steam wand");
  await saveEditor(page);
  await page.getByTestId("button-toolbar-auto-layout").click();
  await connect(page, "Steam wand", "top", "Component", "bottom");
  await openRelationship(page);
  await page.getByTestId("toggle-edge-type").getByText("Generalization").click();
  await saveRelationship(page);
  await connect(page, "Boiler", "right", "Steam wand", "left");
  await openRelationship(page);
  await page.getByTestId("input-edge-label").fill("feeds");
  await saveRelationship(page);
  // Not saved yet.
  await expectNotDone(page, "own-type");
  await saveDiagram(page);
  await expectDone(page, "own-type");
  await page.getByTestId("button-tutorial-open-project").click();
  await expect(card(page, "E1")).toBeVisible();
  await addElementOfType(page, "Steam wand");
  await connect(page, "E1", "left", "New Steam wand", "top");
  await confirmSuggestion(page);
  await saveDiagram(page);
  await expectDone(page, "own-part");
  await page.getByTestId("button-tutorial-open-project").click();
  await expect(card(page, "Water tank")).toBeVisible();
  await showExistingElement(page, "Structure", "New Steam wand");
  await connect(page, "Boiler", "top", "New Steam wand", "top");
  await confirmSuggestion(page, "feeds");
  await expectDone(page, "own-path");
  await page.getByTestId("button-toolbar-validate").click();

  await expectFinished(page, T);
});
