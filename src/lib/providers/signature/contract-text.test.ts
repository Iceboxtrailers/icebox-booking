import { afterEach, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { DEPOSIT_AMOUNT_CENTS } from "@/lib/constants";
import { computeTaxBreakdown } from "@/lib/pricing";
import { buildContractLines, buildContractText } from "@/lib/providers/signature/contract-text";

type Input = Parameters<typeof buildContractLines>[0];

const base: Input = {
  firstName: "Marie",
  lastName: "Tremblay",
  company: null,
  email: "marie@example.com",
  phone: "418-555-0100",
  trailerSize: "5x10",
  start: "2029-03-05",
  end: "2029-03-08",
  totalCents: 40000,
  usageLocation: "123 rue Test, Lévis",
};

const textOf = (overrides: Partial<Input> = {}) =>
  buildContractLines({ ...base, ...overrides })
    .flatMap((line) => ("text" in line ? [line.text] : []))
    .join("\n");

describe("contract", () => {
  it("names both parties and gives the client's contact details", () => {
    const text = textOf();
    assert.match(text, /Remorques Réfrigérées ICEBOX/);
    assert.match(text, /1005, rue du Parc-Industriel/);
    assert.match(text, /Lévis \(Québec\) G6Z 1C5/);
    assert.match(text, /Marie Tremblay/);
    assert.match(text, /Téléphone : 418-555-0100/);
    assert.match(text, /Courriel : marie@example\.com/);
  });

  it("states the rental period in days and in dates", () => {
    assert.match(textOf(), /La location est accordée pour 3 jours, du 5 mars 2029 au 8 mars 2029, inclusivement\./);
    assert.match(textOf({ end: "2029-03-06" }), /pour 1 jour, du 5 mars 2029 au 6 mars 2029/);
  });

  it("shows the amount with the same taxes as the booking screens", () => {
    const tax = computeTaxBreakdown(base.totalCents);
    const text = textOf();
    assert.match(text, /Sous-total : 400\.00 \$ CAD/);
    assert.match(text, new RegExp(`TPS \\(5%\\) : ${(tax.gstCents / 100).toFixed(2)} \\$`));
    assert.match(text, new RegExp(`TVQ \\(9,975%\\) : ${(tax.qstCents / 100).toFixed(2)} \\$`));
    assert.match(text, /Total : 459\.90 \$ CAD/);
  });

  it("states the security deposit with the amount held on the card", () => {
    const deposit = `${(DEPOSIT_AMOUNT_CENTS / 100).toFixed(2)} $ CAD`;
    const text = textOf();
    assert.ok(text.includes(`retenue (préautorisation) de ${deposit}`));
    assert.ok(text.includes(`jusqu'à concurrence de ${deposit}`));
  });

  it("describes the trailer that was booked", () => {
    const small = textOf({ trailerSize: "5x10" });
    assert.match(small, /remorque réfrigérée « ICEBOX » 5x10, à 1 essieu,/);
    assert.match(small, /Plage de température : 2°C à \+15°C/);
    const large = textOf({ trailerSize: "6x12" });
    assert.match(large, /remorque réfrigérée « ICEBOX » 6x12, à 2 essieux,/);
    assert.match(large, /Plage de température : -18°C à \+15°C/);
  });

  it("gives the place of use, or says it is to be specified", () => {
    assert.match(textOf(), /123 rue Test, Lévis/);
    assert.match(textOf({ usageLocation: null }), /À préciser/);
    assert.match(textOf({ usageLocation: "   " }), /À préciser/);
  });

  it("adds the company and the billing address only when given", () => {
    assert.ok(!textOf().includes("Acme"));
    const text = textOf({ company: "Acme inc.", billingAddress: "10 rue Principale", billingCity: "Lévis", billingProvince: "QC", billingPostalCode: "G6V 1A1" });
    assert.match(text, /Acme inc\./);
    assert.match(text, /10 rue Principale/);
    assert.match(text, /Lévis, QC G6V 1A1/);
  });

  it("starts with the title and only uses known line types", () => {
    const lines = buildContractLines(base);
    assert.equal(lines[0].type, "title");
    const known = new Set(["title", "heading", "subheading", "body", "bullet", "rule", "spacer"]);
    for (const line of lines) assert.ok(known.has(line.type), line.type);
  });

  it("flat text carries the same wording", () => {
    const flat = buildContractText(base);
    assert.match(flat, /Total : 459\.90 \$ CAD/);
    assert.match(flat, /Marie Tremblay/);
  });
});

describe("contract date", () => {
  afterEach(() => mock.timers.reset());

  // Signing at 9:30 pm on 21 October in Québec is already 22 October in UTC: the contract must say the 21st.
  it("is the day in Québec, not the UTC day (evening, summer time)", () => {
    mock.timers.enable({ apis: ["Date"], now: new Date("2026-10-22T01:30:00Z") });
    assert.match(textOf(), /Fait à Lévis, le 21 octobre 2026\./);
  });

  it("is the day in Québec in winter too", () => {
    mock.timers.enable({ apis: ["Date"], now: new Date("2026-12-01T04:30:00Z") });
    assert.match(textOf(), /Fait à Lévis, le 30 novembre 2026\./);
  });

  it("is the same day in the middle of the day", () => {
    mock.timers.enable({ apis: ["Date"], now: new Date("2026-10-21T16:00:00Z") });
    assert.match(textOf(), /Fait à Lévis, le 21 octobre 2026\./);
  });
});
