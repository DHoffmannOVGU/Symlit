import net from "node:net";
import type { Express, NextFunction, Request, RequestHandler, Response } from "express";

/** Database ids are positive 32-bit integers; anything else cannot exist. */
export function isDatabaseId(value: string): boolean {
  return /^[1-9]\d{0,9}$/.test(value) && Number(value) <= 2147483647;
}

type Handler = (req: Request, res: Response, next: NextFunction) => unknown;

/**
 * Express 4 does not catch errors thrown by async handlers: the rejection is
 * unhandled and ends the process. Every route registered after this call
 * passes a rejection on to the error handler instead.
 */
export function catchAsyncRouteErrors(app: Express) {
  for (const method of ["get", "post", "put", "patch", "delete"] as const) {
    const register = app[method].bind(app) as (...args: unknown[]) => unknown;
    (app as unknown as Record<string, unknown>)[method] = (path: unknown, ...handlers: unknown[]) =>
      register(
        path,
        ...handlers.map((handler) =>
          typeof handler === "function" && handler.length < 4
            ? (req: Request, res: Response, next: NextFunction) => {
                Promise.resolve()
                  .then(() => (handler as Handler)(req, res, next))
                  .catch(next);
              }
            : handler,
        ),
      );
  }
}

/** Numeric route parameters that are not database ids answer 404 before any query runs. */
export function rejectInvalidIds(app: Express) {
  app.param(["id", "projectId", "viewId", "patternId"], (_req, res, next, value) => {
    if (isDatabaseId(String(value))) return next();
    res.status(404).json({ message: "Not Found" });
  });
}

function hostName(header: string | undefined): string | null {
  if (!header) return null;
  try {
    // URL parsing handles ports and bracketed IPv6 literals.
    return new URL(`http://${header}`).hostname.replace(/^\[|\]$/g, "").toLowerCase();
  } catch {
    return null;
  }
}

/**
 * The local edition has no login, so the browser's same-origin policy is the
 * only thing between other websites and the workspace. Two checks keep it
 * that way:
 *
 * - Host: a page on another domain can point its name at 127.0.0.1 (DNS
 *   rebinding) and then read the API as "same origin". Such requests carry
 *   that domain in `Host`. Only `localhost`, IP addresses and the names in
 *   SYMLIT_ALLOWED_HOSTS are served.
 * - Origin: requests that change data must come from the app's own pages.
 */
export function guardLocalApi(allowedHosts: string[]): RequestHandler {
  const allowed = new Set(["localhost", ...allowedHosts.map((host) => host.toLowerCase())]);
  const isAllowedHost = (name: string) =>
    allowed.has(name) || name.endsWith(".localhost") || net.isIP(name) !== 0;

  return (req, res, next) => {
    const host = hostName(req.headers.host);
    if (!host || !isAllowedHost(host)) {
      return res.status(403).json({
        message: `Requests for host "${host ?? ""}" are not served. Add it to SYMLIT_ALLOWED_HOSTS to allow it.`,
      });
    }
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      const origin = req.headers.origin;
      if (origin !== undefined) {
        let originHost: string | null = null;
        try {
          originHost = new URL(origin).host.toLowerCase();
        } catch {
          originHost = null;
        }
        if (originHost !== req.headers.host?.toLowerCase()) {
          return res.status(403).json({ message: "Cross-site requests are not allowed" });
        }
      } else if (req.headers["sec-fetch-site"] === "cross-site") {
        return res.status(403).json({ message: "Cross-site requests are not allowed" });
      }
    }
    next();
  };
}
