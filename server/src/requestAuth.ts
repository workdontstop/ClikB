import type { NextFunction, Request, Response } from "express";
import { verifyToken } from "./jwtUtils";

export type AuthenticatedRequest = Request & {
  authenticatedUserId?: string;
  authenticatedOwnerId?: string;
};

const extractCookieHeaderCandidates = (cookieHeader: unknown): string[] => {
  if (typeof cookieHeader !== "string" || !cookieHeader.trim()) return [];
  const candidates: string[] = [];
  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx <= 0) continue;
    const name = trimmed.slice(0, eqIdx).trim();
    if (name !== "authToken") continue;
    let rawVal = trimmed.slice(eqIdx + 1).trim();
    if (!rawVal) continue;
    try {
      rawVal = decodeURIComponent(rawVal);
    } catch {
      // keep raw value if percent-decoding fails
    }
    if (rawVal.startsWith('"') && rawVal.endsWith('"') && rawVal.length >= 2) {
      rawVal = rawVal.slice(1, -1);
    }
    candidates.push(rawVal);
    if (rawVal.startsWith("s:")) {
      const unsignedPayload = rawVal.slice(2);
      const lastDot = unsignedPayload.lastIndexOf(".");
      if (lastDot > 0) {
        candidates.push(unsignedPayload.slice(0, lastDot));
      }
      candidates.push(unsignedPayload);
    }
  }
  return candidates;
};

/**
 * Resolve the member identity exclusively from the signed HttpOnly cookie.
 * Guest is member 1, but it is still authenticated through the normal login
 * route and receives the same signed cookie as every other member.
 * Also supports raw HTTP upgrade requests (e.g. WebSocket) where Express
 * cookie-parser middleware has not populated `req.cookies`.
 */
export const authenticatedUserId = (req: Request | any): string | null => {
  if (!req || typeof req !== "object") return null;
  const cached = String((req as AuthenticatedRequest).authenticatedUserId || "").trim();
  if (cached) return cached;

  const directToken = (req as any).signedCookies?.authToken ?? (req as any).cookies?.authToken;
  const candidates: string[] = [];
  if (typeof directToken === "string" && directToken.trim()) {
    const trimmed = directToken.trim();
    candidates.push(trimmed);
    if (trimmed.startsWith("s:")) {
      const unsignedPayload = trimmed.slice(2);
      const lastDot = unsignedPayload.lastIndexOf(".");
      if (lastDot > 0) {
        candidates.push(unsignedPayload.slice(0, lastDot));
      }
    }
  }
  const headerCookie = (req as any).headers?.cookie;
  for (const candidate of extractCookieHeaderCandidates(headerCookie)) {
    if (!candidates.includes(candidate)) {
      candidates.push(candidate);
    }
  }

  for (const token of candidates) {
    if (!token) continue;
    try {
      const claims = verifyToken(token);
      const id = String(claims?.id || "").trim();
      const owner = String(claims?.ownerId || (id === '1' ? id : '')).trim();
      if (!/^\d+$/.test(id) || Number(id) <= 0) continue;
      if (!/^\d+$/.test(owner) || Number(owner) <= 0) continue;
      (req as AuthenticatedRequest).authenticatedUserId = id;
      (req as AuthenticatedRequest).authenticatedOwnerId = owner;
      return id;
    } catch {
      // try next candidate if present
    }
  }
  return null;
};

/** The signed-in human owns the wallet even while operating a Creative Profile. */
export const authenticatedOwnerId = (req: Request | any): string | null => {
  const active = authenticatedUserId(req);
  return active ? (req as AuthenticatedRequest).authenticatedOwnerId || active : null;
};

export const requireAuthenticatedRequest = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const userId = authenticatedOwnerId(req);
  if (!userId) {
    res.status(401).json({ message: "Your session has expired. Please sign in again." });
    return;
  }
  next();
};

/** Reject attempts to operate on another member while legacy clients migrate. */
export const rejectMismatchedUserId = (
  req: Request,
  res: Response,
  candidate: unknown,
): string | null => {
  const userId = authenticatedOwnerId(req);
  if (!userId) {
    res.status(401).json({ message: "Your session has expired. Please sign in again." });
    return null;
  }

  if (candidate !== undefined && candidate !== null && String(candidate).trim() !== "") {
    const requestedId = String(candidate).trim();
    if (requestedId !== userId && requestedId !== authenticatedUserId(req)) {
      res.status(403).json({ message: "You cannot access another member's pixel balance." });
      return null;
    }
  }
  return userId;
};
