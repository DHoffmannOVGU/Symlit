import { expect, test, type Page } from "@playwright/test";
import { createProjectWithViews } from "./support/create-project";

// Full-stack: a model rule is written as text or built with the lists, and
// the two always show the same rule. Rules look at the relationships of all
// diagrams of the project, as Related Formulas do.

const attribute = (name: string, value: string) => ({ id: name, name, type: "number", value, unit: "" });
const element = (id: string, type: string, attributes: ReturnType<typeof attribute>[], x = 0) => ({
  id,
  type: "part",
  position: { x, y: 200 },
  data: { label: id, type, attributes },
});
const has = (id: string, source: string, target: string) => ({
  id,
  source,
  target,
  edgeType: "association",
  data: { label: "has", edgeType: "association" },
});

const panel = (page: Page) => page.getByTestId("model-rules-panel");
const lastRule = (page: Page) => panel(page).getByTestId("model-rule").last();
const ruleText = (page: Page) => lastRule(page).getByTestId("rule-text");
const results = (page: Page) => panel(page).locator("aside");

test("a rule written as text shows in the lists, and a change in the lists shows in the text", async ({ page, request }) => {
  test.setTimeout(120_000);
  const second = element("D2", "Drone", [attribute("range", "20")], 250);
  const created = await createProjectWithViews(request, {
    name: "Drone fleet rules",
    projectType: "instance",
    views: [
      {
        name: "Fleet",
        nodes: [
          element("D1", "Drone", [attribute("range", "12")], 0),
          second,
          element("B1", "Battery", [attribute("capacity", "80")], 500),
        ],
        edges: [has("h1", "D1", "B1")],
      },
      {
        // D2's battery is only in this diagram; a rule sees it all the same.
        name: "Spares",
        nodes: [second, element("B2", "Battery", [attribute("capacity", "120")], 500)],
        edges: [has("h2", "D2", "B2")],
      },
    ],
  });
  const { project, firstViewId } = await created.json();
  await page.goto(`/project/${project.id}/view/${firstViewId}`);
  await page.getByTestId("button-model-rules").click();
  await page.getByTestId("button-add-rule").click();
  await lastRule(page).getByLabel("Rule name").fill("Short range");
  const lists = lastRule(page).getByRole("combobox");

  // Text to lists.
  await ruleText(page).fill("for Drone where [range] < 15");
  await expect(lists.nth(0)).toHaveText("Drone");
  await expect(lists.nth(2)).toHaveText("This object");
  await expect(lists.nth(3)).toHaveText("range");
  await expect(lists.nth(4)).toHaveText("is less than");
  await expect(lastRule(page).getByPlaceholder("value")).toHaveValue("15");
  await expect(results(page)).toContainText("D1 is classified as Descriptor");
  await expect(results(page)).not.toContainText("D2 is classified");

  // Lists to text.
  await lists.nth(4).click();
  await page.getByRole("option", { name: "is at most", exact: true }).click();
  await expect(ruleText(page)).toHaveValue("for Drone where [range] <= 15");
  await lastRule(page).getByPlaceholder("value").fill("20");
  await expect(ruleText(page)).toHaveValue("for Drone where [range] <= 20");
  await expect(results(page)).toContainText("D2 is classified as Descriptor");

  // What the lists cannot show is edited as text; relationships count from all diagrams.
  await ruleText(page).fill('for Drone where count(of "has") < 1');
  await expect(lastRule(page).getByTestId("rule-text-only")).toBeVisible();
  await expect(lastRule(page).getByPlaceholder("value")).toHaveCount(0);
  await expect(results(page)).toContainText("No element matches a rule.");

  // A phrase over related elements shows in the lists again, with its relationship.
  await ruleText(page).fill('for Drone where any of "has" has [capacity] < 100');
  await expect(lists.nth(2)).toHaveText("Outgoing “has” to");
  await expect(lists.nth(3)).toHaveText("at least one");
  await expect(lists.nth(4)).toHaveText("connected object");
  await expect(lists.nth(5)).toHaveText("capacity");
  await expect(lists.nth(6)).toHaveText("is less than");
  await expect(results(page)).toContainText("D1 is classified as Descriptor");
  await expect(results(page)).not.toContainText("D2 is classified");

  // A mistake is explained, and the rules cannot be saved until it is put right.
  await ruleText(page).fill("for Drone where [range] <");
  await expect(lastRule(page).getByTestId("rule-text-error")).toContainText("incomplete");
  await expect(page.getByTestId("button-save-rules")).toBeDisabled();
  await ruleText(page).fill("for Drone where any of \"has\" has [capacity] < 100");
  await expect(lastRule(page).getByTestId("rule-text-error")).toHaveCount(0);

  // The outcome stays in its lists.
  await lastRule(page).getByPlaceholder("e.g. Heavy").fill("Weak battery");
  await page.getByTestId("button-save-rules").click();
  await expect(page.getByText("Model rules saved").first()).toBeVisible();
  await panel(page).getByLabel("Close model rules").click();
  await expect(page.locator(".react-flow__node", { hasText: "D1" }).first()).toContainText("Weak battery");

  // Saved as text; after a reload it reads the same.
  await page.reload();
  await page.getByTestId("button-model-rules").click();
  await expect(ruleText(page)).toHaveValue('for Drone where any of "has" has [capacity] < 100');
  const views = await (await request.get(`/api/projects/${project.id}/views`)).json();
  const saved = views.find((view: { id: number }) => view.id === firstViewId).modelRules[0];
  expect(saved.expression).toBe('any of "has" has [attr:capacity] < 100');
  expect(saved.condition).toBeUndefined();
});

test("in a model, a rule names the metamodel's types and relationships by id and follows their renames", async ({ page, request }) => {
  test.setTimeout(120_000);
  const type = (id: string, x: number, attributes: ReturnType<typeof attribute>[] = []) => ({
    id,
    type: "partdef",
    position: { x, y: 80 },
    data: { label: id, type: "Object", attributes },
  });
  const metamodel = await createProjectWithViews(request, {
    name: "Fleet types for rules",
    projectType: "metamodel",
    views: [
      {
        name: "Types",
        nodes: [type("Drone", 0, [attribute("range", "")]), type("Battery", 400, [attribute("capacity", "")])],
        edges: [has("drone-battery", "Drone", "Battery")],
      },
    ],
  });
  const { project: meta, firstViewId: metaViewId } = await metamodel.json();
  const typesFlow = await (await request.get(`/api/views/${metaViewId}/flow`)).json();
  const relationId = typesFlow.edges[0].id;
  const typeIdOf = (label: string) =>
    `mm:${meta.id}:${typesFlow.nodes.find((node: { data: { label: string } }) => node.data.label === label).id}`;
  const typed = (id: string, label: string, x: number, attributes: ReturnType<typeof attribute>[]) => ({
    id,
    type: "part",
    position: { x, y: 200 },
    data: { label: id, type: label, typeId: typeIdOf(label), attributes },
  });
  const model = await createProjectWithViews(request, {
    name: "Fleet with rules",
    projectType: "instance",
    referencedMetamodels: [meta.id],
    views: [
      {
        name: "Fleet",
        nodes: [
          typed("D1", "Drone", 0, [attribute("range", "12")]),
          typed("D2", "Drone", 250, [attribute("range", "20")]),
          typed("B1", "Battery", 500, [attribute("capacity", "80")]),
        ],
        edges: [{ ...has("h1", "D1", "B1"), data: { label: "has", edgeType: "association", relationId } }],
      },
    ],
  });
  const { project: inst, firstViewId: instViewId } = await model.json();

  await page.goto(`/project/${inst.id}/view/${instViewId}`);
  await page.getByTestId("button-model-rules").click();
  await page.getByTestId("button-add-rule").click();
  await lastRule(page).getByLabel("Rule name").fill("Every drone carries a battery");
  await ruleText(page).fill('for Drone where none of "has" where type = "Battery"');
  const lists = lastRule(page).getByRole("combobox");
  await expect(lists.nth(2)).toHaveText("Outgoing “has” to");
  await expect(lists.nth(3)).toHaveText("none");
  await expect(lists.nth(4)).toHaveText("Battery");
  await expect(lists.nth(5)).toHaveText("exists");
  await expect(results(page)).toContainText("D2 is classified as Descriptor");
  await expect(results(page)).not.toContainText("D1 is classified");
  await page.getByTestId("button-save-rules").click();
  await expect(page.getByText("Model rules saved").first()).toBeVisible();

  // Stored by ids: the type the rule looks at, the relationship and the type it names.
  const views = await (await request.get(`/api/projects/${inst.id}/views`)).json();
  const saved = views.find((view: { id: number }) => view.id === instViewId).modelRules[0];
  expect(saved.targetType).toBe(typeIdOf("Drone"));
  expect(saved.expression).toBe(`none of "rel:${relationId}" where type = "type:${typeIdOf("Battery")}"`);

  // The relationship and the type are renamed in the metamodel.
  const renamed = {
    nodes: typesFlow.nodes.map((node: { data: { label: string } }) =>
      node.data.label === "Battery" ? { ...node, data: { ...node.data, label: "Power pack" } } : node,
    ),
    edges: typesFlow.edges.map((edge: { data: Record<string, unknown> }) => ({ ...edge, data: { ...edge.data, label: "carries" } })),
  };
  expect((await request.post(`/api/views/${metaViewId}/sync`, { data: renamed })).ok()).toBe(true);

  // The model's rule reads with the new names and finds the same drone.
  await page.reload();
  await page.getByTestId("button-model-rules").click();
  await expect(ruleText(page)).toHaveValue('for Drone where none of "carries" where type = "Power pack"');
  await expect(results(page)).toContainText("D2 is classified as Descriptor");
  await expect(results(page)).not.toContainText("D1 is classified");
});
