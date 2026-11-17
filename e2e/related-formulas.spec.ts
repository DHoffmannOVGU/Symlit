import { expect, test, type Page } from "@playwright/test";
import { createProjectWithViews } from "./support/create-project";

// Full-stack: a Related Formula calculates over the elements an element is
// related to, across all diagrams of the project, and follows unsaved changes.

const attribute = (name: string, value: string, type = "number") => ({ id: name, name, type, value, unit: "" });
const part = (id: string, attributes: ReturnType<typeof attribute>[], x = 0) => ({
  id,
  type: "part",
  position: { x, y: 200 },
  data: { label: id, type: "Object", attributes },
});
const consistsOf = (id: string, source: string, target: string) => ({
  id,
  source,
  target,
  edgeType: "composition",
  data: { label: "consists of", edgeType: "composition" },
});

const openElement = async (page: Page, label: string) => {
  await expect(async () => {
    await page.locator(".react-flow__node", { hasText: label }).first().dblclick();
    await expect(page.getByTestId("node-attribute-panel")).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 10_000 });
};

test("a Related Formula adds up the related elements of all diagrams, with a where, and follows changes", async ({ page, request }) => {
  const machine = part("Machine", [attribute("mass", "2")], 0);
  const created = await createProjectWithViews(request, {
    name: "Espresso machine with totals",
    projectType: "instance",
    views: [
      {
        name: "Structure",
        nodes: [
          machine,
          part("Boiler", [attribute("mass", "3"), attribute("status", "released", "string")], 250),
          part("Pump", [attribute("mass", "1.5"), attribute("status", "draft", "string")], 500),
        ],
        edges: [consistsOf("e1", "Machine", "Boiler"), consistsOf("e2", "Machine", "Pump")],
      },
      {
        // The machine is shown here too; a part related only in this diagram still counts.
        name: "Heating",
        nodes: [machine, part("Heater", [attribute("mass", "0.5"), attribute("status", "released", "string")], 250)],
        edges: [consistsOf("e3", "Machine", "Heater")],
      },
    ],
  });
  const { project, firstViewId } = await created.json();
  await page.goto(`/project/${project.id}/view/${firstViewId}`);
  await openElement(page, "Machine");

  const dialog = page.getByTestId("attribute-editor-dialog");
  const addRelated = async (name: string, formula: string) => {
    await page.getByTestId("button-add-attribute").click();
    await dialog.locator('[data-testid^="input-attr-name-"]').fill(name);
    await dialog.locator('[data-testid^="select-attr-type-"]').click();
    await page.getByRole("option", { name: "Related Formula", exact: true }).click();
    await dialog.locator('[data-testid^="input-attr-formula-"]').fill(formula);
  };

  // The relationships it can use are offered; the result says what it counted.
  await addRelated("total mass", '[mass] + sum([mass] of "consists of")');
  await expect(dialog.locator('[data-testid^="related-formula-relationships-"]')).toContainText('of "consists of" · 3');
  await expect(dialog.locator('[data-testid^="related-formula-result-"]')).toContainText("Calculated value: 7");
  await expect(dialog.locator('[data-testid^="related-formula-used-"]')).toContainText("3 related elements");
  await expect(dialog.locator('[data-testid^="related-formula-used-"]')).toContainText("Heater");
  await page.getByTestId("button-attribute-done").click();

  await addRelated("released parts", 'count(of "consists of" where [status] = "released")');
  await expect(dialog.locator('[data-testid^="related-formula-result-"]')).toContainText("Calculated value: 2");
  await expect(dialog.locator('[data-testid^="related-formula-used-"]')).toContainText("1 left out by the condition");
  // A mistake says what is wrong.
  await dialog.locator('[data-testid^="input-attr-formula-"]').fill('count(of consists)');
  await expect(dialog.locator('[data-testid^="related-formula-result-"]')).toContainText("Invalid formula");
  await dialog.locator('[data-testid^="input-attr-formula-"]').fill('count(of "consists of" where [status] = "released")');
  await page.getByTestId("button-attribute-done").click();

  // A Derived Formula sees only its own element, and says where aggregates belong.
  await page.getByTestId("button-add-attribute").click();
  await dialog.locator('[data-testid^="input-attr-name-"]').fill("wrong kind");
  await dialog.locator('[data-testid^="select-attr-type-"]').click();
  await page.getByRole("option", { name: "Derived Formula", exact: true }).click();
  await dialog.locator('[data-testid^="input-attr-formula-"]').fill('sum([mass] of "consists of")');
  await expect(dialog).toContainText("Related Formula");
  await page.getByTestId("button-attribute-cancel").click();

  const panel = page.getByTestId("node-attribute-panel");
  await expect(panel.getByTestId("attribute-summary-1")).toContainText("7");
  await expect(panel.getByTestId("attribute-summary-2")).toContainText("2");
  await page.getByTestId("button-save-attributes").click();
  await page.getByTestId("button-save-diagram-header").click();
  await expect(page.getByTestId("button-save-diagram-header")).toBeDisabled();

  // An input changed in the table: the total follows before anything is saved,
  // and recalculating it is not a change of its own.
  await page.getByTestId("button-toolbar-table").click();
  const row = (name: string) => page.locator(`[data-testid="table-element-row"][data-element-name="${name}"]`);
  await expect(row("Machine").getByTestId("table-attribute-total mass")).toContainText("7");
  await row("Pump").getByTestId("table-attribute-mass").locator("input").fill("2.5");
  await expect(row("Machine").getByTestId("table-attribute-total mass")).toContainText("8");
  await page.getByTestId("button-save-diagram-header").click();
  await expect(page.getByTestId("button-save-diagram-header")).toBeDisabled();

  // Stored values are recalculated on the way out: the export has them too.
  const exported = await (
    await request.post(`/api/projects/${project.id}/export`, { data: { format: "json" } })
  ).json();
  const machineData = exported.views
    .flatMap((view: { nodes: Array<{ data: { label: string; attributes: Array<{ name: string; value: string }> } }> }) => view.nodes)
    .find((node: { data: { label: string } }) => node.data.label === "Machine").data;
  expect(machineData.attributes.find((item: { name: string }) => item.name === "total mass").value).toBe("8");

  // After a reload, and in the other diagram, the values are the same.
  await page.reload();
  await page.getByTestId("button-toolbar-table").click();
  await expect(row("Machine").getByTestId("table-attribute-total mass")).toContainText("8");
  await expect(page.getByTestId("button-save-diagram-header")).toBeDisabled();
});

test("defined on a type, a Related Formula is checked there and calculated by each element", async ({ page, request }) => {
  const metamodel = await createProjectWithViews(request, {
    name: "Part types with totals",
    projectType: "metamodel",
    views: [
      {
        name: "Types",
        nodes: [
          {
            id: "part",
            type: "partdef",
            position: { x: 80, y: 80 },
            data: { label: "Part", type: "Object", attributes: [attribute("mass", "")] },
          },
        ],
        edges: [],
      },
    ],
  });
  const { project: meta, firstViewId: metaViewId } = await metamodel.json();
  const typeFlow = await (await request.get(`/api/views/${metaViewId}/flow`)).json();
  const typeId = `mm:${meta.id}:${typeFlow.nodes[0].id}`;
  const typed = (id: string, mass: string, x: number) => ({
    id,
    type: "part",
    position: { x, y: 200 },
    data: { label: id, type: "Part", typeId, attributes: [attribute("mass", mass)] },
  });
  const model = await createProjectWithViews(request, {
    name: "Assembly with totals",
    projectType: "instance",
    referencedMetamodels: [meta.id],
    views: [
      {
        name: "Structure",
        nodes: [typed("Frame", "4", 0), typed("Arm", "1", 250), typed("Wrist", "0.5", 500)],
        edges: [consistsOf("f-a", "Frame", "Arm"), consistsOf("a-w", "Arm", "Wrist")],
      },
    ],
  });
  const { project: inst, firstViewId: instViewId } = await model.json();

  // On the type, the formula is checked and explained, not calculated.
  await page.goto(`/project/${meta.id}/view/${metaViewId}`);
  await openElement(page, "Part");
  await page.getByTestId("button-add-attribute").click();
  const dialog = page.getByTestId("attribute-editor-dialog");
  await dialog.locator('[data-testid^="input-attr-name-"]').fill("total mass");
  await dialog.locator('[data-testid^="select-attr-type-"]').click();
  await page.getByRole("option", { name: "Related Formula", exact: true }).click();
  await dialog.locator('[data-testid^="input-attr-formula-"]').fill('[mass] + sum([total mass] of "consists of")');
  await expect(dialog.locator('[data-testid^="related-formula-result-"]')).toContainText(
    "Each element of this type calculates it",
  );
  await page.getByTestId("button-attribute-done").click();
  await page.getByTestId("button-save-attributes").click();
  await page.getByTestId("button-save-diagram-header").click();
  await expect(page.getByTestId("button-save-diagram-header")).toBeDisabled();

  // The elements take the attribute from their type and roll up over two levels.
  await page.goto(`/project/${inst.id}/view/${instViewId}`);
  for (const name of ["Frame", "Arm", "Wrist"]) {
    await openElement(page, name);
    await page.getByTestId("button-add-missing-attributes").click();
    await page.getByTestId("button-save-attributes").click();
    await expect(page.getByTestId("node-attribute-panel")).toBeHidden();
  }
  await page.getByTestId("button-toolbar-table").click();
  const total = (name: string) =>
    page.locator(`[data-testid="table-element-row"][data-element-name="${name}"]`).getByTestId("table-attribute-total mass");
  await expect(total("Wrist")).toContainText("0.5");
  await expect(total("Arm")).toContainText("1.5");
  await expect(total("Frame")).toContainText("5.5");
});
