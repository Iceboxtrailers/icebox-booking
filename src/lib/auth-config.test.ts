import { afterEach, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { authConfig } from "@/lib/auth.config";
import { GUEST_SESSION_MS } from "@/lib/constants";

// The callbacks are plain functions: call them the way Auth.js does, with the parts they read.
type JwtCallback = (p: { token: Record<string, unknown>; user?: { id?: string }; account?: { provider: string } }) => Promise<Record<string, unknown> | null>;
type SessionCallback = (p: { session: Record<string, unknown>; token: Record<string, unknown> }) => Promise<Record<string, unknown>>;
const jwt = authConfig.callbacks.jwt as unknown as JwtCallback;
const session = authConfig.callbacks.session as unknown as SessionCallback;

describe("booking session: sign-in", () => {
  afterEach(() => mock.timers.reset());

  it("a client with an account gets a session with their id and no guest mark", async () => {
    const token = await jwt({ token: {}, user: { id: "client-1" }, account: { provider: "credentials" } });
    assert.equal(token?.clientId, "client-1");
    assert.equal(token?.guestUntil, undefined);
  });

  it("a guest gets a session that stops working after six hours", async () => {
    mock.timers.enable({ apis: ["Date"], now: new Date("2026-10-21T12:00:00Z") });
    const token = await jwt({ token: {}, user: { id: "guest-1" }, account: { provider: "guest-session" } });
    assert.equal(token?.clientId, "guest-1");
    assert.equal(token?.guestUntil, new Date("2026-10-21T12:00:00Z").getTime() + GUEST_SESSION_MS);
  });

  it("a later read of the same token changes nothing", async () => {
    const token = { clientId: "client-1", guestUntil: 123 };
    assert.deepEqual(await jwt({ token: { ...token } }), token);
  });

  // Before the console had its own session, its token lived in this cookie. It must not pass for a booking
  // session: returning null ends it.
  it("ends a token from the time the console shared this session", async () => {
    assert.equal(await jwt({ token: { adminId: "admin-1" } }), null);
    assert.equal(await jwt({ token: { adminId: "admin-1", clientId: "client-1" } }), null);
  });
});

describe("booking session: what the pages see", () => {
  afterEach(() => mock.timers.reset());

  it("a client session carries the client id", async () => {
    const result = await session({ session: {}, token: { clientId: "client-1" } });
    assert.equal(result.clientId, "client-1");
    assert.equal(result.guest, undefined);
  });

  it("a guest session carries the id and the guest mark while it lasts", async () => {
    mock.timers.enable({ apis: ["Date"], now: new Date("2026-10-21T12:00:00Z") });
    const guestUntil = new Date("2026-10-21T12:00:00Z").getTime() + GUEST_SESSION_MS;
    const result = await session({ session: {}, token: { clientId: "guest-1", guestUntil } });
    assert.equal(result.clientId, "guest-1");
    assert.equal(result.guest, true);
  });

  it("a guest session carries nothing once the six hours are over", async () => {
    mock.timers.enable({ apis: ["Date"], now: new Date("2026-10-21T18:00:01Z") });
    const guestUntil = new Date("2026-10-21T12:00:00Z").getTime() + GUEST_SESSION_MS;
    const result = await session({ session: {}, token: { clientId: "guest-1", guestUntil } });
    assert.equal(result.clientId, undefined);
    assert.equal(result.guest, undefined);
  });

  it("never exposes an admin id, whatever the token says", async () => {
    const result = await session({ session: {}, token: { clientId: "client-1", adminId: "admin-1" } });
    assert.equal(result.adminId, undefined);
  });
});
