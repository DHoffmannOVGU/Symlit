import { createLocalAuth, type AuthProvider } from "./auth";
import type { AppConfig } from "./config";

/**
 * Chooses how requests are tied to a user. The local edition is single-user
 * with no login.
 *
 * A hosted deployment replaces only this file, returning its own
 * `AuthProvider` (see `server/auth.ts`), so updates from the public repository
 * merge without touching the hosted sign-in code.
 */
export function createAuthProvider(config: AppConfig): AuthProvider | Promise<AuthProvider> {
  return createLocalAuth(config.localUserName);
}
