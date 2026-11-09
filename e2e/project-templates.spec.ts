import { expect, test } from "@playwright/test";

// Creating a project from a project template in the dialog
// (docs/decisions/project-templates.md): the template comes from the server,
// fixes the project type, and the new project opens on its first diagram.

test("create a project from a template", async ({ page }) => {
  await page.goto("/projects");
  await page.getByTestId("button-new-project").click();
  const dialog = page.getByRole("dialog");
  await dialog.getByTestId("select-template-system-context").click();
  await expect(dialog.getByTestId("input-project-name")).toHaveValue("System Context");
  await expect(dialog.getByTestId("radio-metamodel")).toBeDisabled();
  await dialog.getByTestId("input-project-name").fill("Context from template");
  await dialog.getByTestId("button-create-project").click();

  await expect(page).toHaveURL(/\/project\/\d+\/view\/\d+$/);
  await expect(page.locator(".react-flow__node")).toHaveCount(3);
  await expect(page.locator(".react-flow__edge")).toHaveCount(2);
  await expect(page.getByText("Context from template").first()).toBeVisible();
});
