import { z, type ZodTypeAny } from "zod";
import { buildUrl } from "@shared/routes";
import { apiRequest } from "@/lib/queryClient";

type RouteResponses = Record<number | string, ZodTypeAny>;

export type RouteDefinition = {
  method: string;
  path: string;
  input?: ZodTypeAny;
  responses: RouteResponses;
};

type SuccessStatus = 200 | 201 | 204;

type SuccessSchema<R extends RouteDefinition> = R["responses"] extends Record<
  infer K,
  ZodTypeAny
>
  ? Extract<K, SuccessStatus> extends never
    ? ZodTypeAny
    : R["responses"][Extract<K, SuccessStatus>]
  : ZodTypeAny;

type RouteResponse<R extends RouteDefinition> = z.infer<SuccessSchema<R>>;

type RouteInput<R extends RouteDefinition> = R extends { input: infer I }
  ? I extends ZodTypeAny
    ? z.infer<I>
    : never
  : never;

export interface ApiCallOptions<R extends RouteDefinition> {
  params?: Record<string, string | number>;
  body?: RouteInput<R>;
  /** When true, a 404 response resolves to `null` instead of throwing. */
  allowNotFound?: boolean;
}

const SUCCESS_ORDER: SuccessStatus[] = [200, 201, 204];

/**
 * Pick the response schema matching the actual HTTP status first, falling back
 * to the first declared success schema only when there's no exact match. This
 * keeps `apiCall` correct for routes that declare multiple success responses.
 */
const pickSuccessSchema = (responses: RouteResponses, actualStatus: number) => {
  const exact = responses[actualStatus];
  if (exact) return { status: actualStatus, schema: exact };
  for (const status of SUCCESS_ORDER) {
    const schema = responses[status];
    if (schema) return { status, schema };
  }
  return undefined;
};

export async function apiCall<R extends RouteDefinition>(
  route: R,
  options: ApiCallOptions<R> & { allowNotFound: true },
): Promise<RouteResponse<R> | null>;
export async function apiCall<R extends RouteDefinition>(
  route: R,
  options?: ApiCallOptions<R>,
): Promise<RouteResponse<R>>;
export async function apiCall<R extends RouteDefinition>(
  route: R,
  options: ApiCallOptions<R> = {},
): Promise<RouteResponse<R> | null> {
  const url = buildUrl(route.path, options.params);
  const hasBody = options.body !== undefined && options.body !== null;
  const validatedBody =
    route.input && hasBody ? route.input.parse(options.body) : options.body;

  const res = options.allowNotFound
    ? await apiRequest(route.method, url, validatedBody, {
        allowNotFound: true,
      })
    : await apiRequest(route.method, url, validatedBody);

  if (res === null) return null;

  const success = pickSuccessSchema(route.responses, res.status);
  if (!success || success.status === 204 || res.status === 204) {
    return undefined as RouteResponse<R>;
  }

  const text = await res.text();
  if (!text) return undefined as RouteResponse<R>;

  const parsed = JSON.parse(text);
  return success.schema.parse(parsed) as RouteResponse<R>;
}
