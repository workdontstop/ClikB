import assert from "node:assert/strict";
import test from "node:test";
import type { NextFunction, Request, Response } from "express";
import { scopeBrainstormMemoryIdentity, scopeBrainstormMemoryRequest } from "./brainstormMemoryScope";

const supplied = {
  userId: 999,
  username: "someone-else",
  sessionId: "brainstorm-session-a",
  deviceId: "brainstorm-device-a",
};

test("member memory identity comes from the signed cookie, not the payload", () => {
  assert.deepEqual(scopeBrainstormMemoryIdentity(42, supplied), {
    userId: 42,
    username: "member-42",
    sessionId: supplied.sessionId,
    deviceId: supplied.deviceId,
  });
});

test("guest scopes remain isolated even though both use member 1", () => {
  const first = scopeBrainstormMemoryIdentity(1, supplied, "a".repeat(64));
  const second = scopeBrainstormMemoryIdentity(1, supplied, "b".repeat(64));
  assert.equal(first.userId, 1);
  assert.notEqual(first.username, second.username);
});

test("middleware uses authenticated member and existing guest cookie", () => {
  const guestScope = "c".repeat(64);
  const req = {
    body: { sessionIdentity: { ...supplied } },
    cookies: { authToken: "unused", clikb_brainstorm_memory_scope: guestScope },
    authenticatedUserId: "1",
  } as unknown as Request;
  let cookieSet = false;
  let nextCalled = false;
  const res = {
    cookie: () => { cookieSet = true; },
  } as unknown as Response;
  scopeBrainstormMemoryRequest(req, res, (() => { nextCalled = true; }) as NextFunction);
  assert.equal(nextCalled, true);
  assert.equal(cookieSet, false);
  assert.deepEqual(req.body.sessionIdentity, scopeBrainstormMemoryIdentity(1, supplied, guestScope));
});

test("a new guest gets a private cookie with the environment's cookie policy", () => {
  const previousAppState = process.env.APP_STATE;
  try {
    for (const appState of ["dev", "production"]) {
      process.env.APP_STATE = appState;
      const req = {
        body: { sessionIdentity: { ...supplied } },
        cookies: {},
        authenticatedUserId: "1",
      } as unknown as Request;
      let cookie: { value: string; options: any } | undefined;
      const res = {
        cookie: (_name: string, value: string, options: any) => { cookie = { value, options }; },
      } as unknown as Response;
      scopeBrainstormMemoryRequest(req, res, (() => undefined) as NextFunction);
      assert.match(cookie?.value || "", /^[0-9a-f]{64}$/);
      assert.equal(cookie?.options.httpOnly, true);
      assert.equal(cookie?.options.secure, appState !== "dev");
      assert.equal(cookie?.options.sameSite, appState === "dev" ? "lax" : "none");
      assert.deepEqual(req.body.sessionIdentity, scopeBrainstormMemoryIdentity(1, supplied, cookie!.value));
    }
  } finally {
    if (previousAppState === undefined) delete process.env.APP_STATE;
    else process.env.APP_STATE = previousAppState;
  }
});
