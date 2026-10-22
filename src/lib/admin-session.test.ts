import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { encode } from "next-auth/jwt";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_SECONDS,
  adminSessionCookie,
  clearedAdminSessionCookie,
  createAdminSessionToken,
  readAdminSessionToken,
} from "@/lib/admin-session";

const SECRET = "test-secret-for-the-admin-session";
// The cookie Auth.js uses for clients and guests, which is also the salt of their tokens.
const CLIENT_COOKIE = "authjs.session-token";

describe("console session token", () => {
  const saved = process.env.AUTH_SECRET;
  beforeEach(() => {
    process.env.AUTH_SECRET = SECRET;
  });
  afterEach(() => {
    if (saved === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = saved;
  });

  it("gives back the admin it was made for", async () => {
    const token = await createAdminSessionToken("admin-1");
    assert.deepEqual(await readAdminSessionToken(token), { adminId: "admin-1" });
  });

  it("is not readable without the secret, and not with another one", async () => {
    const token = await createAdminSessionToken("admin-1");
    assert.ok(!token.includes("admin-1"), "the admin id must not be visible in the cookie");
    process.env.AUTH_SECRET = "another-secret";
    assert.equal(await readAdminSessionToken(token), null);
  });

  it("is refused when it has been altered", async () => {
    const token = await createAdminSessionToken("admin-1");
    const altered = `${token.slice(0, -4)}${token.endsWith("AAAA") ? "BBBB" : "AAAA"}`;
    assert.equal(await readAdminSessionToken(altered), null);
    assert.equal(await readAdminSessionToken("not-a-token"), null);
    assert.equal(await readAdminSessionToken(""), null);
    assert.equal(await readAdminSessionToken(null), null);
    assert.equal(await readAdminSessionToken(undefined), null);
  });

  it("is refused once it has expired", async () => {
    const expired = await encode({ token: { kind: "admin", adminId: "admin-1" }, secret: SECRET, salt: ADMIN_SESSION_COOKIE, maxAge: -100 });
    assert.equal(await readAdminSessionToken(expired), null);
  });

  // The point of the separate session: a token of the clients' session is no admin token, even with the
  // same secret and an admin id inside, and an admin token does not open the clients' session either.
  it("cannot be built from a client or guest session token", async () => {
    const clientToken = await encode({ token: { clientId: "client-1" }, secret: SECRET, salt: CLIENT_COOKIE });
    assert.equal(await readAdminSessionToken(clientToken), null);
    const clientTokenWithAdminId = await encode({ token: { kind: "admin", adminId: "admin-1" }, secret: SECRET, salt: CLIENT_COOKIE });
    assert.equal(await readAdminSessionToken(clientTokenWithAdminId), null);
  });

  it("is not a client session either", async () => {
    const { decode } = await import("next-auth/jwt");
    const token = await createAdminSessionToken("admin-1");
    await assert.rejects(decode({ token, secret: SECRET, salt: CLIENT_COOKIE }));
  });

  it("must say it is an admin token and carry an admin id", async () => {
    for (const claims of [{ adminId: "admin-1" }, { kind: "client", adminId: "admin-1" }, { kind: "admin" }, { kind: "admin", adminId: "" }, { kind: "admin", adminId: 42 }]) {
      const token = await encode({ token: claims, secret: SECRET, salt: ADMIN_SESSION_COOKIE });
      assert.equal(await readAdminSessionToken(token), null, JSON.stringify(claims));
    }
  });

  it("needs the server secret to be set", async () => {
    delete process.env.AUTH_SECRET;
    await assert.rejects(createAdminSessionToken("admin-1"));
    assert.equal(await readAdminSessionToken("anything"), null);
  });
});

describe("console session cookie", () => {
  it("is private to the server, not sent along cross-site requests, and lasts 30 days", () => {
    assert.deepEqual(adminSessionCookie("token", true), {
      name: ADMIN_SESSION_COOKIE,
      value: "token",
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: true,
      maxAge: 30 * 24 * 60 * 60,
    });
    assert.equal(ADMIN_SESSION_SECONDS, 30 * 24 * 60 * 60);
  });

  it("is only marked secure over https, so it also works on local http", () => {
    assert.equal(adminSessionCookie("token", false).secure, false);
  });

  it("has a name of its own, which is not a prefix or an extension of the clients' cookie", () => {
    // Auth.js reads every cookie whose name starts with its own as pieces of one session.
    assert.ok(!ADMIN_SESSION_COOKIE.startsWith(CLIENT_COOKIE));
    assert.ok(!CLIENT_COOKIE.startsWith(ADMIN_SESSION_COOKIE));
  });

  it("is cleared by an empty cookie that expires at once", () => {
    const cleared = clearedAdminSessionCookie(true);
    assert.equal(cleared.name, ADMIN_SESSION_COOKIE);
    assert.equal(cleared.value, "");
    assert.equal(cleared.maxAge, 0);
    assert.equal(cleared.path, "/");
    assert.equal(cleared.httpOnly, true);
  });
});
