import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runHealthChecks, safeMessage, tokenMatches } from "@/lib/health";

describe("health checks", () => {
  it("is fine when every service answers, and says which ones are not set up", async () => {
    const report = await runHealthChecks({
      database: async () => {},
      stripe: async () => "skipped: clé non configurée",
      email: async () => "clé d'envoi seulement",
    });
    assert.equal(report.ok, true);
    assert.equal(report.services.database.status, "ok");
    assert.deepEqual([report.services.stripe.status, report.services.stripe.detail], ["skipped", "clé non configurée"]);
    assert.equal(report.services.email.detail, "clé d'envoi seulement");
    assert.ok(!Number.isNaN(Date.parse(report.checkedAt)));
  });

  it("fails as a whole when one service fails, naming it, and still reports the others", async () => {
    const report = await runHealthChecks({
      database: async () => {},
      quickbooks: async () => {
        throw new Error("QuickBooks 401: token expiré");
      },
    });
    assert.equal(report.ok, false);
    assert.equal(report.services.database.status, "ok");
    assert.deepEqual([report.services.quickbooks.status, report.services.quickbooks.detail], ["fail", "QuickBooks 401: token expiré"]);
  });

  it("gives up on a service that does not answer in time", async () => {
    const report = await runHealthChecks({ storage: () => new Promise(() => {}) }, 30);
    assert.equal(report.ok, false);
    assert.equal(report.services.storage.status, "fail");
    assert.match(report.services.storage.detail ?? "", /pas de réponse/);
  });

  it("never reports a key or a token", () => {
    assert.ok(!safeMessage(new Error("bad key sk_live_abcdefghijklmnop")).includes("abcdefghij"));
    assert.ok(!safeMessage(new Error("Authorization: Bearer eyJhbGciOi.secret")).includes("eyJhbGciOi"));
    assert.ok(safeMessage(new Error("x".repeat(500))).length <= 160);
  });

  it("says something readable when a driver throws an event instead of an error", () => {
    class ErrorEvent {}
    assert.equal(safeMessage(new ErrorEvent()), "erreur ErrorEvent");
    assert.equal(safeMessage({ message: "connexion refusée" }), "connexion refusée");
    assert.equal(safeMessage("texte"), "texte");
  });

  it("answers only to the right token, and to nobody when none is configured", () => {
    assert.equal(tokenMatches("secret-token", "secret-token"), true);
    assert.equal(tokenMatches("secret-tokeX", "secret-token"), false);
    assert.equal(tokenMatches("short", "secret-token"), false);
    assert.equal(tokenMatches(null, "secret-token"), false);
    assert.equal(tokenMatches("", ""), false);
    assert.equal(tokenMatches("anything", undefined), false);
  });
});
