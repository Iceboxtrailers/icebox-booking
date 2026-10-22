import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  AUDIT_CATEGORIES,
  KNOWN_AUDIT_ACTIONS,
  actionsInCategory,
  actorLabel,
  clientIdOfDocumentEvent,
  describeAuditEvent,
  documentFromPath,
  isAuditCategory,
  isProblemAction,
} from "@/lib/admin/audit-events";

const plain = (value: string | null) => (value ?? "").replace(/\s/g, " ");

// Every action the app writes to the audit log, found in the source: a new one has to be added to the
// journal's table, or the owner would only ever see its raw name.
function actionsWrittenByTheApp(): Set<string> {
  const found = new Set<string>();
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "generated" && entry.name !== "node_modules") walk(full);
      } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".test.ts")) {
        const source = readFileSync(full, "utf8");
        if (!source.includes("logAudit(")) continue;
        for (const match of source.matchAll(/action:\s*([^,}]+)/g)) {
          for (const literal of match[1].matchAll(/"([a-z]+(?:_[a-z]+)+)"/g)) found.add(literal[1]);
        }
      }
    }
  };
  walk(path.join(process.cwd(), "src"));
  return found;
}

describe("audit journal: actions", () => {
  it("knows every action the app writes", () => {
    const written = actionsWrittenByTheApp();
    assert.ok(written.size >= 25, `only ${written.size} actions found in the source`);
    const unknown = [...written].filter((action) => !KNOWN_AUDIT_ACTIONS.includes(action));
    assert.deepEqual(unknown, [], "add these to KNOWN_ACTIONS in src/lib/admin/audit-events.ts");
  });

  it("lists nothing the app no longer writes", () => {
    const written = actionsWrittenByTheApp();
    assert.deepEqual(KNOWN_AUDIT_ACTIONS.filter((action) => !written.has(action)), []);
  });

  it("puts every action under exactly one topic, and the problems under « À vérifier »", () => {
    const topics = AUDIT_CATEGORIES.filter((category) => category.id !== "problemes");
    for (const action of KNOWN_AUDIT_ACTIONS) {
      const homes = topics.filter((topic) => actionsInCategory(topic.id).includes(action));
      assert.equal(homes.length, 1, action);
    }
    assert.deepEqual(actionsInCategory("problemes").sort(), KNOWN_AUDIT_ACTIONS.filter(isProblemAction).sort());
    assert.ok(actionsInCategory("problemes").includes("email_failed"));
    assert.ok(actionsInCategory("problemes").includes("quickbooks_sync_failed"));
  });

  it("recognises the filter names of the page", () => {
    for (const category of AUDIT_CATEGORIES) assert.equal(isAuditCategory(category.id), true);
    for (const value of ["tout", "", undefined, null, 3, "__proto__"]) assert.equal(isAuditCategory(value), false);
    assert.equal(new Set(AUDIT_CATEGORIES.map((category) => category.id)).size, AUDIT_CATEGORIES.length);
  });
});

describe("audit journal: sentences", () => {
  const describe_ = (action: string, details: unknown = null, context = {}) => describeAuditEvent({ action, details }, context);

  it("says what happened to the contract and the card", () => {
    assert.deepEqual(describe_("contract_signed", { method: "typed" }), { title: "Contrat signé par le client", detail: "nom tapé comme signature", problem: false });
    assert.equal(describe_("contract_signed", { method: "drawn" }).detail, "signature dessinée");
    assert.equal(describe_("contract_signed").detail, null);
    assert.equal(describe_("card_saved").title, "Carte enregistrée par le client");
  });

  it("shows deposit amounts and where each action came from", () => {
    const hold = describe_("deposit_authorized", { amountCents: 100000, via: "secure_link" });
    assert.equal(hold.title, "Retenue du dépôt placée");
    assert.equal(plain(hold.detail), "1 000,00 $ — confirmée par le client avec son lien");
    assert.equal(describe_("deposit_authorized", { amountCents: 100000, via: "off_session" }).detail?.endsWith("placée par le personnel"), true);
    assert.equal(plain(describe_("deposit_captured", { amountCents: 25050 }).detail), "250,50 $");
    assert.equal(describe_("deposit_released", { via: "inspection_accepted" }).detail, "après l'acceptation du retour");
    assert.equal(describe_("deposit_released", { via: "owner_manual" }).detail, "libéré à la main par le propriétaire");
    assert.equal(plain(describe_("deposit_captured_externally", { amountCents: 100000 }).detail), "1 000,00 $");
  });

  it("dates the deposit link in Québec time", () => {
    // 21 October 2026, 9:30 pm in Québec is already 22 October in UTC.
    assert.equal(describe_("deposit_link_created", { expiresAt: "2026-10-22T01:30:00.000Z" }).detail, "valide jusqu'au 21 octobre 2026");
    assert.equal(describe_("deposit_link_created", { expiresAt: "not a date" }).detail, null);
  });

  it("tells a link e-mail that went out from one that could not", () => {
    assert.equal(describe_("deposit_link_emailed", { to: "a@b.ca", delivered: true }).title, "Lien du dépôt envoyé par courriel");
    assert.equal(describe_("deposit_link_emailed", { to: "a@b.ca", delivered: false }).title, "Lien du dépôt non envoyé (courriels pas encore configurés)");
    assert.equal(describe_("deposit_link_emailed", { to: "a@b.ca", delivered: true }).detail, "a@b.ca");
  });

  it("flags what went wrong, with the reason", () => {
    for (const [action, details] of [
      ["email_failed", { kind: "client_confirmation", message: "Resend 422: bad address" }],
      ["quickbooks_sync_failed", { message: "token expired" }],
      ["deposit_payment_failed", { message: "card declined" }],
      ["deposit_authorize_failed", { reason: "failed", message: "insufficient funds" }],
      ["deposit_renew_old_hold_not_released", { transactionId: "pi_1" }],
    ] as const) {
      assert.equal(describe_(action, details).problem, true, action);
    }
    assert.equal(describe_("email_failed", { kind: "client_confirmation", message: "boom" }).title, "Courriel de confirmation non envoyé au client");
    assert.equal(describe_("email_failed", { kind: "client_confirmation", message: "boom" }).detail, "boom");
    assert.equal(describe_("contract_signed").problem, false);
  });

  it("names the client and the kind of document for staff views and checks", () => {
    const path = "documents/client1/license-1792600000000-ab12cd.jpg";
    assert.deepEqual(describe_("document_viewed", { path }, { clientName: "Marie Tremblay" }), {
      title: "Document consulté : permis de conduire",
      detail: "Marie Tremblay",
      problem: false,
    });
    assert.equal(describe_("document_viewed", { path: "documents/c/insurance-1-aa.pdf" }).title, "Document consulté : preuve d'assurance");
    assert.equal(describe_("document_viewed", { path: "something else" }).title, "Document consulté");
    const check = describe_("document_verification", { type: "insurance", from: "pending", to: "rejected" }, { clientName: "Marie Tremblay" });
    assert.equal(check.title, "Document « preuve d'assurance » refusé");
    assert.equal(describe_("document_verification", { type: "license", to: "verified" }).title, "Document « permis de conduire » vérifié");
  });

  it("describes returns, accounting and staff changes", () => {
    assert.equal(describe_("inspection_accepted", { photoCount: 5, depositReleased: true }).detail, "5 photos — dépôt libéré");
    assert.equal(describe_("inspection_accepted", { photoCount: 1, depositReleased: false }).detail, "1 photo");
    assert.equal(describe_("inspection_issue", { notes: "Porte   abîmée\nà gauche" }).detail, "Porte abîmée à gauche");
    assert.equal(describe_("quickbooks_invoice_created", { invoiceNumber: "1074" }).detail, "n° 1074");
    assert.equal(describe_("employee_created", { username: "vincent" }).detail, "vincent");
    assert.equal(describe_("mfa_enabled", { username: "owner" }).title, "Authentification à deux facteurs activée");
    assert.equal(describe_("departure_deposit_waived", { depositStatus: "none" }).title, "Remise sans retenue de dépôt autorisée");
  });

  it("shortens a very long message", () => {
    const detail = describe_("quickbooks_sync_failed", { message: "x".repeat(900) }).detail ?? "";
    assert.ok(detail.length <= 220);
    assert.ok(detail.endsWith("…"));
  });

  it("shows an action it does not know as it is", () => {
    assert.deepEqual(describe_("something_new", { a: 1 }), { title: "something_new", detail: null, problem: false });
  });

  it("never throws, whatever was stored as details", () => {
    for (const action of KNOWN_AUDIT_ACTIONS) {
      for (const details of [null, undefined, "text", 42, [], [1, 2], {}, { message: 5, path: 7, amountCents: "x", username: {} }]) {
        const result = describe_(action, details);
        assert.ok(result.title.length > 0, action);
      }
    }
  });
});

describe("audit journal: helpers", () => {
  it("reads the client and the kind of document from the stored path", () => {
    assert.deepEqual(documentFromPath("documents/abc123/license-1-aa.png"), { clientId: "abc123", type: "license" });
    assert.deepEqual(documentFromPath("documents/abc123/insurance-1-aa.pdf"), { clientId: "abc123", type: "insurance" });
    for (const bad of ["contracts/r1.pdf", "documents/abc123/passport-1.pdf", "documents/abc123", 5, null, undefined]) {
      assert.equal(documentFromPath(bad), null, String(bad));
    }
  });

  it("finds the client a document event is about", () => {
    assert.equal(clientIdOfDocumentEvent("document_viewed", { path: "documents/abc123/license-1-aa.png" }), "abc123");
    assert.equal(clientIdOfDocumentEvent("document_verification", { clientId: "abc123" }), "abc123");
    assert.equal(clientIdOfDocumentEvent("card_saved", { clientId: "abc123" }), null);
    assert.equal(clientIdOfDocumentEvent("document_viewed", null), null);
  });

  it("names who did it", () => {
    assert.equal(actorLabel("admin", "vincent"), "vincent");
    assert.equal(actorLabel("admin", null), "Employé supprimé");
    assert.equal(actorLabel("client", "Marie Tremblay"), "Marie Tremblay");
    assert.equal(actorLabel("client", null), "Client");
    assert.equal(actorLabel("system", null), "Système");
    assert.equal(actorLabel("stripe", null), "Stripe");
    assert.equal(actorLabel("other", null), "other");
  });
});
