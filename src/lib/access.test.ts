import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { decideAccess } from "@/lib/access";

const admin = { adminId: "a1", clientId: null };
const client = { adminId: null, clientId: "c1" };
const both = { adminId: "a1", clientId: "c1" };
const nobody = { adminId: null, clientId: null };

const allowed = { kind: "allow" } as const;
const unauthorized = { kind: "unauthorized" } as const;
const toAdminLogin = (callbackUrl: string) => ({ kind: "redirect", to: "/admin/login", callbackUrl }) as const;
const toLogin = (callbackUrl: string) => ({ kind: "redirect", to: "/login", callbackUrl }) as const;

describe("console pages", () => {
  it("are for a signed-in admin only, whether or not a booking session is open", () => {
    for (const path of ["/dashboard", "/dashboard/clients", "/dashboard/rapports?x=1"]) {
      assert.deepEqual(decideAccess({ pathname: path, ...admin }), allowed, path);
      assert.deepEqual(decideAccess({ pathname: path, ...both }), allowed, path);
    }
  });

  it("send everyone else to the console sign-in, and bring them back", () => {
    assert.deepEqual(decideAccess({ pathname: "/dashboard/clients", ...nobody }), toAdminLogin("/dashboard/clients"));
    // A client session is not an admin session.
    assert.deepEqual(decideAccess({ pathname: "/dashboard", ...client }), toAdminLogin("/dashboard"));
  });
});

describe("booking pages and their APIs", () => {
  const paths = ["/reservation/abc/contrat", "/reservation/new", "/api/reservations/abc", "/api/availability", "/api/documents/upload", "/api/contracts/abc/sign", "/api/deposits/abc/setup"];

  it("are for a client or guest session, whether or not the console is open too", () => {
    for (const path of paths) {
      assert.deepEqual(decideAccess({ pathname: path, ...client }), allowed, path);
      assert.deepEqual(decideAccess({ pathname: path, ...both }), allowed, path);
    }
  });

  it("send everyone else to the client sign-in, an admin session alone does not count", () => {
    for (const path of paths) {
      assert.deepEqual(decideAccess({ pathname: path, ...nobody }), toLogin(path), path);
      assert.deepEqual(decideAccess({ pathname: path, ...admin }), toLogin(path), path);
    }
  });

  it("let anyone open the guest checkout page, which is how a guest gets a session", () => {
    assert.deepEqual(decideAccess({ pathname: "/reservation/invite", ...nobody }), allowed);
  });
});

describe("stored files", () => {
  it("fleet and inspection photos are for staff only", () => {
    for (const path of ["/api/files/trailers/a.jpg", "/api/files/inspections/r1/a.jpg"]) {
      assert.deepEqual(decideAccess({ pathname: path, ...admin }), allowed, path);
      assert.deepEqual(decideAccess({ pathname: path, ...nobody }), unauthorized, path);
      assert.deepEqual(decideAccess({ pathname: path, ...client }), unauthorized, path);
    }
  });

  it("contracts, signatures and documents reach staff and clients (the route then checks whose they are)", () => {
    for (const path of ["/api/files/contracts/r1.pdf", "/api/files/signatures/r1.png", "/api/files/documents/c1/a.pdf"]) {
      assert.deepEqual(decideAccess({ pathname: path, ...admin }), allowed, path);
      assert.deepEqual(decideAccess({ pathname: path, ...client }), allowed, path);
      assert.deepEqual(decideAccess({ pathname: path, ...nobody }), unauthorized, path);
    }
  });

  it("any other stored path needs a client session, as before", () => {
    assert.deepEqual(decideAccess({ pathname: "/api/files/other/x", ...admin }), toLogin("/api/files/other/x"));
    assert.deepEqual(decideAccess({ pathname: "/api/files/other/x", ...client }), allowed);
  });
});
