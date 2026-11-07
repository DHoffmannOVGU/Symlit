import assert from "node:assert/strict";
import test from "node:test";
import { GeminiMetamodelError, proposeMetamodel } from "./gemini-metamodel";

const input = {
  prompt: "Add a sensor",
  messages: [],
  currentModel: { nodes: [], edges: [] },
};

test("fails safely when the server secret is not configured", async () => {
  const previous = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  await assert.rejects(() => proposeMetamodel(input), (error: unknown) => error instanceof GeminiMetamodelError && error.status === 503);
  if (previous) process.env.GEMINI_API_KEY = previous;
});

test("sends the key only in the server request and validates structured output", async () => {
  const previousKey = process.env.GEMINI_API_KEY;
  const previousFetch = globalThis.fetch;
  process.env.GEMINI_API_KEY = "test-server-key";
  let requestHeaders: HeadersInit | undefined;
  globalThis.fetch = async (_url, init) => {
    requestHeaders = init?.headers;
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({
      summary: "A sensor proposal", nodes: [{ id: "sensor", kind: "object", name: "Sensor", description: "", attributes: [] }], edges: [],
    }) }] } }] }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    const proposal = await proposeMetamodel(input);
    assert.equal(proposal.nodes[0]?.name, "Sensor");
    assert.equal(new Headers(requestHeaders).get("x-goog-api-key"), "test-server-key");
    assert.equal(JSON.stringify(proposal).includes("test-server-key"), false);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey) process.env.GEMINI_API_KEY = previousKey;
    else delete process.env.GEMINI_API_KEY;
  }
});

test("falls back to another compatible Flash model when a model is unavailable", async () => {
  const previousKey = process.env.GEMINI_API_KEY;
  const previousModel = process.env.GEMINI_MODEL;
  const previousFetch = globalThis.fetch;
  process.env.GEMINI_API_KEY = "test-server-key";
  delete process.env.GEMINI_MODEL;
  const urls: string[] = [];
  globalThis.fetch = async (url) => {
    urls.push(String(url));
    if (urls.length === 1) return new Response("not found", { status: 404 });
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({
      summary: "Fallback worked", nodes: [], edges: [],
    }) }] } }] }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    const proposal = await proposeMetamodel(input);
    assert.equal(proposal.summary, "Fallback worked");
    assert.equal(urls.length, 2);
    assert.notEqual(urls[0], urls[1]);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey) process.env.GEMINI_API_KEY = previousKey;
    else delete process.env.GEMINI_API_KEY;
    if (previousModel) process.env.GEMINI_MODEL = previousModel;
    else delete process.env.GEMINI_MODEL;
  }
});

test("includes the configured vocabulary and rejects unsupported generated types", async () => {
  const previousKey = process.env.GEMINI_API_KEY;
  const previousFetch = globalThis.fetch;
  process.env.GEMINI_API_KEY = "test-server-key";
  let requestBody: { contents?: Array<{ parts?: Array<{ text?: string }> }> } | undefined;
  globalThis.fetch = async (_url, init) => {
    requestBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({
      summary: "Unsupported proposal",
      nodes: [{ id: "behavior", kind: "behavior", name: "Behavior", description: "", attributes: [] }],
      edges: [],
    }) }] } }] }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    await assert.rejects(
      () => proposeMetamodel({
        ...input,
        allowedNodeKinds: ["object"],
        allowedRelationTypes: ["association"],
      }),
      (error: unknown) =>
        error instanceof GeminiMetamodelError &&
        error.status === 422 &&
        error.message.includes("not enabled"),
    );
    const prompt = requestBody?.contents?.[0]?.parts?.[0]?.text ?? "";
    assert.match(prompt, /Allowed node kinds: object/);
    assert.match(prompt, /Allowed relationship types: association/);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey) process.env.GEMINI_API_KEY = previousKey;
    else delete process.env.GEMINI_API_KEY;
  }
});

test("reports the provider path for malformed structured output", async () => {
  const previousKey = process.env.GEMINI_API_KEY;
  const previousFetch = globalThis.fetch;
  process.env.GEMINI_API_KEY = "test-server-key";
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({
      nodes: [],
      edges: [],
    }) }] } }] }), { status: 200, headers: { "Content-Type": "application/json" } });
  try {
    await assert.rejects(
      () => proposeMetamodel(input),
      (error: unknown) =>
        error instanceof GeminiMetamodelError &&
        error.message.includes("summary"),
    );
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey) process.env.GEMINI_API_KEY = previousKey;
    else delete process.env.GEMINI_API_KEY;
  }
});
