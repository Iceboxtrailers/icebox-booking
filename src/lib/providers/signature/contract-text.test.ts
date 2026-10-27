import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DEPOSIT_AMOUNT_CENTS } from "@/lib/constants";
import { computeTaxBreakdown } from "@/lib/pricing";
import {
  CONTRACT_PAGE_COUNT,
  TAX_NUMBERS,
  buildContractLines,
  buildContractText,
  contractParamsFor,
  contractPlainLines,
} from "@/lib/providers/signature/contract-text";

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

// The contract as plain lines (no-break spaces made plain, bold passages marked with ** when asked).
const textOf = (overrides: Partial<Input> = {}, marks = false) =>
  contractPlainLines(buildContractLines({ ...base, ...overrides }), marks)
    .join("\n")
    .replace(/\u00a0/g, " ");

const money = (cents: number) => `${(cents / 100).toFixed(2).replace(".", ",")} $`;

describe("contract", () => {
  it("names both parties and gives the client's contact details", () => {
    const text = textOf();
    assert.match(text, /Locateur \| Remorques Réfrigérées ICEBOX Inc\./);
    assert.match(text, /1005, rue du Parc-Industriel/);
    assert.match(text, /Lévis \(Québec\) G6Z 1C5/);
    assert.match(text, /Locataire \| Marie Tremblay\n \| 418-555-0100\n \| marie@example\.com/);
  });

  it("states the rental period in dates and the billed duration in days and in 24-hour periods", () => {
    assert.match(textOf({}, true), /Période prévue \| Du \*\*5 mars 2029\*\* au \*\*8 mars 2029\*\*\./);
    assert.match(textOf(), /Début : ______ h ______ • Fin : ______ h ______/);
    assert.match(textOf({}, true), /Durée facturée \| \*\*Forfait de 3 jours\*\*, correspondant à 3 périodes de 24 heures si les heures de début et de fin sont identiques\./);
    assert.match(textOf({ end: "2029-03-06" }), /Forfait de 1 jour, correspondant à 1 période de 24 heures/);
  });

  it("shows the amounts with the same taxes as the booking screens", () => {
    const tax = computeTaxBreakdown(base.totalCents);
    const text = textOf();
    assert.match(text, /Location • forfait de 3 jours \| 400,00 \$/);
    assert.ok(!text.includes("Transport •"));
    assert.match(text, /Sous-total \| 400,00 \$/);
    assert.ok(text.includes(`TPS • 5 % | ${money(tax.gstCents)}`));
    assert.ok(text.includes(`TVQ • 9,975 % | ${money(tax.qstCents)}`));
    assert.match(text, /Total à payer • CAD \| 459,90 \$/);
    assert.ok(text.includes("Le prix forfaitaire ci-dessus prévaut sur toute grille tarifaire générale"));
  });

  it("writes thousands with a space and the cents with a comma, in amounts that never break", () => {
    const lines = buildContractLines({ ...base, trailerSize: "6x12", totalCents: 244000 });
    const amounts = lines.find((line) => line.type === "amounts");
    assert.ok(amounts && amounts.type === "amounts");
    assert.deepEqual(
      amounts.rows.map((row) => row.amount),
      ["2\u00a0440,00\u00a0$", "2\u00a0440,00\u00a0$", "122,00\u00a0$", "243,39\u00a0$", "2\u00a0805,39\u00a0$"],
    );
    assert.equal(amounts.rows.at(-1)?.strong, true);
  });

  it("states the security deposit with the amount held on the card", () => {
    const deposit = `${DEPOSIT_AMOUNT_CENTS / 100} $`.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    const text = textOf();
    assert.ok(text.includes(`# 7. Dépôt de garantie de ${deposit} CAD`));
    assert.ok(textOf({}, true).includes(`**préautorisation de ${deposit}**`));
  });

  it("describes the trailer that was booked, in the contract and on the handover sheet", () => {
    const small = textOf({ trailerSize: "5x10" });
    assert.match(small, /Remorque réfrigérée ICEBOX 5 × 10, à un essieu\./);
    assert.match(small, /Modèle annoncé \| ICEBOX 5 × 10 • 1 essieu/);
    assert.match(small, /Extérieures : 5 pi × 10 pi/);
    assert.match(small, /Intérieures : 52 po × 110 po • À vérifier sur l’unité remise\./);
    assert.match(small, /Boule : 2 po • PNBV/);
    assert.match(small, /Plage annoncée : 2 °C à \+15 °C • Isolation annoncée : R-32\./);
    assert.ok(!small.includes("☐ Marche"), "the 5x10 has no step, stabilizer legs or generator spot");

    const large = textOf({ trailerSize: "6x12" });
    assert.match(large, /Remorque réfrigérée ICEBOX 6 × 12, à deux essieux\./);
    assert.match(large, /Modèle annoncé \| ICEBOX 6 × 12 • 2 essieux/);
    assert.match(large, /Extérieures : 6 pi 6 po × 12 pi/);
    assert.match(large, /Intérieures : 70 po × 120 po • À vérifier/);
    assert.match(large, /Boule : 2 5\/16 po • PNBV/);
    assert.match(large, /Plage annoncée : −18 °C à \+15 °C/);
    assert.ok(large.includes("☐ Marche ☐ Pattes stabilisatrices ☐ Emplacement avant pour génératrice"));
  });

  it("gives the place of use, or says it is to be specified", () => {
    assert.match(textOf(), /Lieu d’utilisation \| 123 rue Test, Lévis\./);
    assert.match(textOf({ usageLocation: "123 rue Test, Lévis." }), /Lieu d’utilisation \| 123 rue Test, Lévis\.\n/);
    assert.match(textOf({ usageLocation: null }), /Lieu d’utilisation \| À préciser\./);
    assert.match(textOf({ usageLocation: "   " }), /Lieu d’utilisation \| À préciser\./);
  });

  it("adds the company and the billing address only when given", () => {
    assert.ok(!textOf().includes("Acme"));
    assert.match(textOf(), /Locataire \| Marie Tremblay\n \| 418-555-0100\n/, "no address line without an address");
    const text = textOf({ company: "Acme inc.", billingAddress: "10, rue Principale", billingCity: "Lévis", billingProvince: "QC", billingPostalCode: "G6V 1A1" }, true);
    assert.match(text, /Locataire \| \*\*Acme inc\. \/ Marie Tremblay\*\*/);
    assert.match(text, /\| 10, rue Principale, Lévis \(QC\) G6V 1A1/);
    assert.match(textOf({ billingAddress: "10, rue Principale", billingCity: "Lévis" }), /\| 10, rue Principale, Lévis\n/);
    assert.match(textOf({ company: "  " }), /Locataire \| Marie Tremblay\n/);
  });

  it("leaves the fields to complete by hand blank", () => {
    const text = textOf();
    assert.ok(text.includes("Nom légal exact du locataire : __________________________________________"));
    assert.ok(text.includes("Statut : ☐ Particulier ☐ Entreprise individuelle ☐ Société / personne morale"));
    assert.ok(text.includes("NEQ, s’il y a lieu : ____________________ Représentant : ____________________"));
    assert.ok(text.includes("Unité : ____________ Immatriculation : ______________"));
    assert.ok(text.includes("Contact ICEBOX pour panne : __________________ Téléphone : ______________"));
  });

  it("opens each of the five pages with its eyebrow and title, and ends with the footer", () => {
    const lines = buildContractLines(base);
    assert.deepEqual(
      lines.filter((line) => line.type === "page"),
      [
        { type: "page", eyebrow: "CONTRAT DE LOCATION • VERSION RÉVISÉE DU 27 OCTOBRE 2026", title: "Remorque réfrigérée" },
        { type: "page", eyebrow: "CONDITIONS FINANCIÈRES", title: "Prix et paiement" },
        { type: "page", eyebrow: "GARANTIE ET UTILISATION", title: "Dépôt et responsabilités" },
        { type: "page", eyebrow: "PROTECTION ET FIN DE LOCATION", title: "Assurance et retour" },
        { type: "page", eyebrow: "ANNEXE A • PARTIE INTÉGRANTE DU CONTRAT", title: "Fiche de remise et signatures" },
      ],
    );
    assert.equal(lines[0].type, "page");
    assert.equal(lines.at(-1)?.type, "footer");
    const known = new Set(["page", "heading", "paragraph", "note", "table", "amounts", "signatures", "footer"]);
    for (const line of lines) assert.ok(known.has(line.type), line.type);
  });

  it("numbers the articles 1 to 13 in order, then the annex", () => {
    const headings = buildContractLines(base).flatMap((line) => (line.type === "heading" ? [line.text] : []));
    assert.deepEqual(
      headings.map((text) => text.split(".")[0]).filter((prefix) => /^\d+$/.test(prefix)),
      ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13"],
    );
    assert.deepEqual(headings.slice(13), ["Identification et caractéristiques à confirmer", "Équipements, état et documents remis", "Preuve d’assurance et contact"]);
  });

  it("has the contract and its annex accepted over as many pages as the PDF has", () => {
    assert.equal(CONTRACT_PAGE_COUNT, 5);
    assert.match(textOf(), /acceptent les cinq pages du présent contrat et les annexes jointes\./);
    assert.match(textOf({ pageCount: 6 }), /acceptent les six pages du présent contrat/);
    assert.match(textOf({ pageCount: 12 }), /acceptent les 12 pages du présent contrat/);
  });

  it("puts the client and the period in the footer of every page", () => {
    const footer = (overrides: Partial<Input> = {}) => buildContractLines({ ...base, ...overrides }).find((line) => line.type === "footer");
    assert.deepEqual(footer(), { type: "footer", text: "Marie Tremblay • 5 mars au 8 mars 2029" });
    assert.deepEqual(footer({ company: "Acme inc.", start: "2026-11-11", end: "2026-12-26" }), { type: "footer", text: "Acme inc. • 11 novembre au 26 décembre 2026" });
    assert.deepEqual(footer({ start: "2026-12-28", end: "2027-01-04" }), { type: "footer", text: "Marie Tremblay • 28 décembre 2026 au 4 janvier 2027" });
  });

  it("flat text carries the same wording", () => {
    const flat = buildContractText(base);
    assert.match(flat, /Total à payer • CAD \| 459,90/);
    assert.match(flat, /Marie Tremblay/);
  });
});

// The whole wording of the contract for one booking, in a file next to the test: a change to any word of the
// contract shows up here and has to be made on purpose. Run with UPDATE_GOLDEN=1 to write the file again, then read
// the difference before committing it.
describe("contract wording", () => {
  const file = join(process.cwd(), "src/lib/providers/signature/contract-golden.txt");
  const booking: Input = {
    firstName: "Marie",
    lastName: "Tremblay",
    company: "Les Délices de Marie inc.",
    email: "marie@example.com",
    phone: "418-555-0100",
    billingAddress: "10, rue Principale",
    billingCity: "Lévis",
    billingProvince: "Québec",
    billingPostalCode: "G6V 1A1",
    trailerSize: "6x12",
    start: "2029-03-05",
    end: "2029-04-19",
    totalCents: 244000,
    usageLocation: "123, rue Test, Lévis (Québec)",
    deliveryOption: "delivery",
    deliveryFeeCents: 49000,
  };

  it("is the approved contract, word for word (bold passages between **)", () => {
    const text = `${contractPlainLines(buildContractLines(booking), true).join("\n")}\n`;
    if (process.env.UPDATE_GOLDEN) writeFileSync(file, text);
    // A checkout on Windows may have turned the line ends into CRLF.
    assert.equal(text, readFileSync(file, "utf8").replace(/\r\n/g, "\n"));
  });
});

describe("contract with transport", () => {
  const delivered = { usageLocation: "777 rue Villeray, Montréal", totalCents: 40000, deliveryFeeCents: 9000 };
  const article11 = (text: string) => text.slice(text.indexOf("# 11. Restitution et inspection"), text.indexOf("# 12."));

  it("is word for word the same when the client comes to the depot", () => {
    assert.equal(textOf({ deliveryOption: "pickup", deliveryFeeCents: 9000 }), textOf());
    assert.equal(textOf({ deliveryOption: undefined, deliveryFeeCents: undefined }), textOf());
  });

  it("says that the client takes the trailer at the depot and brings it back, on which days", () => {
    const text = textOf();
    assert.match(text, /Transport convenu \| Prise en charge aux bureaux du Locateur le 5 mars 2029\.\n \| Retour aux bureaux du Locateur le 8 mars 2029\./);
    assert.match(text, /Les heures de remise et de retour à la date prévue sont confirmées par écrit avant la signature\. Tout changement de lieu/);
    assert.ok(article11(text).includes("Pour cette réservation, le Locataire rapporte la remorque aux bureaux du Locateur à la date convenue à l’article 2."));
    assert.ok(!article11(text).includes("récupération est retardée par le Locateur"), "no collection by the Locateur, so no clause on its delay");
  });

  it("says that the Locateur delivers and collects, on which days and where", () => {
    const text = textOf({ ...delivered, deliveryOption: "delivery" });
    assert.match(text, /Lieu d’utilisation \| 777 rue Villeray, Montréal\./);
    assert.match(text, /Transport convenu \| Livraison par ICEBOX le 5 mars 2029\.\n \| Récupération par ICEBOX le 8 mars 2029\./);
    assert.match(text, /Les heures et la disponibilité du service de récupération à la date prévue sont confirmées par écrit avant la signature\./);
    assert.ok(article11(text).includes("Pour cette réservation, le Locateur récupère la remorque au lieu et à la date convenus à l’article 2."));
    assert.ok(article11(text).includes("la récupération est retardée par le Locateur"));
  });

  it("splits the amount into rental and transport, with the same total and taxes", () => {
    const text = textOf({ ...delivered, deliveryOption: "delivery" });
    assert.match(text, /Location • forfait de 3 jours \| 310,00 \$/);
    assert.match(text, /Transport • livraison et récupération \| 90,00 \$/);
    assert.match(text, /Sous-total \| 400,00 \$/);
    assert.match(text, /Total à payer • CAD \| 459,90 \$/);
  });

  it("describes a delivery one way and a collection one way", () => {
    const out = textOf({ ...delivered, deliveryOption: "delivery_only" });
    assert.match(out, /Transport convenu \| Livraison par ICEBOX le 5 mars 2029\.\n \| Retour aux bureaux du Locateur le 8 mars 2029\./);
    assert.match(out, /Transport • livraison seulement \| 90,00 \$/);
    assert.ok(article11(out).includes("le Locataire rapporte la remorque aux bureaux du Locateur"));

    const back = textOf({ ...delivered, deliveryOption: "return_only" });
    assert.match(back, /Transport convenu \| Prise en charge aux bureaux du Locateur le 5 mars 2029\.\n \| Récupération par ICEBOX le 8 mars 2029\./);
    assert.match(back, /Transport • récupération seulement \| 90,00 \$/);
    assert.ok(article11(back).includes("le Locateur récupère la remorque au lieu et à la date convenus"));
  });

  it("shows a free transport as zero, and never a negative rental", () => {
    assert.match(textOf({ ...delivered, deliveryOption: "delivery", deliveryFeeCents: 0 }), /Transport • livraison et récupération \| 0,00 \$/);
    const tooMuch = textOf({ ...delivered, deliveryOption: "delivery", deliveryFeeCents: 99999 });
    assert.match(tooMuch, /Location • forfait de 3 jours \| 0,00 \$/);
    assert.match(tooMuch, /Transport • livraison et récupération \| 400,00 \$/);
    assert.match(textOf({ ...delivered, deliveryOption: "delivery", deliveryFeeCents: -500 }), /Location • forfait de 3 jours \| 400,00 \$/);
  });
});

describe("contract of a stored booking", () => {
  it("takes everything from the booking, the transport included", () => {
    const params = contractParamsFor({
      client: {
        firstName: "Marie",
        lastName: "Tremblay",
        company: "Les Délices de Marie inc.",
        email: "marie@example.com",
        phone: "418-555-0100",
        billingAddress: "10, rue Principale",
        billingCity: "Lévis",
        billingProvince: "Québec",
        billingPostalCode: "G6V 1A1",
      },
      trailer: { size: "6x12" },
      pickupDate: new Date("2026-11-11T00:00:00Z"),
      returnDate: new Date("2026-12-26T00:00:00Z"),
      totalAmount: 195000,
      usageLocation: "777 rue Villeray, Montréal",
      deliveryOption: "delivery",
      deliveryFeeCents: 49000,
    });
    assert.deepEqual(params, {
      firstName: "Marie",
      lastName: "Tremblay",
      company: "Les Délices de Marie inc.",
      email: "marie@example.com",
      phone: "418-555-0100",
      billingAddress: "10, rue Principale",
      billingCity: "Lévis",
      billingProvince: "Québec",
      billingPostalCode: "G6V 1A1",
      trailerSize: "6x12",
      start: "2026-11-11",
      end: "2026-12-26",
      totalCents: 195000,
      usageLocation: "777 rue Villeray, Montréal",
      deliveryOption: "delivery",
      deliveryFeeCents: 49000,
    });
    const text = contractPlainLines(buildContractLines(params)).join("\n").replace(/\u00a0/g, " ");
    assert.match(text, /Location • forfait de 45 jours \| 1 460,00 \$/);
    assert.match(text, /Transport • livraison et récupération \| 490,00 \$/);
    assert.match(text, /Sous-total \| 1 950,00 \$/);
  });
});

describe("contract tax numbers", () => {
  it("are in the right format (a typo here would end up on every contract)", () => {
    assert.match(TAX_NUMBERS.gst ?? "", /^\d{9} RT0001$/);
    assert.match(TAX_NUMBERS.qst ?? "", /^\d{10} TQ0001$/);
  });

  it("give the Locateur's GST and QST numbers under the amounts, before the payment terms", () => {
    const text = textOf();
    assert.ok(text.includes("TPS : 745767772 RT0001 • TVQ : 1234246654 TQ0001"));
    assert.ok(text.indexOf("Total à payer • CAD") < text.indexOf("TPS : 745767772"));
    assert.ok(text.indexOf("TPS : 745767772") < text.indexOf("# 5. Modalités et échéance de paiement"));
  });

  it("leave off a number that is not known", () => {
    const withoutQst = textOf({ taxNumbers: { gst: "745767772 RT0001", qst: null } });
    assert.ok(withoutQst.includes("TPS : 745767772 RT0001\n"));
    assert.ok(!withoutQst.includes("TVQ :"));
    const withoutGst = textOf({ taxNumbers: { gst: null, qst: "1234246654 TQ0001" } });
    assert.ok(!withoutGst.includes("TPS :"));
    assert.ok(withoutGst.includes("TVQ : 1234246654 TQ0001"));
  });

  it("print nothing when no number is known", () => {
    const text = textOf({ taxNumbers: { gst: null, qst: null } });
    assert.ok(!text.includes("TPS :"));
    assert.ok(!text.includes("TVQ :"));
    assert.ok(!buildContractLines({ ...base, taxNumbers: { gst: null, qst: null } }).some((line) => line.type === "note"));
  });
});

describe("contract late-payment clause", () => {
  it("is article 6, between the payment terms and the deposit", () => {
    const text = textOf();
    assert.ok(text.indexOf("# 5. Modalités") < text.indexOf("# 6. Retards de paiement"));
    assert.ok(text.indexOf("# 6. Retards de paiement") < text.indexOf("# 7. Dépôt de garantie"));
  });

  it("states the rate, how it compounds, the absence of fixed fees and the consumer-law reservation", () => {
    const text = textOf({}, true);
    assert.match(text, /porte intérêt au taux de \*\*2 % par mois, capitalisé mensuellement\*\*/);
    assert.match(text, /taux nominal annuel de \*\*24 %\*\* et un taux annuel effectif d’environ \*\*26,82 %\*\*/);
    assert.match(text, /du lendemain de l’échéance jusqu’au paiement intégral/);
    assert.match(text, /prorata des jours de la période mensuelle concernée/);
    assert.match(text, /Aucuns frais fixes ni pénalités forfaitaires/);
    assert.match(text, /notamment en vertu de la Loi sur la protection du consommateur/);
  });

  it("quotes an effective annual rate that is what 2 % a month compounded monthly comes to", () => {
    const effective = (1.02 ** 12 - 1) * 100;
    assert.equal(effective.toFixed(2).replace(".", ","), "26,82");
  });

  it("is the same whatever the transport", () => {
    const article = (text: string) => text.slice(text.indexOf("# 6. Retards"), text.indexOf("# 7."));
    assert.equal(article(textOf({ deliveryOption: "delivery", deliveryFeeCents: 9000 })), article(textOf()));
  });
});

describe("contract payment, insurance and handover wording", () => {
  const text = textOf({}, true);

  it("asks for the full payment before a delivery and at the handover for a pickup, by card for a distance contract", () => {
    assert.ok(text.includes("**Livraison par le Locateur :** le paiement intégral doit être reçu et confirmé avant le départ de la remorque"));
    assert.ok(text.includes("**Prise en charge aux bureaux du Locateur :** le paiement intégral est exigible lors de la remise de la remorque"));
    assert.ok(text.includes("tout paiement perçu avant livraison est effectué par carte de crédit, sauf exception permise par la loi"));
    assert.ok(text.includes("payable dans les **quinze (15) jours suivant sa réception**"));
  });

  it("makes the deposit a hold that is not drawn automatically when it expires, released within two working days", () => {
    assert.ok(text.includes("sans prélèvement automatique du dépôt pour la seule raison que la retenue expire"));
    assert.ok(text.includes("**L’usure normale et les dommages préexistants sont exclus.**"));
    assert.ok(text.includes("dans les **deux (2) jours ouvrables** suivant la reprise effective de la remorque"));
    assert.ok(text.includes("Le dépôt ne constitue pas une indemnité forfaitaire."));
  });

  it("asks for two million in liability and treats the F.A.Q. no. 27 as usable if the insurer confirms it", () => {
    assert.ok(text.includes("**Responsabilité civile :** une limite minimale de 2 000 000 $ est requise"));
    assert.ok(text.includes("Le F.A.Q. nº 27 peut être utilisé si l’assureur confirme son applicabilité"));
  });

  it("limits the power cord to 50 feet on the handover sheet and in its own paragraph", () => {
    assert.ok(text.includes("Rallonge autorisée : **50 pi (15,24 m) maximum**."));
    assert.ok(text.includes("La longueur totale de rallonge ne doit pas dépasser **50 pi (15,24 m)**."));
  });

  it("has two parties sign, the Locataire's column being the one the signature goes in", () => {
    const signatures = buildContractLines(base).find((line) => line.type === "signatures");
    assert.ok(signatures && signatures.type === "signatures");
    assert.deepEqual(
      signatures.parties.map((party) => [party.title, party.signer ?? false, party.fields.map((field) => field.label)]),
      [
        ["Pour ICEBOX Inc.", false, ["Nom", "Signature", "Date"]],
        ["Pour le Locataire", true, ["Nom / qualité", "Signature", "Date"]],
      ],
    );
  });
});
