import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";
import type { User } from "@shared/schema";

type AuthSnapshot = {
  user: User;
  role: string;
  authKind: string;
  signOutUrl?: string;
  capabilities: Record<string, boolean>;
};

const AUTH_QUERY_KEY = [api.auth.me.path] as const;

async function fetchSession(): Promise<AuthSnapshot | null> {
  const response = await fetch(api.auth.me.path, { credentials: "include" });
  if (response.status === 401) {
    // A hosted build with sign-in names where to go; the local edition never answers 401.
    const body = (await response.json().catch(() => null)) as { signInUrl?: string } | null;
    if (body?.signInUrl) window.location.assign(body.signInUrl);
    return null;
  }
  if (!response.ok) throw new Error(`Could not load workspace user (${response.status})`);
  return api.auth.me.responses[200].parse(await response.json()) as AuthSnapshot;
}

/**
 * The local edition is single-user: the server resolves every request to the
 * implicit local owner, so there is no sign-in or sign-out flow. A hosted build
 * with its own auth provider can send signed-out browsers to `signInUrl` and
 * offer `signOutUrl`.
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
    signOutUrl: snapshot?.signOutUrl ?? null,
    capabilities: snapshot?.capabilities ?? {},
    isSignedIn: Boolean(snapshot),
    isLoading: query.isLoading,
    error: query.error,
    refreshSession: () => query.refetch().then((result) => result.data ?? null),
  };
}
