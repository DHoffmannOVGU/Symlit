import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { Request, Response } from "express";
import { guardLocalApi, isDatabaseId } from "./http-guards";

function run(guard: ReturnType<typeof guardLocalApi>, method: string, headers: Record<string, string>) {
  let status = 200;
  const res = {
    status(code: number) {
      status = code;
      return this;
    },
    json() {
      return this;
    },
  } as unknown as Response;
  guard({ method, headers } as unknown as Request, res, () => {});
  return status;
}

describe("guardLocalApi", () => {
  const guard = guardLocalApi(["symlit.lan"]);

  test("serves localhost, IP addresses and configured names only", () => {
    for (const host of ["localhost:5000", "127.0.0.1:5000", "[::1]:5000", "192.168.1.20", "symlit.lan:5000", "SYMLIT.LAN"]) {
      assert.equal(run(guard, "GET", { host }), 200, host);
    }
    for (const host of ["evil.example:5000", "localhost.evil.example", ""]) {
      assert.equal(run(guard, "GET", { host }), 403, host);
    }
  });

  test("writes need the app's own origin", () => {
    const host = "localhost:5000";
    assert.equal(run(guard, "POST", { host, origin: "http://localhost:5000" }), 200);
    assert.equal(run(guard, "POST", { host }), 200);
    assert.equal(run(guard, "POST", { host, origin: "http://localhost:3000" }), 403);
    assert.equal(run(guard, "DELETE", { host, origin: "null" }), 403);
    assert.equal(run(guard, "GET", { host, origin: "https://evil.example" }), 200);
  });
});

describe("isDatabaseId", () => {
  test("accepts positive 32-bit integers only", () => {
    for (const ok of ["1", "42", "2147483647"]) assert.equal(isDatabaseId(ok), true, ok);
    for (const bad of ["0", "-1", "1.5", "abc", "", "2147483648", "1e3", " 1"]) {
      assert.equal(isDatabaseId(bad), false, bad);
    }
  });
});
