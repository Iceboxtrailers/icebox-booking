import { afterEach, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { DEPOSIT_AMOUNT_CENTS, TRAILER_SIZE } from "@/lib/constants";
import { addDays } from "@/lib/dates";
import { computeTaxBreakdown, computeTotalCents } from "@/lib/pricing";
import { TAX_NUMBERS, buildContractLines, buildContractText, contractParamsFor } from "@/lib/providers/signature/contract-text";

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

describe("contract with transport", () => {
  const delivered = { usageLocation: "777 rue Villeray, Montréal", totalCents: 40000, deliveryFeeCents: 9000 };

  it("is word for word the same when the client comes to the depot", () => {
    assert.equal(textOf({ deliveryOption: "pickup", deliveryFeeCents: 9000 }), textOf());
    assert.equal(textOf({ deliveryOption: undefined, deliveryFeeCents: undefined }), textOf());
  });

  it("says that the Locateur delivers and collects, on which days and where", () => {
    const text = textOf({ ...delivered, deliveryOption: "delivery" });
    assert.match(text, /777 rue Villeray, Montréal/);
    assert.match(text, /Livraison : le Locateur livre la remorque à cette adresse le 5 mars 2029\./);
    assert.match(text, /Récupération : le Locateur reprend la remorque à cette adresse le 8 mars 2029\./);
    assert.match(text, /le Locateur récupère la remorque à l'adresse indiquée à l'article 3/);
    assert.ok(!text.includes("Le Locataire s'engage à retourner la remorque à l'adresse du Locateur"));
  });

  it("splits the amount into rental and transport, with the same total and taxes", () => {
    const text = textOf({ ...delivered, deliveryOption: "delivery" });
    assert.match(text, /Location : 310\.00 \$ CAD/);
    assert.match(text, /Transport \(livraison et récupération\) : 90\.00 \$ CAD/);
    assert.match(text, /Sous-total : 400\.00 \$ CAD/);
    assert.match(text, /Total : 459\.90 \$ CAD/);
  });

  it("describes a delivery one way and a collection one way", () => {
    const out = textOf({ ...delivered, deliveryOption: "delivery_only" });
    assert.match(out, /Livraison : le Locateur livre la remorque à cette adresse le 5 mars 2029\./);
    assert.match(out, /Retour : le Locataire rapporte la remorque à l'adresse du Locateur le 8 mars 2029\./);
    assert.ok(!out.includes("Récupération : le Locateur reprend"));
    assert.match(out, /Transport \(livraison seulement\) : 90\.00 \$ CAD/);
    assert.match(out, /Le Locataire s'engage à retourner la remorque à l'adresse du Locateur\./);

    const back = textOf({ ...delivered, deliveryOption: "return_only" });
    assert.match(back, /Ramassage : le Locataire prend possession de la remorque à l'adresse du Locateur le 5 mars 2029\./);
    assert.match(back, /Récupération : le Locateur reprend la remorque à cette adresse le 8 mars 2029\./);
    assert.match(back, /Transport \(récupération seulement\) : 90\.00 \$ CAD/);
    assert.match(back, /le Locateur récupère la remorque à l'adresse indiquée à l'article 3/);
  });

  it("shows a free transport as zero, and never a negative rental", () => {
    assert.match(textOf({ ...delivered, deliveryOption: "delivery", deliveryFeeCents: 0 }), /Transport \(livraison et récupération\) : 0\.00 \$ CAD/);
    const tooMuch = textOf({ ...delivered, deliveryOption: "delivery", deliveryFeeCents: 99999 });
    assert.match(tooMuch, /Location : 0\.00 \$ CAD/);
    assert.match(tooMuch, /Transport \(livraison et récupération\) : 400\.00 \$ CAD/);
    assert.match(textOf({ ...delivered, deliveryOption: "delivery", deliveryFeeCents: -500 }), /Location : 400\.00 \$ CAD/);
  });
});

describe("contract of a stored booking", () => {
  it("takes everything from the booking, the transport included", () => {
    const params = contractParamsFor({
      client: {
        firstName: "Riad",
        lastName: "Leroy",
        company: "L'artisan Délice sans gluten",
        email: "riad@example.com",
        phone: "514 575-8751",
        billingAddress: "7700 rue St-Hubert",
        billingCity: "Montréal",
        billingProvince: "Québec",
        billingPostalCode: "H2R 2N8",
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
      firstName: "Riad",
      lastName: "Leroy",
      company: "L'artisan Délice sans gluten",
      email: "riad@example.com",
      phone: "514 575-8751",
      billingAddress: "7700 rue St-Hubert",
      billingCity: "Montréal",
      billingProvince: "Québec",
      billingPostalCode: "H2R 2N8",
      trailerSize: "6x12",
      start: "2026-11-11",
      end: "2026-12-26",
      totalCents: 195000,
      usageLocation: "777 rue Villeray, Montréal",
      deliveryOption: "delivery",
      deliveryFeeCents: 49000,
    });
    const text = buildContractLines(params)
      .flatMap((line) => ("text" in line ? [line.text] : []))
      .join("\n");
    assert.match(text, /Location : 1460\.00 \$ CAD/);
    assert.match(text, /Transport \(livraison et récupération\) : 490\.00 \$ CAD/);
  });
});

describe("contract tax numbers", () => {
  it("are in the right format (a typo here would end up on every contract)", () => {
    assert.match(TAX_NUMBERS.gst ?? "", /^\d{9} RT0001$/);
    assert.match(TAX_NUMBERS.qst ?? "", /^\d{10} TQ0001$/);
  });

  it("give the Locateur's GST and QST numbers under the amounts, before the payment terms", () => {
    const text = textOf();
    assert.match(text, /Numéro de TPS du Locateur : 745767772 RT0001/);
    assert.match(text, /Numéro de TVQ du Locateur : 1234246654 TQ0001/);
    assert.ok(text.indexOf("Total : 459.90 $ CAD") < text.indexOf("Numéro de TPS du Locateur"));
    assert.ok(text.indexOf("Numéro de TPS du Locateur") < text.indexOf("Numéro de TVQ du Locateur"));
    assert.ok(text.indexOf("Numéro de TVQ du Locateur") < text.indexOf("Le paiement total est exigible"));
  });

  it("leave off a number that is not known", () => {
    const withoutQst = textOf({ taxNumbers: { gst: "745767772 RT0001", qst: null } });
    assert.match(withoutQst, /Numéro de TPS du Locateur : 745767772 RT0001/);
    assert.ok(!withoutQst.includes("Numéro de TVQ"));
    const withoutGst = textOf({ taxNumbers: { gst: null, qst: "1234246654 TQ0001" } });
    assert.ok(!withoutGst.includes("Numéro de TPS"));
    assert.match(withoutGst, /Numéro de TVQ du Locateur : 1234246654 TQ0001/);
  });

  it("print nothing when no number is known", () => {
    const text = textOf({ taxNumbers: { gst: null, qst: null } });
    assert.ok(!text.includes("Numéro de TPS"));
    assert.ok(!text.includes("Numéro de TVQ"));
  });
});

describe("contract late-payment clause", () => {
  const lines = (overrides: Partial<Input> = {}) => buildContractLines({ ...base, ...overrides });
  const index = (all: ReturnType<typeof lines>, start: string) => all.findIndex((line) => "text" in line && line.text.startsWith(start));

  it("sits in article 4, after the payment term and before the deposit article", () => {
    const all = lines();
    const article4 = index(all, "4. Conditions Financières");
    const payment = index(all, "Le paiement total est exigible");
    const clause = index(all, "Retards de paiement");
    const article5 = index(all, "5. Dépôt de garantie");
    assert.ok(article4 < payment && payment < clause && clause < article5);
    assert.equal(all[clause].type, "subheading");
  });

  it("states the rate, how it compounds, the absence of fixed fees and the consumer-law reservation", () => {
    const text = textOf();
    assert.match(text, /porte intérêt au taux de 2 % par mois, capitalisé mensuellement/);
    assert.match(text, /taux nominal annuel de 24 % et un taux annuel effectif d’environ 26,82 %/);
    assert.match(text, /à compter du lendemain de l’échéance et jusqu’au paiement intégral/);
    assert.match(text, /prorata du nombre de jours de la période mensuelle concernée/);
    assert.match(text, /Aucuns frais fixes ni pénalités forfaitaires/);
    assert.match(text, /sous réserve des dispositions impératives des lois applicables, notamment celles de la Loi sur la protection du consommateur/);
  });

  it("quotes an effective annual rate that is what 2 % a month compounded monthly comes to", () => {
    const effective = (1.02 ** 12 - 1) * 100;
    assert.equal(effective.toFixed(2).replace(".", ","), "26,82");
  });

  it("is the same whatever the transport, and does not move the numbering of the articles", () => {
    const clauseOf = (all: ReturnType<typeof lines>) =>
      all.slice(index(all, "Retards de paiement"), index(all, "5. Dépôt de garantie")).map((line) => JSON.stringify(line));
    assert.deepEqual(clauseOf(lines({ deliveryOption: "delivery", deliveryFeeCents: 9000 })), clauseOf(lines()));
    const headings = lines()
      .flatMap((line) => (line.type === "heading" ? [line.text] : []))
      .map((text) => text.split(".")[0]);
    assert.deepEqual(headings.slice(0, 9), ["1", "2", "3", "4", "5", "6", "7", "8", "9"]);
  });
});

describe("contract long-stay rate", () => {
  const lines = (overrides: Partial<Input> = {}) => buildContractLines({ ...base, ...overrides });
  const index = (all: ReturnType<typeof lines>, start: string) => all.findIndex((line) => "text" in line && line.text.startsWith(start));

  it("gives the week and the day after the first month, for each size", () => {
    const small = textOf({ trailerSize: "5x10" });
    assert.match(small, /Location continue d'un mois ou plus : les mois complets de 30 jours sont facturés au tarif mensuel/);
    assert.match(small, /à 1\/28 du tarif mensuel par jour, soit 225\.00 \$ \+Tx CAD par semaine ou environ 32\.14 \$ \+Tx CAD par jour/);
    assert.match(textOf({ trailerSize: "6x12" }), /soit 325\.00 \$ \+Tx CAD par semaine ou environ 46\.43 \$ \+Tx CAD par jour/);
  });

  it("says it never goes beyond one more month, and that it is for one continuous rental", () => {
    const text = textOf();
    assert.match(text, /sans jamais dépasser le tarif d'un mois de plus/);
    assert.match(text, /Ce tarif s'applique à une seule location continue : des locations distinctes ne sont pas additionnées\./);
  });

  it("sits with the rates: after the monthly rate, before the transport rate and the amount of the booking", () => {
    const all = lines();
    const month = index(all, "900.00 $ +Tx CAD par mois");
    const longStay = index(all, "Location continue d'un mois ou plus");
    const continuous = index(all, "Ce tarif s'applique à une seule location continue");
    const transport = index(all, "60.00 $ / transport");
    const amount = index(all, "Montant pour cette réservation");
    assert.ok(month >= 0 && month < longStay && longStay < continuous && continuous < transport && transport < amount);
    assert.equal(all[longStay].type, "bullet");
    assert.equal(all[continuous].type, "bullet");
  });

  it("is the same whatever the transport", () => {
    const wording = (all: ReturnType<typeof lines>) =>
      all.slice(index(all, "Location continue d'un mois ou plus"), index(all, "Montant pour cette réservation")).map((line) => JSON.stringify(line));
    assert.deepEqual(wording(lines({ deliveryOption: "delivery", deliveryFeeCents: 9000 })), wording(lines()));
  });

  it("quotes what a booking is priced with: a week and a day after the first month", () => {
    for (const size of TRAILER_SIZE) {
      const price = (nightCount: number) => computeTotalCents(size, "2029-01-01", addDays("2029-01-01", nightCount));
      const text = textOf({ trailerSize: size });
      const week = /soit (\d+\.\d{2}) \$ \+Tx CAD par semaine/.exec(text)?.[1];
      const day = /environ (\d+\.\d{2}) \$ \+Tx CAD par jour/.exec(text)?.[1];
      assert.ok(week && day, size);
      assert.equal(Math.round(Number(week) * 100), price(37) - price(30), `${size}: a week`);
      assert.equal(Math.round(Number(day) * 100), price(31) - price(30), `${size}: a day`);
    }
  });
});
