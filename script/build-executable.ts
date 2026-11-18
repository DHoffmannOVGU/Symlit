/**
 * Builds a single-file Symlit executable for the current platform with Node's
 * single executable applications (SEA): the server bundle, the client, the
 * migrations and PGlite's WebAssembly files, injected into a copy of `node`.
 *
 *   npm run build:exe        → release/symlit-<version>-<platform>-<arch>[.exe]
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, chmodSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { build as esbuild } from "esbuild";

const root = path.resolve(import.meta.dirname, "..");
const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const work = path.join(root, "release", ".work");
const isWindows = process.platform === "win32";
const platformName = { win32: "windows", darwin: "macos", linux: "linux" }[process.platform as string] ?? process.platform;
const output = path.join(root, "release", `symlit-${pkg.version}-${platformName}-${process.arch}${isWindows ? ".exe" : ""}`);

function run(command: string, args: string[]) {
  execFileSync(command, args, { stdio: "inherit", cwd: root, shell: isWindows && command !== process.execPath });
}

function listFiles(dir: string, base = dir): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? listFiles(full, base) : [path.relative(base, full).split(path.sep).join("/")];
  });
}

async function main() {
  rmSync(work, { recursive: true, force: true });
  mkdirSync(work, { recursive: true });

  console.log("building client and server...");
  run("npm", ["run", "build"]);

  console.log("bundling the executable entry point...");
  const bundle = path.join(work, "symlit.cjs");
  await esbuild({
    entryPoints: [path.join(root, "server/executable/main.ts")],
    platform: "node",
    target: "node22",
    bundle: true,
    format: "cjs",
    outfile: bundle,
    minify: true,
    define: {
      __SYMLIT_VERSION__: JSON.stringify(pkg.version),
      // ESM-only code asks for its own location; give it the executable's
      // real path (absolute on every platform). PGlite gets its files handed over.
      "import.meta.url": "__symlitModuleUrl",
    },
    banner: { js: 'var __symlitModuleUrl=require("node:url").pathToFileURL(__filename).href;' },
    // Optional native addon of `pg`, and the dev-only Vite middleware.
    external: ["pg-native", "./vite"],
    logLevel: "warning",
  });

  const assets: Record<string, string> = {};
  for (const file of listFiles(path.join(root, "dist", "public"))) {
    assets[`public/${file}`] = path.join(root, "dist", "public", file);
  }
  for (const file of listFiles(path.join(root, "migrations"))) {
    assets[`migrations/${file}`] = path.join(root, "migrations", file);
  }
  const pglite = path.join(root, "node_modules", "@electric-sql", "pglite", "dist");
  assets["pglite/postgres.wasm"] = path.join(pglite, "postgres.wasm");
  assets["pglite/postgres.data"] = path.join(pglite, "postgres.data");
  const manifest = path.join(work, "manifest.json");
  writeFileSync(manifest, JSON.stringify(Object.keys(assets)));
  assets["manifest.json"] = manifest;

  const blob = path.join(work, "symlit.blob");
  const seaConfig = path.join(work, "sea-config.json");
  writeFileSync(
    seaConfig,
    JSON.stringify({ main: bundle, output: blob, disableExperimentalSEAWarning: true, useCodeCache: false, assets }),
  );
  console.log(`packing ${Object.keys(assets).length} files...`);
  run(process.execPath, ["--experimental-sea-config", seaConfig]);

  copyFileSync(process.execPath, output);
  chmodSync(output, 0o755);
  if (process.platform === "darwin") run("codesign", ["--remove-signature", output]);
  run("npx", [
    "postject", output, "NODE_SEA_BLOB", blob,
    "--sentinel-fuse", "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2",
    ...(process.platform === "darwin" ? ["--macho-segment-name", "NODE_SEA"] : []),
  ]);
  // macOS refuses to run unsigned binaries on Apple Silicon; an ad-hoc signature is enough.
  if (process.platform === "darwin") run("codesign", ["--sign", "-", output]);

  rmSync(work, { recursive: true, force: true });
  console.log(`built ${path.relative(root, output)} (${(statSync(output).size / 1e6).toFixed(0)} MB)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
