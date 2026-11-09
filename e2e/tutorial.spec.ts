import { expect, test, type Page } from "@playwright/test";
import { TUTORIAL_STEPS } from "../shared/tutorial";

// Full-stack: the real server creates the tutorial projects.
// The tutorial is per workspace (one database), so this test must not run
// concurrently with itself; avoid `--repeat-each` for this file.

const stepState = (page: Page, id: string) =>
  page.getByTestId(`tutorial-step-${id}`).getAttribute("data-state");

test("the guided tutorial starts from the project list and follows the learner", async ({ page, request }) => {
  await page.goto("/projects");
  await page.getByTestId("button-tutorial-start").click();

  // Lands in the metamodel; opening it completes the first step.
  await expect(page.getByTestId("tutorial-coach")).toBeVisible();
  await expect(page.locator(".react-flow__node")).toHaveCount(3);
  // The diagram is fitted clear of the coach, and not zoomed in beyond 100%.
  await expect
    .poll(() =>
      page.evaluate(() => {
        const coach = document.querySelector('[data-testid="tutorial-coach"]')!.getBoundingClientRect();
        return [...document.querySelectorAll(".react-flow__node")].filter((node) => {
          const box = node.getBoundingClientRect();
          return box.right > coach.left && box.bottom > coach.top && box.top < coach.bottom;
        }).length;
      }),
    )
    .toBe(0);
  const zoom = await page.locator(".react-flow__viewport").evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a);
  expect(zoom).toBeLessThanOrEqual(1);
  await expect.poll(() => stepState(page, "open-metamodel")).toBe("done");
  await expect(page.getByTestId("tutorial-progress-count")).toContainText(`1 of ${TUTORIAL_STEPS.length}`);
  // A freshly opened tutorial diagram has no unsaved changes, so "Show me" can navigate freely.
  await expect(page.getByTestId("button-save-diagram-header")).toBeDisabled();

  // "Show me" opens the instance model, which completes the next step.
  await page.getByTestId("button-tutorial-show-me").click();
  await expect(page).toHaveURL(/\/project\/\d+\/view\/\d+/);
  await expect(page.getByText("Courier X1")).toBeVisible();
  await expect(page.getByTestId("tutorial-progress-count")).toContainText(`2 of ${TUTORIAL_STEPS.length}`);
  await expect(page.getByTestId("tutorial-lesson-title")).toHaveText("Define a type");

  // Doing a later step out of order still counts.
  await page.getByTestId("button-toolbar-table").click();
  await expect(page.getByTestId("tutorial-progress-count")).toContainText(`3 of ${TUTORIAL_STEPS.length}`);

  // Skipping moves on to the next step.
  await page.getByTestId("button-tutorial-skip").click();
  await expect(page.getByTestId("tutorial-step-add-attribute")).toHaveAttribute("data-state", "current");

  // Progress survives a reload, and the coach can be minimised.
  await page.getByTestId("button-tutorial-collapse").click();
  await page.reload();
  await expect(page.getByTestId("button-tutorial-expand")).toContainText(`4/${TUTORIAL_STEPS.length}`);
  await page.getByTestId("button-tutorial-expand").click();

  // Skip the rest to reach the end, then clean up.
  // Some steps navigate when skipped, so the skip button can briefly
  // disappear; keep skipping until the finished card shows.
  const skip = page.getByTestId("button-tutorial-skip");
  const finished = page.getByTestId("tutorial-finished");
  await expect(async () => {
    if (!(await finished.isVisible())) await skip.click({ timeout: 2_000 });
    await expect(finished).toBeVisible({ timeout: 500 });
  }).toPass({ timeout: 30_000 });
  await page.getByTestId("tutorial-finished").getByTestId("button-tutorial-remove").click();
  await expect(page).toHaveURL(/\/projects$/);
  await expect(page.getByTestId("button-tutorial-start")).toBeVisible();

  const projects = (await (await request.get("/api/projects")).json()) as Array<{ templateId: string | null }>;
  expect(projects.filter((project) => project.templateId?.startsWith("tutorial"))).toEqual([]);
});
