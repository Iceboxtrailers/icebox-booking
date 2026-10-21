import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { RATE_RULES, clientIp, rateLimitKey } from "@/lib/rate-limit";

describe("rate limit rules", () => {
  it("each have a positive limit and window, and a name of their own", () => {
    const rules = Object.values(RATE_RULES);
    for (const rule of rules) {
      assert.ok(rule.limit > 0, rule.name);
      assert.ok(rule.windowSeconds > 0, rule.name);
    }
    // The name starts the counter key: two rules with one name would share one counter.
    assert.equal(new Set(rules.map((rule) => rule.name)).size, rules.length);
  });
});

describe("rate limit key", () => {
  const saved = process.env.AUTH_SECRET;
  beforeEach(() => {
    process.env.AUTH_SECRET = "test-secret";
  });
  afterEach(() => {
    if (saved === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = saved;
  });

  it("is the same for the same requester, whatever the letter case", () => {
    assert.equal(rateLimitKey(RATE_RULES.login, "Someone@Example.com"), rateLimitKey(RATE_RULES.login, "someone@example.com"));
  });

  it("differs between requesters and between rules", () => {
    assert.notEqual(rateLimitKey(RATE_RULES.login, "a@example.com"), rateLimitKey(RATE_RULES.login, "b@example.com"));
    assert.notEqual(rateLimitKey(RATE_RULES.login, "a@example.com"), rateLimitKey(RATE_RULES.signup, "a@example.com"));
  });

  it("never holds an address or an email in the clear", () => {
    const key = rateLimitKey(RATE_RULES.login, "someone@example.com");
    assert.match(key, /^login:[0-9a-f]{24}$/);
    assert.ok(!key.includes("someone"));
    const ipKey = rateLimitKey(RATE_RULES.loginIp, "203.0.113.7");
    assert.ok(!ipKey.includes("203"));
  });

  it("depends on the server secret", () => {
    const before = rateLimitKey(RATE_RULES.login, "a@example.com");
    process.env.AUTH_SECRET = "another-secret";
    assert.notEqual(before, rateLimitKey(RATE_RULES.login, "a@example.com"));
  });
});

describe("requester address", () => {
  const request = (headers: Record<string, string>) => new Request("https://example.com/", { headers });

  it("is the first address the platform forwards", () => {
    assert.equal(clientIp(request({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" })), "203.0.113.7");
  });

  it("falls back to x-real-ip, then to unknown", () => {
    assert.equal(clientIp(request({ "x-real-ip": "198.51.100.4" })), "198.51.100.4");
    assert.equal(clientIp(request({})), "unknown");
  });
});
