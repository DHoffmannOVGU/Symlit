import { expect, test, type Locator, type Page, type Route } from "@playwright/test";
import { mockLocalSession } from "./support/local-session";

async function settledBoundingBox(locator: Locator) {
  let previous = await locator.boundingBox();
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await locator.page().waitForTimeout(100);
    const current = await locator.boundingBox();
    if (
      previous &&
      current &&
      Math.abs(previous.x - current.x) < 0.5 &&
      Math.abs(previous.y - current.y) < 0.5
    ) {
      return current;
    }
    previous = current;
  }
  return previous;
}

const metamodelProject = {
  id: 2,
  userId: 1,
  name: "Device Metamodel",
  description: "Types for connected devices",
  projectType: "metamodel",
  referencedMetamodels: [],
  metamodelSetup: {
    version: 1,
    purpose: "custom",
    description: "Devices and sensors",
    nodeTypes: ["partdef"],
    relationTypes: ["association"],
  },
};

const instanceProject = {
  id: 3,
  userId: 1,
  name: "Device Inventory",
  description: "Typed device instances",
  projectType: "instance",
  referencedMetamodels: [],
};

const metamodelView = {
  id: 20,
  projectId: 2,
  name: "Device types",
  description: "",
  viewType: "view",
  parentNodeId: null,
  parentViewId: null,
};

const instanceView = {
  id: 30,
  projectId: 3,
  name: "Inventory",
  description: "",
  viewType: "view",
  parentNodeId: null,
  parentViewId: null,
};

const metamodelFlow = {
  nodes: [
    {
      id: "device-type",
      projectId: 2,
      type: "partdef",
      position: { x: 100, y: 100 },
      data: { label: "Device", icon: "Cpu", color: "#2563eb" },
      createdAt: null,
    },
    {
      id: "sensor-type",
      projectId: 2,
      type: "partdef",
      position: { x: 350, y: 100 },
      data: { label: "Sensor", icon: "Radio", color: "#16a34a" },
      createdAt: null,
    },
  ],
  edges: [
    {
      id: "device-sensor",
      source: "device-type",
      target: "sensor-type",
      edgeType: "association",
      sourceHandle: null,
      targetHandle: null,
      data: { label: "contains" },
    },
  ],
};

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

async function installApi(page: Page) {
  let currentProject = { ...instanceProject };
  let failReferencedFlow = false;
  let savedFlow: { nodes: unknown[]; edges: unknown[] } = {
    nodes: [],
    edges: [],
  };
  const projectUpdates: unknown[] = [];
  const flowUpdates: Array<{ nodes: unknown[]; edges: unknown[] }> = [];

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());

    if (
      request.method() === "PATCH" &&
      pathname === "/api/projects/3"
    ) {
      const body = request.postDataJSON() as {
        referencedMetamodels?: number[];
      };
      projectUpdates.push(body);
      currentProject = {
        ...currentProject,
        referencedMetamodels: body.referencedMetamodels ?? [],
      };
      await fulfillJson(route, currentProject);
      return;
    }

    if (
      request.method() === "POST" &&
      pathname === "/api/views/30/sync"
    ) {
      savedFlow = request.postDataJSON() as {
        nodes: unknown[];
        edges: unknown[];
      };
      flowUpdates.push(savedFlow);
      await fulfillJson(route, { success: true });
      return;
    }

    if (request.method() !== "GET") {
      await fulfillJson(route, { success: true });
      return;
    }

    if (pathname === "/api/projects" && request.method() === "GET") {
      await fulfillJson(route, [metamodelProject, currentProject]);
    } else if (pathname === "/api/projects/2") {
      await fulfillJson(route, metamodelProject);
    } else if (pathname === "/api/projects/3") {
      await fulfillJson(route, currentProject);
    } else if (pathname === "/api/projects/2/views") {
      await fulfillJson(route, [metamodelView]);
    } else if (pathname === "/api/projects/3/views") {
      await fulfillJson(route, [instanceView]);
    } else if (pathname === "/api/views/20") {
      await fulfillJson(route, metamodelView);
    } else if (pathname === "/api/views/30") {
      await fulfillJson(route, instanceView);
    } else if (pathname === "/api/views/20/flow") {
      if (failReferencedFlow) {
        await fulfillJson(route, { message: "Referenced flow unavailable" }, 500);
      } else {
        await fulfillJson(route, metamodelFlow);
      }
    } else if (pathname === "/api/views/30/flow") {
      await fulfillJson(route, {
        nodes: savedFlow.nodes.map((node) => ({
          ...(node as Record<string, unknown>),
          projectId: 3,
          createdAt: null,
        })),
        edges: savedFlow.edges.map((edge) => ({
          ...(edge as Record<string, unknown>),
          sourceHandle:
            (edge as { sourceHandle?: string | null }).sourceHandle ?? null,
          targetHandle:
            (edge as { targetHandle?: string | null }).targetHandle ?? null,
        })),
      });
    } else if (
      pathname === "/api/projects/2/internal-views" ||
      pathname === "/api/projects/3/internal-views"
    ) {
      await fulfillJson(route, []);
    } else {
      await fulfillJson(route, []);
    }
  });

  return {
    projectUpdates,
    flowUpdates,
    getSavedFlow: () => savedFlow,
    setReferencedFlowFailure: (shouldFail: boolean) => {
      failReferencedFlow = shouldFail;
    },
  };
}

test("selects a metamodel, creates typed instances, relates them, saves, and reloads", async ({
  page,
}) => {
  const api = await installApi(page);
  await mockLocalSession(page, { displayName: "metamodel-instance-test" });

  await page.goto("/project/3/view/30");
  await expect(page.getByTestId("diagram-canvas-region")).toBeVisible();
  await page.getByTestId("button-metamodel-selector").click();
  await page
    .getByRole("option", { name: /Device Metamodel/ })
    .click();
  await page.keyboard.press("Escape");

  const sensorPaletteItem = page.getByTestId(
    "button-insert-referenced-class-mm:2:sensor-type",
  );
  const devicePaletteItem = page.getByTestId(
    "button-insert-referenced-class-mm:2:device-type",
  );
  await expect(sensorPaletteItem).toBeVisible();
  await expect(devicePaletteItem).toBeVisible();

  const canvas = page.getByTestId("diagram-canvas-region");
  await sensorPaletteItem.dragTo(canvas, {
    targetPosition: { x: 400, y: 280 },
  });
  await devicePaletteItem.dragTo(canvas, {
    targetPosition: { x: 760, y: 280 },
  });

  const sensorNode = page
    .locator(".react-flow__node")
    .filter({ has: page.getByText("Sensor", { exact: true }) });
  const deviceNode = page
    .locator(".react-flow__node")
    .filter({ has: page.getByText("Device", { exact: true }) });
  await expect(sensorNode).toHaveCount(1);
  await expect(deviceNode).toHaveCount(1);
  await expect(sensorNode).not.toHaveAttribute(
    "data-id",
    await deviceNode.getAttribute("data-id"),
  );

  const sourceHandle = deviceNode.locator(
    '.react-flow__handle.source[data-handlepos="left"]',
  );
  const targetHandle = sensorNode.locator(
    '.react-flow__handle.target[data-handlepos="right"]',
  );
  // The canvas may still be animating its viewport after the drops; measure
  // only once both handles have stopped moving.
  const sourceBox = await settledBoundingBox(sourceHandle);
  const targetBox = await settledBoundingBox(targetHandle);
  expect(sourceBox).not.toBeNull();
  expect(targetBox).not.toBeNull();
  if (!sourceBox || !targetBox) {
    throw new Error("Could not measure connection handles.");
  }
  await page.mouse.move(
    sourceBox.x + sourceBox.width / 2,
    sourceBox.y + sourceBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    targetBox.x + targetBox.width / 2,
    targetBox.y + targetBox.height / 2,
    { steps: 12 },
  );
  await page.mouse.up();

  await expect(page.locator(".react-flow__edge")).toHaveCount(1);
  const saveButton = page.getByTestId("button-save-diagram-header");
  await expect(saveButton).toBeEnabled();
  await saveButton.click();
  await expect.poll(() => api.flowUpdates.length).toBeGreaterThan(0);
  const latestFlow = api.getSavedFlow();
  expect(latestFlow.nodes).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        data: expect.objectContaining({ typeId: "mm:2:sensor-type" }),
      }),
      expect.objectContaining({
        data: expect.objectContaining({ typeId: "mm:2:device-type" }),
      }),
    ]),
  );
  expect(latestFlow.edges).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        source: expect.any(String),
        target: expect.any(String),
      }),
    ]),
  );

  await page.reload();
  await expect(page.getByText("Sensor", { exact: true }).last()).toBeVisible();
  await expect(
    page.locator(".react-flow__node").filter({ hasText: "Device" }),
  ).toHaveCount(1);
  expect(api.projectUpdates).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ referencedMetamodels: [2] }),
    ]),
  );
});

test("shows a visible loading error instead of silently falling back", async ({
  page,
}) => {
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    if (pathname === "/api/projects" && request.method() === "GET") {
      await fulfillJson(route, [{ ...instanceProject, referencedMetamodels: [999] }]);
    } else if (pathname === "/api/projects/3") {
      await fulfillJson(route, { ...instanceProject, referencedMetamodels: [999] });
    } else if (pathname === "/api/projects/3/views") {
      await fulfillJson(route, [instanceView]);
    } else if (pathname === "/api/views/30") {
      await fulfillJson(route, instanceView);
    } else if (pathname === "/api/views/30/flow") {
      await fulfillJson(route, { nodes: [], edges: [] });
    } else if (pathname === "/api/projects/999") {
      await fulfillJson(route, {}, 404);
    } else {
      await fulfillJson(route, []);
    }
  });
  await mockLocalSession(page, { displayName: "metamodel-error-test" });

  await page.goto("/project/3/view/30");
  await expect(page.getByTestId("diagram-canvas-region")).toBeVisible();
  await expect(
    page.getByText("This referenced metamodel is unavailable."),
  ).toBeVisible();
  await expect(page.getByTestId("button-insert-base-class-Object")).toHaveCount(0);
});

test("clears stale referenced classes after a failed replacement and recovers", async ({
  page,
}) => {
  const api = await installApi(page);
  await mockLocalSession(page, { displayName: "metamodel-replacement-test" });

  await page.goto("/project/3/view/30");
  await expect(page.getByTestId("diagram-canvas-region")).toBeVisible();
  await page.getByTestId("button-metamodel-selector").click();
  await page.getByText("Device Metamodel", { exact: true }).last().click();
  await page.keyboard.press("Escape");

  const devicePaletteItem = page.getByTestId(
    "button-insert-referenced-class-mm:2:device-type",
  );
  await expect(devicePaletteItem).toBeVisible();

  await page.getByTestId("button-metamodel-selector").click();
  await page
    .getByRole("option", { name: /Device Metamodel/ })
    .click();
  await page.keyboard.press("Escape");
  await expect
    .poll(() => api.projectUpdates.at(-1)?.referencedMetamodels)
    .toEqual([]);

  api.setReferencedFlowFailure(true);
  await page.getByTestId("button-metamodel-selector").click();
  await page
    .getByRole("option", { name: /Device Metamodel/ })
    .click();
  await page.keyboard.press("Escape");
  await expect
    .poll(() => api.projectUpdates.at(-1)?.referencedMetamodels)
    .toEqual([2]);

  await expect(
    page.getByText("Failed to load referenced classes."),
  ).toBeVisible();
  await expect(devicePaletteItem).toHaveCount(0);
  await expect(
    page.getByTestId("button-insert-referenced-class-mm:2:sensor-type"),
  ).toHaveCount(0);

  api.setReferencedFlowFailure(false);
  await page.getByTestId("button-retry-referenced-classes").click();
  await expect(devicePaletteItem).toBeVisible();
  await expect(
    page.getByTestId("button-insert-referenced-class-mm:2:sensor-type"),
  ).toBeVisible();
});
