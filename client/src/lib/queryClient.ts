import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function parseErrorMessage(res: Response): Promise<string> {
  let raw = "";
  try {
    raw = await res.text();
  } catch {
    return `${res.status} ${res.statusText}`;
  }
  if (!raw) return `${res.status} ${res.statusText}`;
  try {
    const json = JSON.parse(raw);
    if (json && typeof json === "object" && "message" in json) {
      return String((json as { message: unknown }).message);
    }
  } catch {
    // not JSON
  }
  return raw;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res));
  }
}

async function rawApiFetch(
  method: string,
  url: string,
  data?: unknown,
): Promise<Response> {
  const hasBody = data !== undefined && data !== null;
  return fetch(url, {
    method,
    headers: hasBody ? { "Content-Type": "application/json" } : {},
    body: hasBody ? JSON.stringify(data) : undefined,
    credentials: "include",
  });
}

export interface ApiRequestOptions {
  allowNotFound?: boolean;
}

export async function apiRequest(
  method: string,
  url: string,
  data: unknown | undefined,
  options: { allowNotFound: true },
): Promise<Response | null>;
export async function apiRequest(
  method: string,
  url: string,
  data?: unknown,
): Promise<Response>;
export async function apiRequest(
  method: string,
  url: string,
  data?: unknown,
  options: ApiRequestOptions = {},
): Promise<Response | null> {
  const res = await rawApiFetch(method, url, data);
  if (options.allowNotFound && res.status === 404) {
    return null;
  }
  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
