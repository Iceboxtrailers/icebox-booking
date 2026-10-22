import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  confirmationEmail,
  contactRequestEmail,
  depositLinkEmail,
  escapeHtml,
  internalNewReservationEmail,
  passwordResetEmail,
} from "@/lib/email/templates";

const plain = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

const booking = {
  firstName: "Marie",
  trailerSize: "5x10",
  start: "2029-03-05",
  end: "2029-03-08",
  totalCents: 40000,
  deliveryLabel: null,
};

describe("escapeHtml", () => {
  it("neutralises everything that could open a tag or an attribute", () => {
    assert.equal(escapeHtml(`<script>alert("x")</script> & 'y'`), "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;y&#39;");
    assert.equal(escapeHtml("plain text é à"), "plain text é à");
  });
});

describe("confirmation e-mail", () => {
  it("summarises the booking for the client, in French", () => {
    const { subject, html } = confirmationEmail(booking);
    assert.equal(subject, "Confirmation de votre réservation — IceBox");
    const text = plain(html);
    assert.match(text, /Bonjour Marie,/);
    assert.match(text, /Remorque réfrigérée 5x10/);
    assert.match(text, /Du 5 mars 2029 au 8 mars 2029/);
    assert.match(text, /Ramassage au dépôt de Lévis/);
    assert.match(text, /Montant : 400\.00 \$ \(avant taxes\)/);
  });

  it("names the delivery when there is one", () => {
    const text = plain(confirmationEmail({ ...booking, deliveryLabel: "Livraison et récupération — 12 rue Test, Lévis" }).html);
    assert.match(text, /Livraison et récupération — 12 rue Test, Lévis/);
    assert.ok(!text.includes("Ramassage au dépôt de Lévis"));
  });

  it("never lets what the client typed become markup", () => {
    const { html } = confirmationEmail({ ...booking, firstName: `<img src=x onerror=alert(1)>`, deliveryLabel: `<a href="https://evil.example">gagnez</a>` });
    assert.ok(!html.includes("<img src=x"));
    assert.ok(!html.includes('<a href="https://evil.example"'));
    assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  });

  it("says the signed contract is attached only when it is", () => {
    assert.match(plain(confirmationEmail(booking).html), /Votre contrat signé est joint à ce courriel/);
    assert.match(plain(confirmationEmail({ ...booking, hasContract: true }).html), /Votre contrat signé est joint à ce courriel/);
    assert.ok(!plain(confirmationEmail({ ...booking, hasContract: false }).html).includes("contrat signé"));
  });

  it("talks about the deposit on the saved card only when there is a saved card", () => {
    assert.match(plain(confirmationEmail(booking).html), /dépôt de sécurité de 1000\.00 \$ sera retenu sur la carte que vous avez enregistrée/);
    assert.ok(!plain(confirmationEmail({ ...booking, cardOnFile: false }).html).includes("dépôt de sécurité"));
  });

  it("carries the logo and the company's address", () => {
    const { html } = confirmationEmail(booking);
    assert.match(html, /<img src="https:\/\/[^"]+\/brand\/logo-lockup\.png" alt="IceBox/);
    assert.match(plain(html), /1005 rue du Parc-Industriel, Lévis \(Québec\) G6Z 1C5/);
    assert.match(plain(html), /581 889-2093 — info@iceboxtrailers\.ca/);
  });
});

describe("password reset e-mail", () => {
  it("gives a button to the reset address, and expires in an hour", () => {
    const { subject, html } = passwordResetEmail({ firstName: "Marie", resetUrl: "https://example.test/reinitialiser-mot-de-passe?token=abc123" });
    assert.equal(subject, "Réinitialisation de votre mot de passe — IceBox");
    assert.match(html, /<a href="https:\/\/example\.test\/reinitialiser-mot-de-passe\?token=abc123"/);
    assert.match(plain(html), /Ce lien expire dans 1 heure/);
    assert.match(plain(html), /Si vous n'avez pas demandé cette réinitialisation, ignorez ce courriel/);
  });

  it("escapes the first name", () => {
    assert.ok(!passwordResetEmail({ firstName: "<b>x</b>", resetUrl: "https://example.test/r" }).html.includes("<b>x</b>"));
  });
});

describe("deposit link e-mail", () => {
  it("gives the personal link and says until when it works", () => {
    const { subject, html } = depositLinkEmail({ firstName: "Marie", link: "https://example.test/depot/tok", expiresOn: "2029-03-12" });
    assert.equal(subject, "Dépôt de sécurité à confirmer avant la remise — IceBox");
    assert.match(html, /<a href="https:\/\/example\.test\/depot\/tok"/);
    assert.match(plain(html), /valide jusqu'au 12 mars 2029/);
    assert.match(plain(html), /Rien n'est débité/);
  });
});

describe("notice for the team: new booking", () => {
  const notice = {
    clientName: "Marie Tremblay",
    clientEmail: "marie@example.com",
    clientPhone: "418-555-0100",
    trailerSize: "6x12",
    start: "2029-03-05",
    end: "2029-03-08",
    totalCents: 54000,
    deliveryLabel: null,
    adminUrl: "https://example.test/dashboard",
  };

  it("has who, what, when and a button to the console", () => {
    const { subject, html } = internalNewReservationEmail(notice);
    assert.equal(subject, "Nouvelle réservation — Marie Tremblay (5 mars 2029 → 8 mars 2029)");
    assert.match(plain(html), /Client : Marie Tremblay — marie@example\.com — 418-555-0100/);
    assert.match(plain(html), /Montant : 540\.00 \$/);
    assert.match(html, /<a href="https:\/\/example\.test\/dashboard"/);
  });

  it("keeps a line break in a name out of the subject, and markup out of the body", () => {
    const { subject, html } = internalNewReservationEmail({ ...notice, clientName: "Marie\r\nBcc: someone@example.com", clientPhone: "<i>x</i>" });
    assert.ok(!/[\r\n]/.test(subject));
    assert.ok(!html.includes("<i>x</i>"));
  });
});

describe("contact request e-mail", () => {
  it("shows the visitor's message safely, line breaks included", () => {
    const { subject, html } = contactRequestEmail({
      topic: "Question",
      name: "Marie",
      email: "marie@example.com",
      phone: "418-555-0100",
      message: "Bonjour\n<script>alert(1)</script>\nMerci",
    });
    assert.equal(subject, "IceBox — Nouvelle demande (Question)");
    assert.ok(!html.includes("<script>"));
    assert.match(html, /Bonjour<br>&lt;script&gt;alert\(1\)&lt;\/script&gt;<br>Merci/);
    assert.match(plain(html), /Téléphone : 418-555-0100/);
  });

  it("leaves out the phone line when there is none, and keeps line breaks out of the subject", () => {
    const { subject, html } = contactRequestEmail({ topic: "Devis\r\nBcc: x@example.com", name: "M", email: "m@example.com", message: "Allo" });
    assert.ok(!/[\r\n]/.test(subject));
    assert.ok(!plain(html).includes("Téléphone"));
  });
});
