import { afterEach, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { makeBooking, makeTrailer, prisma, setupDatabase } from "./harness";
import { loadContractLines } from "@/lib/providers/signature/stub";
import { renderContractPdf } from "@/lib/providers/signature/contract-pdf";
import { contractPlainLines } from "@/lib/providers/signature/contract-text";
import { getSignatureProvider } from "@/lib/providers/signature";
import { getStorage } from "@/lib/providers/storage";
import { UPLOADS_ROOT } from "@/lib/providers/storage/local";
import { refreshContractAfterTermsChange } from "@/lib/reservations/contract-refresh";

setupDatabase();

const stored: string[] = [];
afterEach(async () => {
  mock.timers.reset();
  mock.restoreAll();
  for (const path of stored.splice(0)) await rm(join(UPLOADS_ROOT, path), { force: true });
});

const textOf = (lines: Awaited<ReturnType<typeof loadContractLines>>) => contractPlainLines(lines).join("\n").replace(/\u00a0/g, " ");
const contractFile = (reservationId: string) => `contracts/${reservationId}.pdf`;

// The customer of the booking that prompted this: entered from the console, delivered to Montréal, 245 $ each way.
const montreal = { totalAmount: 195000, deliveryOption: "delivery", deliveryFeeCents: 49000, usageLocation: "777 rue Villeray, Montréal" };

describe("the contract of a stored booking", () => {
  it("carries the transport that was set on the booking", async () => {
    const booking = await makeBooking({
      trailer: await makeTrailer({ size: "6x12" }),
      start: "2099-11-11",
      end: "2099-12-26",
      signed: false,
      over: montreal,
    });

    const text = textOf(await loadContractLines(booking.id));

    assert.match(text, /Lieu d’utilisation \| 777 rue Villeray, Montréal\./);
    assert.match(text, /Transport convenu \| Livraison par ICEBOX le 11 novembre 2099\.\n \| Récupération par ICEBOX le 26 décembre 2099\./);
    assert.match(text, /Location • forfait de 45 jours \| 1 460,00 \$/);
    assert.match(text, /Transport • livraison et récupération \| 490,00 \$/);
    assert.match(text, /Sous-total \| 1 950,00 \$/);
  });

  it("is the plain contract when the trailer is picked up at the depot", async () => {
    const booking = await makeBooking({ trailer: await makeTrailer(), start: "2099-11-11", end: "2099-11-14", signed: false });

    const text = textOf(await loadContractLines(booking.id));

    assert.match(text, /À préciser/);
    assert.ok(!text.includes("Livraison par ICEBOX"));
    assert.ok(!text.includes("Transport •"));
    assert.match(text, /Transport convenu \| Prise en charge aux bureaux du Locateur le 11 novembre 2099\./);
    assert.match(text, /le Locataire rapporte la remorque aux bureaux du Locateur à la date convenue à l’article 2\./);
  });

  it("cannot be made before the booking has a trailer and dates", async () => {
    const booking = await makeBooking({ trailer: null, signed: false });
    await assert.rejects(loadContractLines(booking.id), /missing trailer or dates/);
  });
});

describe("keeping the contract in step with the booking", () => {
  async function bookingWithContract() {
    const booking = await makeBooking({ trailer: await makeTrailer({ size: "6x12" }), start: "2099-11-11", end: "2099-12-26", signed: false, over: { totalAmount: 195000 } });
    mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-10-26T16:00:00Z") });
    await getSignatureProvider().generateContract({ reservationId: booking.id });
    stored.push(contractFile(booking.id));
    return booking;
  }
  const fileOf = (reservationId: string) => getStorage().read(contractFile(reservationId));

  it("does nothing while no contract was made", async () => {
    const booking = await makeBooking({ trailer: await makeTrailer(), start: "2099-11-11", end: "2099-11-14", signed: false });
    assert.equal(await refreshContractAfterTermsChange(booking.id), "none");
    assert.equal(await prisma.contract.count(), 0);
  });

  it("makes an unsigned contract again, so it shows the new terms", async () => {
    const booking = await bookingWithContract();
    const before = await fileOf(booking.id);
    await prisma.reservation.update({ where: { id: booking.id }, data: montreal });

    const outcome = await refreshContractAfterTermsChange(booking.id);

    assert.equal(outcome, "regenerated");
    const after = await fileOf(booking.id);
    assert.notDeepEqual(after, before);
    // Exactly the contract of the booking as it stands now (the clock is frozen, so the file is reproducible).
    assert.deepEqual(after, Buffer.from(await renderContractPdf(await loadContractLines(booking.id))));
    const contract = await prisma.contract.findUniqueOrThrow({ where: { reservationId: booking.id } });
    assert.equal(contract.pdfUrl, `/api/files/${contractFile(booking.id)}`);
    assert.equal(contract.signatureStatus, "pending");
  });

  it("never touches a contract the client signed, and says it no longer matches", async () => {
    const booking = await bookingWithContract();
    const signedCopy = Buffer.from("%PDF-1.4 what the client signed");
    await getStorage().save(contractFile(booking.id), signedCopy, "application/pdf");
    await prisma.contract.update({ where: { reservationId: booking.id }, data: { signatureStatus: "signed", signedAt: new Date(), signerName: "Marie Tremblay" } });
    await prisma.reservation.update({ where: { id: booking.id }, data: montreal });

    const outcome = await refreshContractAfterTermsChange(booking.id);

    assert.equal(outcome, "signed_outdated");
    assert.deepEqual(await fileOf(booking.id), signedCopy);
    assert.equal((await prisma.contract.findUniqueOrThrow({ where: { reservationId: booking.id } })).signatureStatus, "signed");
  });

  it("drops the old file when the contract cannot be made again, so it is not sent by mistake", async () => {
    mock.method(console, "error", () => {});
    const booking = await makeBooking({ trailer: null, signed: false });
    await prisma.contract.create({ data: { reservationId: booking.id, pdfUrl: `/api/files/${contractFile(booking.id)}` } });

    const outcome = await refreshContractAfterTermsChange(booking.id);

    assert.equal(outcome, "cleared");
    assert.equal((await prisma.contract.findUniqueOrThrow({ where: { reservationId: booking.id } })).pdfUrl, null);
  });
});
