import { afterEach, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { PDFDict, PDFDocument, PDFName } from "pdf-lib";
import { buildContractLines } from "@/lib/providers/signature/contract-text";
import { quebecTimeOfDay, renderContractDocument, renderContractPdf } from "@/lib/providers/signature/contract-pdf";
import { loadContractFonts } from "@/lib/providers/signature/contract-fonts";
import { buildRentalReportPdf } from "@/lib/reports/rental-report-pdf";
import { readPdfPages } from "@/test-support/pdf-text";

// A 1 x 1 transparent PNG: enough to be a valid image for the PDF.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

const contract = {
  firstName: "Marie",
  lastName: "Tremblay",
  company: null,
  email: "marie@example.com",
  phone: "418-555-0100",
  trailerSize: "5x10" as const,
  start: "2029-03-05",
  end: "2029-03-08",
  totalCents: 40000,
  usageLocation: "123 rue Test, Lévis",
};

const stamp = (overrides: Partial<{ signerName: string; method: "drawn" | "typed"; signedAt: Date }> = {}) => ({
  imageBuffer: PNG,
  signerName: "Marie Tremblay",
  signedAt: new Date("2026-10-22T01:30:00Z"),
  method: "drawn" as const,
  ...overrides,
});

// Pictures drawn in a PDF, each counted once however many pages show it (the logo is on every page).
async function imageCount(bytes: Uint8Array): Promise<number> {
  const pdf = await PDFDocument.load(bytes);
  const images = new Set<string>();
  for (const page of pdf.getPages()) {
    const xobjects = page.node.Resources()?.lookupMaybe(PDFName.of("XObject"), PDFDict);
    for (const [, ref] of xobjects?.entries() ?? []) images.add(ref.toString());
  }
  return images.size;
}

afterEach(() => {
  mock.timers.reset();
  mock.restoreAll();
});

describe("contract PDF", () => {
  it("is a real contract of five pages, signed or not, with its header and footer on each", async () => {
    const lines = buildContractLines(contract);
    for (const bytes of [await renderContractPdf(lines), await renderContractPdf(lines, { signature: stamp() })]) {
      const pages = await readPdfPages(bytes);
      assert.equal(pages.length, 5);
      pages.forEach((text, i) => {
        assert.ok(text.includes("CONTRAT DE LOCATION"), `page ${i + 1} header`);
        assert.ok(text.includes("Remorques Réfrigérées ICEBOX Inc."), `page ${i + 1} header`);
        assert.ok(text.includes("Marie Tremblay • 5 mars au 8 mars 2029"), `page ${i + 1} footer`);
        assert.ok(text.endsWith(`${i + 1} / 5`), `page ${i + 1} number`);
      });
      assert.ok(pages[0].includes("CONTRAT DE LOCATION • VERSION RÉVISÉE DU 27 OCTOBRE 2026 Remorque réfrigérée"));
      assert.ok(!/prototype|contrai?gnant/i.test(pages.join("\n")), "no prototype wording anywhere in the contract");
    }
  });

  it("puts each part of the contract on its own page", async () => {
    const pages = await readPdfPages(await renderContractPdf(buildContractLines(contract)));
    const onPage = (page: number, ...phrases: string[]) => phrases.forEach((phrase) => assert.ok(pages[page].includes(phrase), `page ${page + 1}: ${phrase}`));
    onPage(0, "1. Parties au contrat", "2. Réservation et lieu d’utilisation", "3. Équipement loué");
    onPage(1, "CONDITIONS FINANCIÈRES", "Prix et paiement", "4. Prix convenu pour cette réservation", "5. Modalités et échéance de paiement", "6. Retards de paiement");
    onPage(2, "Dépôt et responsabilités", "7. Dépôt de garantie de 1 000 $ CAD", "8. Utilisation et surveillance", "9. Panne ou incident");
    onPage(3, "Assurance et retour", "10. Assurances adaptées à la réservation", "11. Restitution et inspection", "12. Prolongation, annulation et retour anticipé", "13. Entente et acceptation");
    onPage(4, "Fiche de remise et signatures", "Identification et caractéristiques à confirmer", "Équipements, état et documents remis", "Signatures", "Pour ICEBOX Inc.", "Pour le Locataire");
  });

  it("draws the price table with the tax numbers under it", async () => {
    const text = (await readPdfPages(await renderContractPdf(buildContractLines(contract))))[1];
    for (const phrase of ["Location • forfait de 3 jours", "400,00 $", "Sous-total", "TPS • 5 %", "20,00 $", "TVQ • 9,975 %", "39,90 $", "Total à payer • CAD", "459,90 $"]) {
      assert.ok(text.includes(phrase), phrase);
    }
    assert.ok(text.indexOf("459,90 $") < text.indexOf("TPS : 745767772 RT0001 • TVQ : 1234246654 TQ0001"));
    assert.ok(text.indexOf("TPS : 745767772") < text.indexOf("5. Modalités"));
  });

  it("leaves room to sign by hand, with a line for each party's name, signature and date", async () => {
    const page = (await readPdfPages(await renderContractPdf(buildContractLines(contract))))[4];
    assert.ok(page.includes("Nom : ______________________"));
    assert.ok(page.includes("Nom / qualité : ____________________"));
    assert.equal(page.match(/Signature : _+/g)?.length, 2);
    assert.equal(page.match(/Date : _+/g)?.length, 2);
  });

  it("carries the signature, the signer and the time once it is signed, whichever way the client signed", async () => {
    const lines = buildContractLines(contract);
    const unsigned = await renderContractPdf(lines);
    assert.equal(await imageCount(unsigned), 1, "only the logo");
    for (const method of ["drawn", "typed"] as const) {
      const signed = await renderContractPdf(lines, { signature: stamp({ method }) });
      assert.equal(await imageCount(signed), 2, method);
      assert.ok(signed.length > unsigned.length, method);
      const page = (await readPdfPages(signed))[4];
      assert.ok(page.includes("Pour le Locataire • signé électroniquement"), method);
      assert.ok(page.includes("Nom / qualité : Marie Tremblay"), method);
      assert.ok(page.includes(`Signature (${method === "typed" ? "nom tapé" : "dessinée"}) :`), method);
      assert.ok(page.includes("Date : 21 octobre 2026 à 21 h 30 (heure du Québec)"), method);
      assert.ok(page.includes("Nom : ______________________"), "the Locateur's column stays to be filled in");
    }
  });

  it("is laid out the same signed and unsigned, so the page count it states stays true", async () => {
    const variants = [
      contract,
      { ...contract, trailerSize: "6x12" as const, deliveryOption: "delivery" as const, deliveryFeeCents: 9000, usageLocation: "777 rue Villeray, Montréal" },
      { ...contract, company: "Les Entreprises de Réfrigération et de Distribution Alimentaire du Grand Montréal inc.", billingAddress: "1 rue Très Longue", billingCity: "Montréal", billingProvince: "Québec", billingPostalCode: "H2R 2N8" },
    ];
    for (const variant of variants) {
      const lines = buildContractLines(variant);
      const unsigned = await renderContractDocument(lines);
      const signed = await renderContractDocument(lines, { signature: stamp() });
      assert.equal(unsigned.pageCount, 5);
      assert.equal(signed.pageCount, 5);
      const pages = await readPdfPages(signed.bytes);
      assert.ok(pages[4].includes("Signatures") && pages[4].includes("Pour le Locataire"), "the signatures are on the last page");
    }
  });

  it("is the same file every time for the same contract", async () => {
    mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-10-27T16:00:00Z") });
    const lines = buildContractLines(contract);
    assert.deepEqual(await renderContractPdf(lines), await renderContractPdf(lines));
    assert.deepEqual(await renderContractPdf(lines, { signature: stamp() }), await renderContractPdf(lines, { signature: stamp() }));
  });

  it("draws the names and addresses the fonts have, and makes the rest plain instead of failing", async () => {
    const lines = buildContractLines({
      ...contract,
      firstName: "Nguyễn",
      lastName: "Łukasz 李",
      company: "Игорь inc.",
      billingAddress: "10 rue Saint‑Joseph\n2e étage",
      usageLocation: "Chemin des Érables → lot 12 (arrière)",
    });
    const unsigned = await renderContractDocument(lines);
    assert.equal(unsigned.pageCount, 5);
    const text = (await readPdfPages(unsigned.bytes)).join("\n");
    assert.ok(text.includes("Игорь inc. / Nguyễn Łukasz ?"), "letters the fonts have are kept, a character they lack becomes a question mark");
    assert.ok(text.includes("10 rue Saint‑Joseph 2e étage"), "a line break is a space");
    const signed = await renderContractPdf(lines, { signature: stamp({ signerName: "Nguyễn Łukasz 李 Игорь", method: "typed" }) });
    assert.equal(await imageCount(signed), 2);
  });

  it("copes with a very long signer name by wrapping it", async () => {
    const name = "Jean-Baptiste ".repeat(9).trim();
    const signed = await renderContractPdf(buildContractLines(contract), { signature: stamp({ signerName: name }) });
    assert.equal(await imageCount(signed), 2);
    const text = (await readPdfPages(signed)).join(" ");
    assert.equal(text.match(/Jean-Baptiste/g)?.length, 9, "the whole name is there");
  });

  it("goes on to another page, header and footer included, when what it holds is too long for one", async () => {
    const lines = buildContractLines({ ...contract, usageLocation: "Chemin des Érables, lot 12 ".repeat(60) });
    const { bytes, pageCount } = await renderContractDocument(lines);
    assert.ok(pageCount > 5);
    const pages = await readPdfPages(bytes);
    pages.forEach((text, i) => {
      assert.ok(text.includes("Remorques Réfrigérées ICEBOX Inc."), `page ${i + 1} header`);
      assert.ok(text.endsWith(`${i + 1} / ${pageCount}`), `page ${i + 1} number`);
    });
    assert.ok(pages.join(" ").includes("Signatures"));
    assert.ok(pages.at(-1)?.includes("Pour le Locataire"), "the signatures are on the last page");
    // The text says how many pages there are once the layout is known to need that many.
    const again = await renderContractDocument(buildContractLines({ ...contract, usageLocation: "Chemin des Érables, lot 12 ".repeat(60), pageCount }));
    assert.equal(again.pageCount, pageCount);
    assert.ok((await readPdfPages(again.bytes)).join(" ").includes(`acceptent les ${pageCount === 6 ? "six" : pageCount} pages`));
  });
});

describe("contract fonts", () => {
  it("are DejaVu Sans and Bungee, which can draw the check box, the minus sign and the accents of the contract", async () => {
    const fonts = await loadContractFonts(await PDFDocument.create());
    assert.equal(fonts.custom, true);
    const text = "☐ −18 °C × 12 œuvre É é à ç n° nº ’ •";
    assert.equal(fonts.clean(text), text);
    assert.equal(fonts.clean("a\u00a0b\tc\nd"), "a\u00a0b c d", "only the no-break space survives among the spaces");
    assert.equal(fonts.clean("李"), "?", "a character the fonts lack");
    assert.equal(fonts.clean("Nguyễn Игорь"), "Nguyễn Игорь");
  });

  it("are replaced by the built-in fonts, with the contract still made, when the files cannot be read", async () => {
    mock.method(console, "error", () => {});
    const doc = await PDFDocument.create();
    const fonts = await loadContractFonts(doc, "/nowhere/to/be/found");
    assert.equal(fonts.custom, false);
    assert.equal(fonts.clean("☐ −18 °C Nguyễn 😀"), "[ ] -18 °C Nguyen ?");
    assert.equal(fonts.display, fonts.bold);

    const lines = buildContractLines(contract);
    const { bytes, pageCount } = await renderContractDocument(lines, { fontDir: "/nowhere/to/be/found" });
    assert.ok(pageCount >= 5);
    const text = (await readPdfPages(bytes)).join(" ");
    assert.ok(text.includes("REMORQUE RÉFRIGÉRÉE"), "titles are in capitals with the stand-in font");
    assert.ok(text.includes("Statut : [ ] Particulier"));
  });
});

describe("time of day on the signature", () => {
  it("is the time in Québec, written like the contract writes the date", () => {
    assert.equal(quebecTimeOfDay(new Date("2026-10-22T01:30:00Z")), "21 h 30");
    assert.equal(quebecTimeOfDay(new Date("2026-12-01T14:05:00Z")), "9 h 05");
    assert.equal(quebecTimeOfDay(new Date("2026-10-21T04:00:00Z")), "0 h 00");
  });
});

describe("rental report PDF", () => {
  it("does not fail on a client name the PDF font cannot draw", async () => {
    const bytes = await buildRentalReportPdf({
      periodLabel: "Mars 2029",
      reservations: [
        {
          id: "r1",
          clientName: "Nguyễn Văn Łukasz 😀",
          trailerLabel: "Remorque 1",
          pickupDate: new Date("2029-03-05T00:00:00Z"),
          returnDate: new Date("2029-03-08T00:00:00Z"),
          status: "Confirmée",
          totalAmount: 40000,
        },
      ],
    });
    assert.ok((await PDFDocument.load(bytes)).getPageCount() >= 1);
  });
});
