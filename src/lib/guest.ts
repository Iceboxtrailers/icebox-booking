import { createHash, randomBytes } from "node:crypto";

// Booking without an account. Each guest booking is its own admin-only Client record
// (hasAccount = false): there is no password, no login by email and no way to reach the
// record again after the session ends. The browser gets a one-time token to sign in once.

// How long the one-time sign-in token is valid after the record is created.
export const GUEST_TOKEN_TTL_MS = 10 * 60 * 1000;

// Flood guard: at most this many guest records per window, for the whole site.
export const GUEST_START_LIMIT = { count: 30, windowMs: 10 * 60 * 1000 };

export function newGuestToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashGuestToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
