import { afterEach, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { mail, makeBooking, makeTrailer, prisma, setupDatabase } from "./harness";
import { getConfirmationEmailProblem, sendConfirmationEmail } from "@/lib/reservations/confirmation-email";
import { confirmReservation } from "@/lib/reservations/confirm";
import { getStorage } from "@/lib/providers/storage";
import { UPLOADS_ROOT } from "@/lib/providers/storage/local";

setupDatabase();

const CONTRACT_SENTENCE = "Votre contrat signé est joint";
const CARD_SENTENCE = "Un dépôt de sécurité";

const stored: string[] = [];
afterEach(async () => {
  mock.restoreAll();
  for (const path of stored.splice(0)) await rm(join(UPLOADS_ROOT, path), { force: true });
});

// A signed contract PDF in storage, as the signing step leaves it.
async function storeContract(): Promise<string> {
  const path = `contracts/database-test-${Date.now()}-${stored.length}.pdf`;
  stored.push(path);
  const { url } = await getStorage().save(path, Buffer.from("%PDF-1.4 test contract"), "application/pdf");
  return url;
}

const confirmedBooking = async (options: Parameters<typeof makeBooking>[0] = {}) =>
  makeBooking({ trailer: await makeTrailer(), start: "2099-03-10", end: "2099-03-13", status: "confirmed", ...options });

const auditRows = (reservationId: string) => prisma.auditLog.findMany({ where: { reservationId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });

describe("the confirmation e-mail", () => {
  it("goes to the client, and an automatic send leaves nothing in the journal", async () => {
    const booking = await confirmedBooking();

    const result = await sendConfirmationEmail(booking.id);

    assert.deepEqual(result, { ok: true, to: booking.client.email, attached: false });
    assert.equal(mail.to(booking.client.email).length, 1);
    assert.equal((await auditRows(booking.id)).length, 0);
  });

  it("carries the signed contract when there is one", async () => {
    const booking = await confirmedBooking({ pdfUrl: await storeContract() });

    const result = await sendConfirmationEmail(booking.id);

    assert.equal(result.ok && result.attached, true);
    const [sent] = mail.to(booking.client.email);
    assert.deepEqual(sent.attachments.map((a) => a.filename), ["Contrat-de-location-IceBox.pdf"]);
    assert.ok(sent.html.includes(CONTRACT_SENTENCE));
  });

  it("does not claim a contract it did not attach", async () => {
    const withoutPdf = await confirmedBooking();
    const unsigned = await confirmedBooking({ signed: false });
    await prisma.contract.create({ data: { reservationId: unsigned.id, signatureStatus: "pending", pdfUrl: await storeContract() } });
    mock.method(console, "error", () => {});
    const missingFile = await confirmedBooking({ pdfUrl: "/api/files/contracts/database-test-not-there.pdf" });

    for (const booking of [withoutPdf, unsigned, missingFile]) {
      const result = await sendConfirmationEmail(booking.id);
      assert.equal(result.ok && result.attached, false);
      const [sent] = mail.to(booking.client.email);
      assert.deepEqual(sent.attachments, []);
      assert.ok(!sent.html.includes(CONTRACT_SENTENCE));
    }
  });

  it("mentions the saved card only when there is one", async () => {
    const withCard = await confirmedBooking();
    const withoutCard = await confirmedBooking({ card: false });

    await sendConfirmationEmail(withCard.id);
    await sendConfirmationEmail(withoutCard.id);

    assert.ok(mail.to(withCard.client.email)[0].html.includes(CARD_SENTENCE));
    assert.ok(!mail.to(withoutCard.client.email)[0].html.includes(CARD_SENTENCE));
  });

  it("is not sent for a booking that is not confirmed, or that does not exist", async () => {
    const pending = await makeBooking({ trailer: await makeTrailer(), start: "2099-03-10", end: "2099-03-13" });

    const early = await sendConfirmationEmail(pending.id);
    const unknown = await sendConfirmationEmail("does-not-exist");

    assert.equal(early.ok === false && early.reason, "not_confirmed");
    assert.equal(unknown.ok === false && unknown.reason, "not_found");
    assert.equal(mail.attempts().length, 0);
  });

  describe("when the mail service refuses it", () => {
    it("writes the reason in the journal and reports it, instead of throwing", async () => {
      mock.method(console, "error", () => {});
      const booking = await confirmedBooking();
      mail.rejectWith(422, "The recipient address is not valid");

      const result = await sendConfirmationEmail(booking.id);

      assert.equal(result.ok, false);
      assert.equal(result.ok === false && result.reason, "send_failed");
      assert.match(result.ok === false ? result.message : "", /Resend 422: The recipient address is not valid/);
      const [row] = await auditRows(booking.id);
      assert.equal(row.action, "email_failed");
      assert.equal(row.actorType, "system");
      assert.deepEqual(row.details, { kind: "client_confirmation", message: "Resend 422: The recipient address is not valid" });
      assert.equal(await getConfirmationEmailProblem(booking.id), "Resend 422: The recipient address is not valid");
    });

    it("does not undo the booking when it is the confirmation that could not be sent", async () => {
      mock.method(console, "error", () => {});
      const booking = await makeBooking({ trailer: await makeTrailer(), start: "2099-03-10", end: "2099-03-13" });
      mail.rejectWith(500, "service unavailable");

      const confirmed = await confirmReservation(booking.id, booking.clientId);

      assert.equal(confirmed.status, "confirmed");
      assert.equal(await getConfirmationEmailProblem(booking.id), "Resend 500: service unavailable");
    });
  });

  describe("sent again by staff", () => {
    const staffId = "staff-1";

    it("is written in the journal with who sent it", async () => {
      const booking = await confirmedBooking({ pdfUrl: await storeContract() });

      const result = await sendConfirmationEmail(booking.id, { resentBy: staffId });

      assert.equal(result.ok, true);
      const [row] = await auditRows(booking.id);
      assert.equal(row.action, "email_resent");
      assert.equal(row.actorType, "admin");
      assert.equal(row.actorId, staffId);
      assert.deepEqual(row.details, { kind: "client_confirmation", to: booking.client.email, attached: true });
    });

    it("clears the problem once it works, and brings it back if it fails again", async () => {
      mock.method(console, "error", () => {});
      const booking = await confirmedBooking();
      assert.equal(await getConfirmationEmailProblem(booking.id), null);

      mail.rejectWith(500, "first outage");
      await sendConfirmationEmail(booking.id);
      assert.equal(await getConfirmationEmailProblem(booking.id), "Resend 500: first outage");

      mail.reset();
      await sendConfirmationEmail(booking.id, { resentBy: staffId });
      assert.equal(await getConfirmationEmailProblem(booking.id), null);

      mail.rejectWith(500, "second outage");
      const again = await sendConfirmationEmail(booking.id, { resentBy: staffId });
      assert.equal(again.ok, false);
      assert.equal(await getConfirmationEmailProblem(booking.id), "Resend 500: second outage");
      const last = (await auditRows(booking.id)).at(-1);
      assert.deepEqual(last?.details, { kind: "client_confirmation", message: "Resend 500: second outage", resend: true });
    });

    it("keeps one booking's problem away from another", async () => {
      mock.method(console, "error", () => {});
      const failing = await confirmedBooking();
      const fine = await confirmedBooking();
      mail.rejectWith(500, "outage");
      await sendConfirmationEmail(failing.id);

      assert.equal(await getConfirmationEmailProblem(failing.id), "Resend 500: outage");
      assert.equal(await getConfirmationEmailProblem(fine.id), null);
    });
  });
});
