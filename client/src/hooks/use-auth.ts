import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";
import type { User } from "@shared/schema";

type AuthSnapshot = {
  user: User;
  role: string;
  authKind: "local";
  capabilities: Record<string, boolean>;
};

const AUTH_QUERY_KEY = [api.auth.me.path] as const;

async function fetchSession(): Promise<AuthSnapshot | null> {
  const response = await fetch(api.auth.me.path, { credentials: "include" });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error(`Could not load workspace user (${response.status})`);
  return api.auth.me.responses[200].parse(await response.json()) as AuthSnapshot;
}

/**
 * The local edition is single-user: the server resolves every request to the
 * implicit local owner, so there is no sign-in or sign-out flow.
 */
export function useAuth() {
  const query = useQuery({
    queryKey: AUTH_QUERY_KEY,
    queryFn: fetchSession,
    staleTime: Infinity,
    retry: 1,
  });
  const snapshot = query.data ?? null;

  return {
    user: snapshot?.user ?? null,
    userId: snapshot?.user.id,
    username: snapshot?.user.displayName || snapshot?.user.username,
    role: snapshot?.role ?? null,
    authKind: snapshot?.authKind ?? null,
    capabilities: snapshot?.capabilities ?? {},
    isSignedIn: Boolean(snapshot),
    isLoading: query.isLoading,
    error: query.error,
    refreshSession: () => query.refetch().then((result) => result.data ?? null),
  };
}
