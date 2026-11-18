import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { userDataDir } from "./prepare";

test("data lives in the usual per-user folder of each platform", () => {
  assert.equal(
    userDataDir("win32", { APPDATA: "C:\\Users\\a\\AppData\\Roaming" }, "C:\\Users\\a"),
    path.join("C:\\Users\\a\\AppData\\Roaming", "Symlit"),
  );
  assert.equal(
    userDataDir("darwin", {}, "/Users/a"),
    path.join("/Users/a", "Library", "Application Support", "Symlit"),
  );
  assert.equal(userDataDir("linux", {}, "/home/a"), path.join("/home/a", ".local", "share", "symlit"));
  assert.equal(userDataDir("linux", { XDG_DATA_HOME: "/data" }, "/home/a"), path.join("/data", "symlit"));
});
