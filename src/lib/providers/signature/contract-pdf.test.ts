import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFRawStream, decodePDFRawStream } from "pdf-lib";
import type { PDFRef } from "pdf-lib";
import { buildContractLines } from "@/lib/providers/signature/contract-text";
import { quebecTimeOfDay, renderContractPdf } from "@/lib/providers/signature/contract-pdf";
import { buildRentalReportPdf } from "@/lib/reports/rental-report-pdf";

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

// Pictures drawn on the pages of a PDF (the logo, and the signature once signed).
async function imageCount(bytes: Uint8Array): Promise<number> {
  const pdf = await PDFDocument.load(bytes);
  let count = 0;
  for (const page of pdf.getPages()) {
    const images = page.node.Resources()?.lookupMaybe(PDFName.of("XObject"), PDFDict);
    count += images ? images.keys().length : 0;
  }
  return count;
}

// The lines of text drawn on each page. pdf-lib writes each line as a hex string shown with Tj in a (deflated)
// content stream.
async function pageTexts(bytes: Uint8Array): Promise<string[][]> {
  const pdf = await PDFDocument.load(bytes);
  return pdf.getPages().map((page) => {
    const contents = page.node.Contents();
    const refs = contents instanceof PDFArray ? Array.from({ length: contents.size() }, (_, i) => contents.get(i)) : [];
    const streams = (contents instanceof PDFArray ? refs.map((ref) => pdf.context.lookup(ref as PDFRef)) : [contents]).filter(
      (stream): stream is PDFRawStream => stream instanceof PDFRawStream,
    );
    return streams.flatMap((stream) => {
      const content = Buffer.from(decodePDFRawStream(stream).decode()).toString("latin1");
      return [...content.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)].map((match) => Buffer.from(match[1], "hex").toString("latin1"));
    });
  });
}

// Every line of text of the document, page after page.
const drawnText = async (bytes: Uint8Array): Promise<string[]> => (await pageTexts(bytes)).flat();

describe("contract PDF", () => {
  it("is a real contract: it starts with its title and carries no prototype label, signed or not", async () => {
    const lines = buildContractLines(contract);
    for (const bytes of [await renderContractPdf(lines), await renderContractPdf(lines, { signature: stamp() })]) {
      const text = await drawnText(bytes);
      assert.match(text[0], /^CONTRAT DE LOCATION/);
      assert.ok(text.some((line) => line.startsWith("Signatures")));
      assert.ok(!/prototype|contrai?gnant/i.test(text.join("\n")), "no prototype wording anywhere in the contract");
    }
  });

  it("prints the late-payment clause under the financial conditions", async () => {
    const text = (await drawnText(await renderContractPdf(buildContractLines(contract)))).join("\n");
    assert.ok(text.indexOf("Retards de paiement") > text.indexOf("Conditions Financi"));
    assert.ok(text.indexOf("Retards de paiement") < text.indexOf("D\xe9p\xf4t de garantie"));
    assert.match(text, /26,82/);
  });

  it("keeps the signatures together on one page, whatever the length of the contract", async () => {
    // The longer variants (with transport, a long company name) are the ones that used to push a name onto a page of its own.
    const long = buildContractLines({
      ...contract,
      company: "Les Entreprises de Réfrigération et de Distribution Alimentaire du Grand Montréal inc.",
      usageLocation: "777 rue Villeray, Montréal",
      deliveryOption: "delivery",
      deliveryFeeCents: 9000,
    });
    for (const lines of [long, buildContractLines(contract)]) {
      for (const signature of [undefined, stamp()]) {
        const pages = await pageTexts(await renderContractPdf(lines, signature ? { signature } : {}));
        const withHeading = pages.findIndex((page) => page.some((line) => line.startsWith("Signatures")));
        assert.ok(withHeading >= 0);
        assert.ok(pages[withHeading].some((line) => line.startsWith("Pour le Locataire")), "both parties on the page of the heading");
        assert.ok(pages[withHeading].length >= 6, "the whole section, not a lone line");
        assert.equal(withHeading, pages.length - 1, "the signatures are on the last page");
        if (signature) assert.ok(pages[withHeading].includes("Sign\xe9 \xe9lectroniquement"), "the signature block is with them");
      }
    }
  });

  it("is made from the contract lines, with the logo and no signature while unsigned", async () => {
    const bytes = await renderContractPdf(buildContractLines(contract));
    const pdf = await PDFDocument.load(bytes);
    assert.ok(pdf.getPageCount() >= 1);
    assert.equal(await imageCount(bytes), 1);
  });

  it("carries the signature once it is signed, whichever way the client signed", async () => {
    const lines = buildContractLines(contract);
    const unsigned = await renderContractPdf(lines);
    for (const method of ["drawn", "typed"] as const) {
      const signed = await renderContractPdf(lines, { signature: stamp({ method }) });
      assert.equal(await imageCount(signed), 2, method);
      assert.ok(signed.length > unsigned.length, method);
    }
  });

  it("does not fail on names and addresses the PDF font cannot draw", async () => {
    const lines = buildContractLines({
      ...contract,
      firstName: "Nguyễn",
      lastName: "Łukasz 😀",
      company: "Игорь inc.",
      billingAddress: "10 rue Saint‑Joseph\n2e étage",
      usageLocation: "Chemin des Érables → lot 12 (arrière)",
    });
    const unsigned = await renderContractPdf(lines);
    assert.ok((await PDFDocument.load(unsigned)).getPageCount() >= 1);
    const signed = await renderContractPdf(lines, { signature: stamp({ signerName: "Nguyễn Łukasz 😀 Игорь", method: "typed" }) });
    assert.equal(await imageCount(signed), 2);
  });

  it("copes with a very long signer name by wrapping it", async () => {
    const signed = await renderContractPdf(buildContractLines(contract), { signature: stamp({ signerName: "Jean-Baptiste ".repeat(9).trim() }) });
    assert.equal(await imageCount(signed), 2);
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
