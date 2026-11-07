declare const __SYMLIT_VERSION__: string | undefined;

/** Injected at build time; falls back to the npm script environment in dev. */
export const appVersion: string =
  typeof __SYMLIT_VERSION__ !== "undefined"
    ? __SYMLIT_VERSION__
    : (process.env.npm_package_version ?? "dev");
