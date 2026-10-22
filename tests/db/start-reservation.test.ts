import { afterEach, beforeEach, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { at, makeBooking, makeClient, makeTrailer, prisma, setupDatabase } from "./harness";
import { startOrResumeReservation } from "@/lib/reservations/start";

setupDatabase();

const HOUR = 3_600_000;

describe("starting a booking", () => {
  beforeEach(() => {
    // Only the clock: the rows keep the real time they are created at, so the tests move them instead.
    mock.timers.enable({ apis: ["Date"], now: Date.now() });
  });
  afterEach(() => {
    mock.timers.reset();
  });

  const age = (id: string, hours: number) =>
    prisma.reservation.update({ where: { id }, data: { createdAt: new Date(Date.now() - hours * HOUR) } });

  it("starts an empty booking for a new client", async () => {
    const client = await makeClient();

    const started = await startOrResumeReservation(client.id);

    assert.ok(started);
    const row = await prisma.reservation.findUniqueOrThrow({ where: { id: started.id } });
    assert.equal(row.clientId, client.id);
    assert.equal(row.status, "pending");
    assert.equal(row.trailerId, null);
  });

  it("picks the unfinished booking up again instead of piling up new ones, and takes the new dates", async () => {
    const client = await makeClient();
    const first = await startOrResumeReservation(client.id, { pickupDate: at("2099-03-10"), returnDate: at("2099-03-13") });

    const second = await startOrResumeReservation(client.id, { pickupDate: at("2099-04-01"), returnDate: at("2099-04-03") });

    assert.equal(second?.id, first?.id);
    assert.equal(await prisma.reservation.count({ where: { clientId: client.id } }), 1);
    const row = await prisma.reservation.findUniqueOrThrow({ where: { id: first!.id } });
    assert.equal(row.pickupDate?.toISOString(), "2099-04-01T00:00:00.000Z");
  });

  it("starts a new one once the unfinished booking is more than two hours old", async () => {
    const client = await makeClient();
    const old = await startOrResumeReservation(client.id);
    await age(old!.id, 3);

    const fresh = await startOrResumeReservation(client.id);

    assert.notEqual(fresh?.id, old?.id);
  });

  it("starts a new one when the previous booking already has a trailer", async () => {
    const client = await makeClient();
    const chosen = await makeBooking({ client, trailer: await makeTrailer(), start: "2099-03-10", end: "2099-03-13" });

    const next = await startOrResumeReservation(client.id);

    assert.notEqual(next?.id, chosen.id);
  });

  it("does not resume somebody else's booking", async () => {
    const [marie, luc] = [await makeClient(), await makeClient()];
    const hers = await startOrResumeReservation(marie.id);

    const his = await startOrResumeReservation(luc.id);

    assert.notEqual(his?.id, hers?.id);
  });

  it("stops a client who has already started ten in a day", async () => {
    const client = await makeClient();
    const trailer = await makeTrailer();
    for (let i = 0; i < 10; i++) await makeBooking({ client, trailer, start: "2099-03-10", end: "2099-03-13", status: "cancelled" });

    assert.equal(await startOrResumeReservation(client.id), null);
  });

  it("counts only the last 24 hours towards that limit", async () => {
    const client = await makeClient();
    const trailer = await makeTrailer();
    for (let i = 0; i < 10; i++) {
      const old = await makeBooking({ client, trailer, start: "2099-03-10", end: "2099-03-13", status: "cancelled" });
      await age(old.id, 30);
    }

    assert.ok(await startOrResumeReservation(client.id));
  });
});
