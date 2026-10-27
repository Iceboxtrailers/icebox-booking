import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ContractView } from "@/components/forms/ContractView";
import { buildContractLines } from "@/lib/providers/signature/contract-text";

const base = {
  firstName: "Marie",
  lastName: "Tremblay",
  company: "Acme inc.",
  email: "marie@example.com",
  phone: "418-555-0100",
  trailerSize: "6x12" as const,
  start: "2029-03-05",
  end: "2029-03-08",
  totalCents: 40000,
  usageLocation: "123 rue Test, Lévis",
  deliveryOption: "delivery" as const,
  deliveryFeeCents: 9000,
};

const html = renderToStaticMarkup(createElement(ContractView, { lines: buildContractLines(base) }));
const text = html
  .replace(/<[^>]+>/g, " ")
  .replace(/&#x27;/g, "'")
  .replace(/&amp;/g, "&")
  .replace(/[\u00a0\s]+/g, " ");

describe("the contract the client reads before signing", () => {
  it("shows the five parts, with the eyebrow and the title of each", () => {
    for (const phrase of ["Remorque réfrigérée", "CONDITIONS FINANCIÈRES", "Prix et paiement", "Dépôt et responsabilités", "Assurance et retour", "Fiche de remise et signatures"]) {
      assert.ok(text.includes(phrase), phrase);
    }
  });

  it("shows the articles in order, from the parties to the signatures", () => {
    const at = (phrase: string) => text.indexOf(phrase);
    const phrases = ["1. Parties au contrat", "2. Réservation et lieu d’utilisation", "4. Prix convenu pour cette réservation", "6. Retards de paiement", "7. Dépôt de garantie", "10. Assurances", "13. Entente et acceptation", "Identification et caractéristiques à confirmer", "Signatures"];
    phrases.forEach((phrase, i) => {
      assert.ok(at(phrase) >= 0, phrase);
      if (i > 0) assert.ok(at(phrase) > at(phrases[i - 1]), `${phrase} after ${phrases[i - 1]}`);
    });
  });

  it("puts the bold passages in strong text and nothing else", () => {
    assert.ok(html.includes('<strong class="font-semibold text-foreground">Acme inc. / Marie Tremblay</strong>'));
    assert.ok(html.includes("quinze (15) jours suivant sa réception</strong>"));
    assert.ok(!html.includes("**"));
  });

  it("shows the rows of the tables as labels and values, and the amounts", () => {
    assert.ok(html.includes("<dt"), "tables are description lists");
    for (const phrase of ["Période prévue", "Du 5 mars 2029 au 8 mars 2029", "Livraison par ICEBOX le 5 mars 2029.", "Location • forfait de 3 jours", "310,00 $", "Transport • livraison et récupération", "90,00 $", "Total à payer • CAD", "459,90 $"]) {
      assert.ok(text.includes(phrase), phrase);
    }
  });

  it("shows the blanks to complete and the two parties' signature lines", () => {
    assert.ok(text.includes("Nom légal exact du locataire : ____"));
    assert.ok(text.includes("Pour ICEBOX Inc."));
    assert.ok(text.includes("Pour le Locataire"));
    assert.ok(text.includes("Nom / qualité : ____"));
    assert.ok(text.includes("acceptent les cinq pages du présent contrat"));
  });

  it("lets the blanks break anywhere, so a phone does not scroll sideways", () => {
    assert.ok(html.includes("[overflow-wrap:anywhere]"));
  });

  it("does not show the footer line of the PDF", () => {
    assert.ok(!text.includes("Acme inc. • 5 mars au 8 mars 2029"));
  });
});
