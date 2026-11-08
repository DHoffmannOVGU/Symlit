import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { Box } from "lucide-react";
import { getNodeIcon, NODE_ICON_NAMES } from "./node-icons";

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "node_modules" ? [] : sourceFiles(path);
    return /\.tsx?$/.test(name) && !name.endsWith(".test.ts") ? [path] : [];
  });

test("every icon name written in the code is registered", () => {
  const names = new Set<string>();
  for (const file of [...sourceFiles("client/src"), ...sourceFiles("shared"), ...sourceFiles("server")]) {
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(/\b(?:icon|iconName|toolbarIconName|defaultIcon)\??: "([A-Z][A-Za-z0-9]+)"/g)) {
      names.add(match[1]);
    }
  }
  const missing = [...names].filter((name) => !NODE_ICON_NAMES.includes(name));
  assert.deepEqual(missing, [], `register these icons in client/src/lib/node-icons.ts: ${missing.join(", ")}`);
});

test("unknown or missing icon names fall back to the box", () => {
  assert.equal(getNodeIcon(undefined), Box);
  assert.equal(getNodeIcon("NoSuchIcon"), Box);
  assert.notEqual(getNodeIcon("Radio"), Box);
});
