import { z } from "zod";
import {
  aiMetamodelNodeKindEnum,
  aiMetamodelProposalSchema,
  type AiMetamodelRequest,
  type AiMetamodelProposal,
} from "@shared/ai-metamodel";
import { magicRelationTypeEnum } from "@shared/metamodel-setup";

/** The part of Gemini's generateContent response the assistant reads. */
const geminiResponseSchema = z.object({
  candidates: z
    .array(z.object({ content: z.object({ parts: z.array(z.object({ text: z.string().optional() })).optional() }).optional() }))
    .optional(),
});

export class GeminiMetamodelError extends Error {
  constructor(message: string, public readonly status = 502) {
    super(message);
  }
}

const responseSchema = {
  type: "OBJECT",
  properties: {
    summary: { type: "STRING", description: "A concise explanation of the proposed additions." },
    nodes: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          id: { type: "STRING", description: "Unique temporary id using letters, numbers, underscore or dash." },
          kind: { type: "STRING", enum: ["object", "behavior", "concern", "performer", "requirement", "event", "capability"] },
          name: { type: "STRING" },
          description: { type: "STRING" },
          attributes: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                name: { type: "STRING" }, description: { type: "STRING" },
                type: { type: "STRING", enum: ["string", "number", "boolean", "date", "list"] },
                unit: { type: "STRING" }, options: { type: "ARRAY", items: { type: "STRING" } },
              },
              required: ["name", "description", "type", "unit", "options"],
            },
          },
        },
        required: ["id", "kind", "name", "description", "attributes"],
      },
    },
    edges: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          source: { type: "STRING" }, target: { type: "STRING" },
          relation: { type: "STRING", enum: [...magicRelationTypeEnum] },
          label: { type: "STRING" }, description: { type: "STRING" },
        },
        required: ["source", "target", "relation", "label", "description"],
      },
    },
    warnings: {
      type: "ARRAY",
      items: { type: "STRING" },
    },
  },
  required: ["summary", "nodes", "edges"],
};

export const DEFAULT_GEMINI_MODELS = [
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
];

/**
 * Models are tried in order until one is available for the key.
 * GEMINI_MODEL may hold one model or a comma-separated fallback list.
 */
export function geminiModels(value = process.env.GEMINI_MODEL): string[] {
  const configured = (value ?? "")
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean);
  return configured.length ? configured : DEFAULT_GEMINI_MODELS;
}

export async function proposeMetamodel(input: AiMetamodelRequest): Promise<AiMetamodelProposal> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new GeminiMetamodelError("AI modeling is not configured. Set GEMINI_API_KEY on the server.", 503);
  const allowedNodeKinds = input.allowedNodeKinds?.length
    ? input.allowedNodeKinds
    : [...aiMetamodelNodeKindEnum];
  const allowedRelationTypes = input.allowedRelationTypes?.length
    ? input.allowedRelationTypes
    : [...magicRelationTypeEnum];
  const models = geminiModels();
  const history = input.messages.map((message) => `${message.role.toUpperCase()}: ${message.content}`).join("\n");
  const prompt = [
    "You are a systems metamodeling assistant. Return a proposal containing additions only; never delete or silently modify existing elements.",
    "Use existing node ids in edge endpoints when connecting to the current model. Use proposed temporary ids for new nodes.",
    "For generalization edges, source is the specialized child and target is the general parent. Prefer a small, coherent model over unnecessary detail.",
    "Choose relation semantics deliberately: association is a general link; aggregation and composition are hollow and filled whole-part links; generalization and realization use hollow target triangles; dependency is a dashed usage link.",
    `Allowed node kinds: ${allowedNodeKinds.join(", ")}`,
    `Allowed relationship types: ${allowedRelationTypes.join(", ")}`,
    "Do not emit a node kind or relationship type outside the allowed vocabulary. If the request needs an unsupported concept, explain the limitation in warnings and propose the closest allowed alternative.",
    `Current metamodel JSON:\n${JSON.stringify(input.currentModel)}`,
    history ? `Recent conversation:\n${history}` : "",
    `User request:\n${input.prompt}`,
  ].filter(Boolean).join("\n\n");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  let response: Response | undefined;
  try {
    for (const model of models) {
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: "Create precise, user-friendly systems metamodel proposals as valid structured JSON." }] },
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 8192, responseMimeType: "application/json", responseSchema },
        }),
        signal: controller.signal,
      });
      // 404 means this model is not available for the key: try the next one.
      if (response.status !== 404) break;
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new GeminiMetamodelError("Gemini timed out while creating the proposal.", 504);
    throw new GeminiMetamodelError("Could not reach Gemini.");
  } finally {
    clearTimeout(timeout);
  }
  if (!response?.ok) {
    if (!response) throw new GeminiMetamodelError("Gemini returned no response.");
    if (response.status === 429) throw new GeminiMetamodelError("Gemini quota is currently exhausted. Try again shortly.", 429);
    if (response.status === 401 || response.status === 403) throw new GeminiMetamodelError("Gemini rejected the configured API key.", 503);
    if (response.status === 404) throw new GeminiMetamodelError(`None of the Gemini models (${models.join(", ")}) is available for this API key. Set GEMINI_MODEL to a model your key can use.`);
    throw new GeminiMetamodelError(`Gemini could not create a proposal (${response.status}).`);
  }
  let body: unknown;
  try { body = await response.json(); } catch { throw new GeminiMetamodelError("Gemini returned an unreadable response."); }
  const envelope = geminiResponseSchema.safeParse(body);
  const text = envelope.success
    ? envelope.data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("")
    : undefined;
  if (!text) throw new GeminiMetamodelError("Gemini returned no proposal.");
  let json: unknown;
  try { json = JSON.parse(text); } catch { throw new GeminiMetamodelError("Gemini returned malformed JSON."); }
  const parsed = aiMetamodelProposalSchema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path.length ? issue.path.join(".") : "proposal";
    throw new GeminiMetamodelError(
      `Gemini returned an invalid proposal at ${path}: ${issue?.message ?? "check the structured output."}`,
    );
  }
  const allowedNodeKindSet = new Set(allowedNodeKinds);
  const unsupportedNode = parsed.data.nodes.find(
    (node) => !allowedNodeKindSet.has(node.kind),
  );
  if (unsupportedNode) {
    throw new GeminiMetamodelError(
      `Gemini suggested "${unsupportedNode.kind}", which is not enabled for this metamodel.`,
      422,
    );
  }
  const allowedRelationTypeSet = new Set(allowedRelationTypes);
  const unsupportedRelation = parsed.data.edges.find(
    (edge) => !allowedRelationTypeSet.has(edge.relation),
  );
  if (unsupportedRelation) {
    throw new GeminiMetamodelError(
      `Gemini suggested "${unsupportedRelation.relation}", which is not enabled for this metamodel.`,
      422,
    );
  }
  const knownIds = new Set([...input.currentModel.nodes.map((node) => node.id), ...parsed.data.nodes.map((node) => node.id)]);
  const invalidEndpoint = parsed.data.edges.find(
    (edge) => !knownIds.has(edge.source) || !knownIds.has(edge.target),
  );
  if (invalidEndpoint) {
    throw new GeminiMetamodelError(
      `Gemini referenced an unknown element in the proposed relationship "${invalidEndpoint.source}" → "${invalidEndpoint.target}".`,
    );
  }
  return parsed.data;
}
