import { afterEach, beforeEach, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { makeBooking, makeClient, makeTrailer, prisma, setupDatabase } from "./harness";
import { encryptSecret } from "@/lib/crypto/secret-box";
import { syncReservationToQuickBooks } from "@/lib/accounting/sync";
import { forgetQuickBooksLinks, reconcileQuickBooksCompany } from "@/lib/accounting/links";
import { quickBooksInvoiceState } from "@/lib/accounting/status";

setupDatabase();

const TEST_COMPANY = "9341458487659018";
const REAL_COMPANY = "123146000000001";

function connect(realmId: string, over: { taxCodeId?: string | null; rentalItemId?: string | null; transportItemId?: string | null } = {}) {
  const data = {
    realmId,
    accessTokenEnc: encryptSecret("access-token"),
    refreshTokenEnc: encryptSecret("refresh-token"),
    accessTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
    refreshTokenExpiresAt: new Date(Date.now() + 100 * 24 * 60 * 60 * 1000),
    syncFromDate: new Date("2026-01-01T00:00:00Z"),
    incomeAccountId: "1",
    taxCodeId: "5",
    rentalItemId: "28",
    transportItemId: "29",
    ...over,
  };
  return prisma.accountingConnection.upsert({ where: { id: "quickbooks" }, create: { id: "quickbooks", ...data }, update: data });
}

const connectedInAudit = (realmId: string, at = new Date()) =>
  prisma.auditLog.create({ data: { action: "quickbooks_connected", actorType: "admin", actorId: "owner-1", details: { realmId }, createdAt: at } });

// What Intuit would answer. Only the calls the site makes are understood; anything else is a failure.
function fakeIntuit() {
  const calls: { method: string; path: string; body: unknown }[] = [];
  const real = globalThis.fetch;
  let customers = 500;
  let invoices = 900;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    if (url.origin !== "https://sandbox-quickbooks.api.intuit.com") return real(input, init);
    const path = url.pathname.replace(/^\/v3\/company\/[^/]+/, "");
    calls.push({ method: init?.method ?? "GET", path, body: init?.body ? JSON.parse(String(init.body)) : null });
    if (path === "/query") return Response.json({ QueryResponse: {} });
    if (path === "/customer") return Response.json({ Customer: { Id: String(++customers) } });
    if (path === "/invoice") return Response.json({ Invoice: { Id: String(++invoices), DocNumber: String(1000 + invoices - 900) } });
    return new Response("unexpected call", { status: 404 });
  }) as typeof fetch;
  return { calls, restore: () => (globalThis.fetch = real) };
}

type InvoiceBody = { CustomerRef: { value: string }; Line: { Amount: number; Description: string; SalesItemLineDetail: { ItemRef: { value: string } } }[] };

describe("the invoice sent to QuickBooks", () => {
  let intuit: ReturnType<typeof fakeIntuit>;
  beforeEach(() => {
    delete process.env.QUICKBOOKS_ENVIRONMENT;
    mock.method(console, "log", () => {});
    intuit = fakeIntuit();
  });
  afterEach(() => {
    intuit.restore();
    mock.restoreAll();
  });

  const invoiceCalls = () => intuit.calls.filter((call) => call.method === "POST" && call.path === "/invoice");

  it("has a rental line and a transport line for a booking the console set up with delivery", async () => {
    await connect(TEST_COMPANY);
    const booking = await makeBooking({
      trailer: await makeTrailer({ size: "6x12" }),
      start: "2099-11-11",
      end: "2099-12-26",
      status: "confirmed",
      signed: false,
      card: false,
      over: { totalAmount: 195000, deliveryOption: "delivery", deliveryFeeCents: 49000, usageLocation: "777 rue Villeray, Montréal" },
    });

    const result = await syncReservationToQuickBooks(booking.id, { actorAdminId: "owner-1" });

    assert.deepEqual(result, { status: "synced", invoiceNumber: "1001" });
    const [call] = invoiceCalls();
    const lines = (call.body as InvoiceBody).Line;
    assert.deepEqual(lines.map((line) => [line.SalesItemLineDetail.ItemRef.value, line.Amount]), [["28", 1460], ["29", 490]]);
    assert.equal(lines[1].Description, "Transport — livraison et récupération");
    const row = await prisma.reservation.findUniqueOrThrow({ where: { id: booking.id } });
    assert.equal(row.qbSyncStatus, "synced");
    assert.equal(row.qbInvoiceId, "901");
  });

  it("is a single rental line for a booking picked up at the depot", async () => {
    await connect(TEST_COMPANY);
    const booking = await makeBooking({ trailer: await makeTrailer(), start: "2099-11-11", end: "2099-11-14", status: "confirmed", signed: false, card: false, over: { totalAmount: 40000 } });

    await syncReservationToQuickBooks(booking.id);

    assert.deepEqual((invoiceCalls()[0].body as InvoiceBody).Line.map((line) => line.Amount), [400]);
  });

  it("is made once, however many times the sending is asked for", async () => {
    await connect(TEST_COMPANY);
    const booking = await makeBooking({ trailer: await makeTrailer(), start: "2099-11-11", end: "2099-11-14", status: "confirmed", signed: false, card: false, over: { totalAmount: 40000 } });

    await syncReservationToQuickBooks(booking.id);
    const again = await syncReservationToQuickBooks(booking.id, { force: true });

    assert.equal(again.status, "synced");
    assert.equal(invoiceCalls().length, 1);
  });

  it("is not made for a test booking or one that is not confirmed", async () => {
    await connect(TEST_COMPANY);
    const trailer = await makeTrailer();
    const test = await makeBooking({ trailer, start: "2099-11-11", end: "2099-11-14", status: "confirmed", signed: false, card: false, over: { isTest: true } });
    const pending = await makeBooking({ trailer, start: "2099-12-11", end: "2099-12-14", signed: false, card: false });

    assert.equal((await syncReservationToQuickBooks(test.id)).status, "skipped");
    assert.equal((await syncReservationToQuickBooks(pending.id)).status, "skipped");
    assert.equal(invoiceCalls().length, 0);
  });

  it("can be made again in the real company once the test company was replaced", async () => {
    // The booking was invoiced in Intuit's test company, then the owner connects the real one.
    await connect(TEST_COMPANY);
    await connectedInAudit(TEST_COMPANY);
    const booking = await makeBooking({ trailer: await makeTrailer({ size: "6x12" }), start: "2099-11-11", end: "2099-12-26", status: "confirmed", signed: false, card: false, over: { totalAmount: 195000, deliveryOption: "delivery", deliveryFeeCents: 49000, usageLocation: "Montréal" } });
    await syncReservationToQuickBooks(booking.id);
    const inTestCompany = await prisma.reservation.findUniqueOrThrow({ where: { id: booking.id }, include: { client: true } });
    assert.equal(inTestCompany.qbInvoiceId, "901");
    assert.equal(inTestCompany.client.qbCustomerId, "501");

    // Without forgetting, the number of the test company would make the site believe the invoice exists.
    assert.equal((await syncReservationToQuickBooks(booking.id, { force: true })).status, "synced");
    assert.equal(invoiceCalls().length, 1);

    const change = await reconcileQuickBooksCompany(REAL_COMPANY, TEST_COMPANY);
    await connect(REAL_COMPANY);
    assert.deepEqual(change, { changed: true, from: TEST_COMPANY, to: REAL_COMPANY, clients: 1, reservations: 1 });

    const result = await syncReservationToQuickBooks(booking.id, { force: true });

    assert.equal(result.status, "synced");
    assert.equal(invoiceCalls().length, 2);
    const row = await prisma.reservation.findUniqueOrThrow({ where: { id: booking.id }, include: { client: true } });
    assert.equal(row.qbInvoiceId, "902");
    assert.equal(row.client.qbCustomerId, "502", "a new customer was made in the real company, not the old number reused");
    assert.equal(intuit.calls.filter((call) => call.method === "POST" && call.path === "/customer").length, 2);
  });
});

describe("a change of QuickBooks company", () => {
  async function sentBooking(over: { qbCustomerId?: string | null; qbInvoiceId?: string | null; qbSyncStatus?: string } = {}) {
    const client = await makeClient({ qbCustomerId: over.qbCustomerId === undefined ? "69" : over.qbCustomerId });
    return makeBooking({
      client,
      trailer: await makeTrailer(),
      start: "2099-11-11",
      end: "2099-11-14",
      status: "confirmed",
      signed: false,
      card: false,
      over: {
        qbInvoiceId: over.qbInvoiceId === undefined ? "184" : over.qbInvoiceId,
        qbInvoiceNumber: "1042",
        qbSyncStatus: over.qbSyncStatus ?? "synced",
        qbSyncedAt: new Date(),
        qbSyncError: over.qbSyncStatus === "failed" ? "token expired" : null,
      },
    });
  }

  it("forgets the customers and invoices of the old company", async () => {
    const synced = await sentBooking();
    const failed = await sentBooking({ qbSyncStatus: "failed", qbInvoiceId: null });
    const untouched = await makeBooking({ trailer: await makeTrailer(), start: "2099-12-11", end: "2099-12-14", status: "confirmed", signed: false, card: false });

    const forgotten = await forgetQuickBooksLinks();

    assert.deepEqual(forgotten, { clients: 2, reservations: 2 });
    for (const id of [synced.id, failed.id, untouched.id]) {
      const row = await prisma.reservation.findUniqueOrThrow({ where: { id }, include: { client: true } });
      assert.deepEqual(
        [row.qbInvoiceId, row.qbInvoiceNumber, row.qbSyncStatus, row.qbSyncError, row.qbSyncedAt, row.client.qbCustomerId],
        [null, null, "none", null, null, null],
      );
    }
  });

  it("is noticed when the connection being replaced was another company", async () => {
    await sentBooking();
    const change = await reconcileQuickBooksCompany(REAL_COMPANY, TEST_COMPANY);
    assert.deepEqual(change, { changed: true, from: TEST_COMPANY, to: REAL_COMPANY, clients: 1, reservations: 1 });
  });

  it("is noticed after a disconnection too, from the last company the site was connected to", async () => {
    await connectedInAudit("111", new Date(Date.now() - 2000));
    await connectedInAudit(TEST_COMPANY, new Date(Date.now() - 1000));
    const booking = await sentBooking();

    const change = await reconcileQuickBooksCompany(REAL_COMPANY, null);

    assert.equal(change.changed, true);
    assert.equal(change.changed && change.from, TEST_COMPANY);
    assert.equal((await prisma.reservation.findUniqueOrThrow({ where: { id: booking.id } })).qbInvoiceId, null);
  });

  it("changes nothing when the same company is connected again", async () => {
    const booking = await sentBooking();
    assert.deepEqual(await reconcileQuickBooksCompany(TEST_COMPANY, TEST_COMPANY), { changed: false });

    await connectedInAudit(TEST_COMPANY);
    assert.deepEqual(await reconcileQuickBooksCompany(TEST_COMPANY, null), { changed: false });

    const row = await prisma.reservation.findUniqueOrThrow({ where: { id: booking.id }, include: { client: true } });
    assert.equal(row.qbInvoiceId, "184");
    assert.equal(row.client.qbCustomerId, "69");
  });

  it("changes nothing the first time QuickBooks is connected", async () => {
    const booking = await sentBooking();
    assert.deepEqual(await reconcileQuickBooksCompany(TEST_COMPANY, null), { changed: false });
    assert.equal((await prisma.reservation.findUniqueOrThrow({ where: { id: booking.id } })).qbInvoiceId, "184");
  });
});

describe("what a reservation sheet says about its invoice", () => {
  afterEach(() => {
    delete process.env.QUICKBOOKS_ENVIRONMENT;
  });

  const booking = (over: Parameters<typeof makeBooking>[0] = {}) => makeBooking({ signed: false, card: false, status: "confirmed", ...over });

  it("knows nothing about a booking that does not exist", async () => {
    assert.equal(await quickBooksInvoiceState("nope"), null);
  });

  it("says QuickBooks is not connected, and that nothing was sent", async () => {
    const state = await quickBooksInvoiceState((await booking()).id);
    assert.deepEqual(state, { connected: false, ready: false, environment: "sandbox", status: "none", invoiceId: null, invoiceNumber: null, syncedAt: null, error: null });
  });

  it("says when the connection is not set up yet (no tax code or items)", async () => {
    await connect(TEST_COMPANY, { taxCodeId: null, rentalItemId: null, transportItemId: null });
    const state = await quickBooksInvoiceState((await booking()).id);
    assert.equal(state?.connected, true);
    assert.equal(state?.ready, false);
  });

  it("gives the invoice that was made, and whether it is in the test company", async () => {
    await connect(TEST_COMPANY);
    const when = new Date("2026-10-24T11:36:14Z");
    const made = await booking({ over: { qbSyncStatus: "synced", qbInvoiceId: "184", qbInvoiceNumber: "1042", qbSyncedAt: when } });

    const sandbox = await quickBooksInvoiceState(made.id);
    assert.deepEqual(sandbox, { connected: true, ready: true, environment: "sandbox", status: "synced", invoiceId: "184", invoiceNumber: "1042", syncedAt: when.toISOString(), error: null });

    process.env.QUICKBOOKS_ENVIRONMENT = "production";
    assert.equal((await quickBooksInvoiceState(made.id))?.environment, "production");
  });

  it("gives the reason a sending failed", async () => {
    await connect(TEST_COMPANY);
    const failed = await booking({ over: { qbSyncStatus: "failed", qbSyncError: "QuickBooks 400: Invalid tax code" } });
    const state = await quickBooksInvoiceState(failed.id);
    assert.equal(state?.status, "failed");
    assert.equal(state?.error, "QuickBooks 400: Invalid tax code");
  });
});
