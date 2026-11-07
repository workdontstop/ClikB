import { randomBytes } from "crypto";
import type { NextFunction, Request, Response } from "express";
import { authenticatedUserId } from "./requestAuth";
import type { BrainstormSessionIdentity } from "./BrainstormSessionMemoryService";

const GUEST_MEMBER_ID = 1;
const GUEST_MEMORY_SCOPE_COOKIE = "clikb_brainstorm_memory_scope";
const GUEST_SCOPE_PATTERN = /^[0-9a-f]{64}$/;

/** Memory identity is server-owned; the browser only supplies session/device IDs. */
export const scopeBrainstormMemoryIdentity = (
  memberId: number,
  identity: BrainstormSessionIdentity,
  guestScope?: string,
): BrainstormSessionIdentity => {
  if (memberId === GUEST_MEMBER_ID && !GUEST_SCOPE_PATTERN.test(guestScope || "")) {
    throw new Error("Missing server-issued guest memory scope");
  }
  return {
    sessionId: identity.sessionId,
    deviceId: identity.deviceId,
    userId: memberId,
    // The memory service limits username namespace parts to 48 characters.
    username: memberId === GUEST_MEMBER_ID
      ? `guest-${guestScope!.slice(0, 40)}`
      : `member-${memberId}`,
  };
};

export const scopeBrainstormMemoryRequest = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const supplied = req.body?.sessionIdentity as BrainstormSessionIdentity | undefined;
  if (!supplied) {
    next();
    return;
  }

  const memberId = Number(authenticatedUserId(req));
  if (!Number.isSafeInteger(memberId) || memberId <= 0) {
    res.status(401).json({ message: "Your session has expired. Please sign in again." });
    return;
  }

  let guestScope: string | undefined;
  if (memberId === GUEST_MEMBER_ID) {
    const existing = String(req.cookies?.[GUEST_MEMORY_SCOPE_COOKIE] || "");
    guestScope = GUEST_SCOPE_PATTERN.test(existing) ? existing : randomBytes(32).toString("hex");
    if (guestScope !== existing) {
      res.cookie(GUEST_MEMORY_SCOPE_COOKIE, guestScope, {
        httpOnly: true,
        secure: process.env.APP_STATE !== "dev",
        sameSite: process.env.APP_STATE === "dev" ? "lax" : "none",
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });
    }
  }

  req.body.sessionIdentity = scopeBrainstormMemoryIdentity(memberId, supplied, guestScope);
  next();
};
