import { expect, test, type Page, type Route } from "@playwright/test";
import { mockLocalSession } from "./support/local-session";

const project = {
  id: 10,
  userId: 1,
  name: "AI Modeling Fixture",
  description: "AI assistant fixture",
  projectType: "metamodel",
  referencedMetamodels: [],
  metamodelSetup: {
    version: 1,
    purpose: "custom",
    description: "Only objects and associations are enabled",
    nodeTypes: ["partdef"],
    relationTypes: ["association"],
  },
};

const view = {
  id: 10,
  projectId: 10,
  name: "AI canvas",
  description: "",
  viewType: "view",
  parentNodeId: null,
  parentViewId: null,
};

const proposal = {
  summary: "Add a Sensor and Room",
  nodes: [
    {
      id: "sensor",
      kind: "object",
      name: "Sensor",
      description: "Measures the room",
      attributes: [],
    },
    {
      id: "room",
      kind: "object",
      name: "Room",
      description: "A monitored space",
      attributes: [],
    },
  ],
  edges: [
    {
      source: "sensor",
      target: "room",
      relation: "association",
      label: "located in",
      description: "",
    },
  ],
  warnings: [],
};

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

async function installAiApi(page: Page) {
  const requests: Array<Record<string, unknown>> = [];
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    if (
      request.method() === "POST" &&
      pathname === "/api/projects/10/views/10/ai/metamodel"
    ) {
      requests.push(request.postDataJSON() as Record<string, unknown>);
      await fulfillJson(route, proposal);
      return;
    }
    if (request.method() === "POST") {
      await fulfillJson(route, { success: true });
      return;
    }
    if (pathname === "/api/projects" && request.method() === "GET") {
      await fulfillJson(route, [project]);
    } else if (pathname === "/api/projects/10") {
      await fulfillJson(route, project);
    } else if (pathname === "/api/projects/10/views") {
      await fulfillJson(route, [view]);
    } else if (pathname === "/api/views/10") {
      await fulfillJson(route, view);
    } else if (pathname === "/api/views/10/flow") {
      await fulfillJson(route, { nodes: [], edges: [] });
    } else {
      await fulfillJson(route, []);
    }
  });
  return requests;
}

test("reviews a proposal item by item and preserves context for refinement", async ({
  page,
}) => {
  const requests = await installAiApi(page);
  await mockLocalSession(page, { displayName: "ai-assistant-test" });

  await page.goto("/project/10/view/10");
  await expect(page.getByTestId("diagram-canvas-region")).toBeVisible();
  await page.getByTestId("button-ai-model-assistant").click();

  const assistant = page.getByTestId("metamodel-ai-assistant");
  await expect(assistant).toContainText("Vocabulary: 1 element types");
  await assistant
    .getByPlaceholder("Describe additions or refine the last proposal…")
    .fill("Add a sensor and a room");
  await assistant.getByRole("button", { name: "Send prompt" }).click();

  await expect(assistant).toContainText("Add a Sensor and Room");
  await expect(assistant).toContainText("New elements");
  await expect(assistant).toContainText("Relationships");
  const checkboxes = assistant.getByRole("checkbox");
  await expect(checkboxes).toHaveCount(3);
  await checkboxes.nth(1).uncheck();
  await checkboxes.nth(2).uncheck();
  await expect(
    assistant.getByRole("button", { name: "Apply 1 selected" }),
  ).toBeVisible();
  await assistant.getByRole("button", { name: "Apply 1 selected" }).click();
  await expect(assistant).toContainText("Applied");

  await assistant
    .getByPlaceholder("Describe additions or refine the last proposal…")
    .fill("Refine the sensor model");
  await assistant.getByRole("button", { name: "Send prompt" }).click();
  await expect.poll(() => requests.length).toBe(2);
  const secondRequest = requests[1];
  const messages = secondRequest.messages as Array<{ content: string }>;
  const currentModel = secondRequest.currentModel as {
    nodes: Array<{ name: string }>;
  };
  expect(messages.some((message) => message.content.includes("Sensor"))).toBe(
    true,
  );
  expect(currentModel.nodes.some((node) => node.name === "Sensor")).toBe(true);
});