import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Prisma } from "@/generated/prisma/client";
import { makeBooking, makeClient, makeTrailer, prisma, setupDatabase } from "./harness";
import { AUDIT_PAGE_SIZE, countRecentProblems, getAuditPage } from "@/lib/admin/audit";

setupDatabase();

const HOUR = 3_600_000;
const ago = (hours: number) => new Date(Date.now() - hours * HOUR);

type Row = { reservationId?: string | null; actorType?: string; actorId?: string | null; details?: Prisma.InputJsonValue; createdAt?: Date };
const entry = (action: string, over: Row = {}) => prisma.auditLog.create({ data: { action, actorType: "system", createdAt: ago(1), ...over } });

const titles = async (opts: Partial<Parameters<typeof getAuditPage>[0]> = {}) =>
  (await getAuditPage({ category: null, days: 30, ...opts })).entries.map((e) => e.title);

describe("the activity journal", () => {
  it("counts what went wrong in the last seven days, and nothing else", async () => {
    await entry("email_failed", { createdAt: ago(1) });
    await entry("deposit_payment_failed", { createdAt: ago(72) });
    await entry("quickbooks_sync_failed", { createdAt: ago(24 * 8) }); // too old
    await entry("contract_signed", { createdAt: ago(1) }); // not a problem
    await entry("some_future_action", { createdAt: ago(1) }); // not known to be one

    assert.equal(await countRecentProblems(), 2);
  });

  it("shows every entry once, newest first, over as many pages as it takes", async () => {
    // Groups of five entries share the same instant: the order within a group must still be stable, or a page
    // boundary falling inside one would repeat or skip entries.
    const base = Date.now() - 10 * HOUR;
    await prisma.auditLog.createMany({
      data: Array.from({ length: 95 }, (_, i) => ({ action: "card_saved", actorType: "client", createdAt: new Date(base + Math.floor(i / 5) * 1000) })),
    });
    const expected = (await prisma.auditLog.findMany({ orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { id: true } })).map((row) => row.id);

    const seen: string[] = [];
    let cursor: string | undefined;
    let pages = 0;
    do {
      const page = await getAuditPage({ category: null, days: 7, before: cursor });
      assert.ok(page.entries.length <= AUDIT_PAGE_SIZE);
      seen.push(...page.entries.map((e) => e.id));
      cursor = page.nextCursor ?? undefined;
      pages++;
    } while (cursor);

    assert.equal(pages, Math.ceil(95 / AUDIT_PAGE_SIZE));
    assert.deepEqual(seen, expected);
  });

  it("filters by topic, and shows the actions it does not know under everything", async () => {
    await entry("email_failed");
    await entry("email_resent");
    await entry("deposit_link_emailed");
    await entry("contract_signed");
    await entry("brand_new_action");

    assert.deepEqual((await titles({ category: "courriels" })).sort(), [
      "Courriel de confirmation renvoyé au client",
      "Courriel non envoyé",
      "Lien du dépôt envoyé par courriel",
    ]);
    assert.deepEqual(await titles({ category: "problemes" }), ["Courriel non envoyé"]);
    assert.deepEqual(await titles({ category: "contrats" }), ["Contrat signé par le client"]);
    assert.equal((await titles({ category: null })).length, 5);
    assert.ok((await titles({ category: null })).includes("brand_new_action"));
  });

  it("only goes back as far as asked", async () => {
    await entry("card_saved", { createdAt: ago(24 * 2) });
    await entry("deposit_released", { createdAt: ago(24 * 40) });

    assert.deepEqual(await titles({ days: 7 }), ["Carte enregistrée par le client"]);
    assert.equal((await titles({ days: 90 })).length, 2);
  });

  it("follows one booking, and names it", async () => {
    const trailer = await makeTrailer({ name: "5x10-Nord" });
    const booking = await makeBooking({ trailer, start: "2099-03-10", end: "2099-03-13" });
    await entry("card_saved", { reservationId: booking.id, actorType: "client", actorId: booking.clientId });
    await entry("card_saved");

    const page = await getAuditPage({ category: null, days: 7, reservationId: booking.id });

    assert.equal(page.entries.length, 1);
    const [row] = page.entries;
    assert.equal(row.actor, `${booking.client.firstName} ${booking.client.lastName}`);
    assert.equal(row.reservation?.exists, true);
    assert.match(row.reservation?.label ?? "", new RegExp(booking.client.lastName));
    assert.match(row.reservation?.label ?? "", /5x10-Nord/);
    assert.equal(row.reservation?.year, 2099);
    assert.equal(row.reservation?.month, 3);
  });

  it("keeps the entries of a booking that was deleted", async () => {
    const booking = await makeBooking({ signed: false, card: false });
    await entry("card_saved", { reservationId: booking.id });
    await prisma.reservation.delete({ where: { id: booking.id } });

    const [row] = (await getAuditPage({ category: null, days: 7 })).entries;

    assert.equal(row.reservation?.exists, false);
    assert.equal(row.reservation?.label, "Réservation supprimée");
  });

  it("says who did it: staff by name, a removed employee as such, and the system", async () => {
    const staff = await prisma.adminUser.create({ data: { username: "vincent", passwordHash: "not-a-real-hash", role: "employee" } });
    await entry("employee_created", { actorType: "admin", actorId: staff.id, createdAt: ago(3) });
    await entry("employee_created", { actorType: "admin", actorId: "removed-long-ago", createdAt: ago(2) });
    await entry("email_failed", { createdAt: ago(1) });

    const actors = (await getAuditPage({ category: null, days: 7 })).entries.map((e) => e.actor);

    assert.deepEqual(actors, ["Système", "Employé supprimé", "vincent"]);
  });

  it("names the client a document belongs to, even once the client is gone", async () => {
    const staff = await prisma.adminUser.create({ data: { username: "vincent", passwordHash: "not-a-real-hash", role: "employee" } });
    const client = await makeClient({ firstName: "Julie", lastName: "Gagnon" });
    await entry("document_viewed", { actorType: "admin", actorId: staff.id, createdAt: ago(2), details: { path: `documents/${client.id}/license-1700000000-ab12.pdf` } });
    await entry("document_viewed", { actorType: "admin", actorId: staff.id, createdAt: ago(1), details: { path: "documents/vanished-client/insurance-1700000000-cd34.pdf" } });

    const rows = (await getAuditPage({ category: "documents", days: 7 })).entries;

    assert.deepEqual(rows.map((row) => row.detail), ["Client supprimé", "Julie Gagnon"]);
    assert.ok(rows.every((row) => row.title.startsWith("Document consulté")));
  });
});
