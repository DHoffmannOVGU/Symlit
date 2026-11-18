/**
 * First module the executable runs, before any server module is loaded:
 * chooses the data folder and unpacks the client and migrations from the
 * executable so the regular server code finds them on disk.
 */
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import sea from "node:sea";
import { appVersion } from "../version";
import { setPgliteAssets } from "../db";

/** Where Symlit keeps its data on this computer. */
export function userDataDir(
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
  home: string = os.homedir(),
): string {
  if (platform === "win32") {
    return path.join(env.APPDATA || path.join(home, "AppData", "Roaming"), "Symlit");
  }
  if (platform === "darwin") return path.join(home, "Library", "Application Support", "Symlit");
  return path.join(env.XDG_DATA_HOME || path.join(home, ".local", "share"), "symlit");
}

const MANIFEST = "manifest.json";

/** Writes every embedded file under `prefix/` to `targetDir`, once per version. */
function unpack(targetDir: string, files: string[]) {
  const marker = path.join(targetDir, ".complete");
  if (existsSync(marker)) return;
  rmSync(targetDir, { recursive: true, force: true });
  for (const file of files) {
    const target = path.join(targetDir, ...file.split("/"));
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, new Uint8Array(sea.getAsset(file)));
  }
  writeFileSync(marker, appVersion);
}

/** Removes files unpacked by older versions. */
function removeOldRuntimes(runtimeRoot: string, keep: string) {
  for (const entry of readdirSync(runtimeRoot)) {
    if (entry !== keep) rmSync(path.join(runtimeRoot, entry), { recursive: true, force: true });
  }
}

if (sea.isSea()) {
  const dataHome = userDataDir();
  // Settings can also live in a .env file in the data folder.
  try {
    process.loadEnvFile(path.join(dataHome, ".env"));
  } catch {
    // No settings file: the defaults apply.
  }
  process.env.NODE_ENV = "production";
  process.env.SYMLIT_DATA_DIR ??= dataHome;

  const files = JSON.parse(sea.getAsset(MANIFEST, "utf8")) as string[];
  const runtimeRoot = path.join(dataHome, "runtime");
  const runtimeDir = path.join(runtimeRoot, appVersion);
  unpack(runtimeDir, files.filter((f) => f.startsWith("public/") || f.startsWith("migrations/")));
  try {
    removeOldRuntimes(runtimeRoot, appVersion);
  } catch {
    // Old files are only clutter; never block the start over them.
  }
  process.env.SYMLIT_STATIC_DIR = path.join(runtimeDir, "public");
  process.env.SYMLIT_MIGRATIONS_DIR = path.join(runtimeDir, "migrations");

  setPgliteAssets({
    wasmModule: new WebAssembly.Module(new Uint8Array(sea.getAsset("pglite/postgres.wasm"))),
    fsBundle: new Blob([sea.getAsset("pglite/postgres.data")]),
  });
}
