import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mail, makeBooking, makeClient, makeTrailer, prisma, setupDatabase } from "./harness";
import { confirmReservation, ReservationConfirmError } from "@/lib/reservations/confirm";

setupDatabase();

const TEAM = "info@iceboxtrailers.ca";

const statusOf = async (id: string) => (await prisma.reservation.findUniqueOrThrow({ where: { id } })).status;

async function refusalOf(attempt: Promise<unknown>): Promise<ReservationConfirmError> {
  try {
    await attempt;
  } catch (error) {
    assert.ok(error instanceof ReservationConfirmError, `expected a ReservationConfirmError, got ${String(error)}`);
    return error;
  }
  assert.fail("the booking should have been refused");
}

describe("confirming a booking", () => {
  it("confirms a ready booking and e-mails the client and the team once each", async () => {
    const booking = await makeBooking({ trailer: await makeTrailer(), start: "2099-03-10", end: "2099-03-13" });

    const confirmed = await confirmReservation(booking.id, booking.clientId);

    assert.equal(confirmed.status, "confirmed");
    assert.equal(await statusOf(booking.id), "confirmed");
    assert.equal(mail.to(booking.client.email).length, 1);
    assert.equal(mail.to(TEAM).length, 1);
    assert.equal(mail.delivered().length, 2);
  });

  it("does nothing the second time", async () => {
    const booking = await makeBooking({ trailer: await makeTrailer(), start: "2099-03-10", end: "2099-03-13" });
    await confirmReservation(booking.id, booking.clientId);
    mail.reset();

    const again = await confirmReservation(booking.id, booking.clientId);

    assert.equal(again.status, "confirmed");
    assert.equal(mail.delivered().length, 0);
  });

  it("sends the e-mails once when the button is pressed twice at the same moment", async () => {
    const booking = await makeBooking({ trailer: await makeTrailer(), start: "2099-03-10", end: "2099-03-13" });

    const [first, second] = await Promise.all([
      confirmReservation(booking.id, booking.clientId),
      confirmReservation(booking.id, booking.clientId),
    ]);

    assert.equal(first.status, "confirmed");
    assert.equal(second.status, "confirmed");
    assert.equal(mail.to(booking.client.email).length, 1);
    assert.equal(mail.to(TEAM).length, 1);
  });

  it("gives the trailer to one client when several finish at the same moment", async () => {
    // Without the lock on the trailer, every one of them reads "free" before any of them writes. Several rounds,
    // since a missing lock only shows when the timing is unlucky.
    for (let round = 1; round <= 4; round++) {
      mail.reset();
      const trailer = await makeTrailer();
      const contenders = await Promise.all(
        Array.from({ length: 8 }, () => makeBooking({ trailer, start: "2099-03-10", end: "2099-03-13" })),
      );

      const results = await Promise.allSettled(contenders.map((booking) => confirmReservation(booking.id, booking.clientId)));

      const winners = results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
      const refusals = results.flatMap((result) => (result.status === "rejected" ? [result.reason as unknown] : []));
      assert.equal(winners.length, 1, `round ${round}: ${winners.length} clients got the same trailer`);
      for (const refusal of refusals) {
        assert.ok(refusal instanceof ReservationConfirmError, String(refusal));
        assert.equal(refusal.code, "slot_taken");
      }

      const holding = await prisma.reservation.findMany({ where: { trailerId: trailer.id, status: "confirmed" } });
      assert.deepEqual(holding.map((r) => r.id), [winners[0].id]);
      // The ones turned away are left as they were, and nobody but the winner was told anything.
      assert.equal(await prisma.reservation.count({ where: { trailerId: trailer.id, status: "pending" } }), 7);
      assert.equal(mail.delivered().length, 2);
    }
  });

  it("turns away any overlap, however short", async () => {
    const trailer = await makeTrailer();
    const first = await makeBooking({ trailer, start: "2099-05-10", end: "2099-05-13" });
    await confirmReservation(first.id, first.clientId);

    for (const [start, end] of [
      ["2099-05-12", "2099-05-15"], // the last night overlaps
      ["2099-05-08", "2099-05-11"], // the first night overlaps
      ["2099-05-11", "2099-05-12"], // inside
      ["2099-05-01", "2099-05-30"], // around
      ["2099-05-10", "2099-05-13"], // identical
    ]) {
      const other = await makeBooking({ trailer, start, end });
      const refusal = await refusalOf(confirmReservation(other.id, other.clientId));
      assert.equal(refusal.code, "slot_taken", `${start} → ${end}`);
      assert.equal(await statusOf(other.id), "pending");
    }
  });

  it("lets bookings that only touch, or use another trailer, all go through together", async () => {
    const [trailer, other] = await Promise.all([makeTrailer(), makeTrailer()]);
    const bookings = await Promise.all([
      makeBooking({ trailer, start: "2099-05-10", end: "2099-05-13" }),
      makeBooking({ trailer, start: "2099-05-13", end: "2099-05-15" }), // takes over the morning the first one returns
      makeBooking({ trailer, start: "2099-05-08", end: "2099-05-10" }), // returns the morning the first one leaves
      makeBooking({ trailer: other, start: "2099-05-10", end: "2099-05-13" }),
    ]);

    const results = await Promise.allSettled(bookings.map((booking) => confirmReservation(booking.id, booking.clientId)));

    assert.deepEqual(results.map((result) => result.status), ["fulfilled", "fulfilled", "fulfilled", "fulfilled"]);
  });

  it("does not let an unfinished booking hold the trailer", async () => {
    const trailer = await makeTrailer();
    const waiting = await makeBooking({ trailer, start: "2099-05-10", end: "2099-05-13" });
    const quick = await makeBooking({ trailer, start: "2099-05-10", end: "2099-05-13" });

    await confirmReservation(quick.id, quick.clientId);

    const refusal = await refusalOf(confirmReservation(waiting.id, waiting.clientId));
    assert.equal(refusal.code, "slot_taken");
  });

  describe("refuses a booking that is not ready, and changes nothing", () => {
    const trailerFree = () => makeTrailer();
    const dates = { start: "2099-06-01", end: "2099-06-04" };

    const cases: { name: string; message: RegExp; code?: "slot_taken"; make: () => ReturnType<typeof makeBooking> }[] = [
      {
        name: "contract not signed",
        message: /contrat doit être signé/,
        make: async () => makeBooking({ trailer: await trailerFree(), ...dates, signed: false }),
      },
      {
        name: "no card saved",
        message: /carte doit être enregistrée/,
        make: async () => makeBooking({ trailer: await trailerFree(), ...dates, card: false }),
      },
      {
        name: "suspended client",
        message: /ne peut pas être confirmée en ligne/,
        make: async () =>
          makeBooking({ client: await makeClient({ status: "suspended" }), trailer: await trailerFree(), ...dates }),
      },
      {
        name: "trailer taken out of service",
        message: /n'est plus disponible/,
        code: "slot_taken",
        make: async () => makeBooking({ trailer: await makeTrailer({ status: "maintenance" }), ...dates }),
      },
      {
        name: "no trailer chosen",
        message: /Sélectionnez d'abord/,
        make: () => makeBooking({ trailer: null, ...dates }),
      },
      {
        name: "no dates chosen",
        message: /Sélectionnez d'abord/,
        make: async () => makeBooking({ trailer: await trailerFree() }),
      },
      {
        name: "already cancelled",
        message: /n'est plus modifiable/,
        make: async () => makeBooking({ trailer: await trailerFree(), ...dates, status: "cancelled" }),
      },
    ];

    for (const { name, message, code, make } of cases) {
      it(name, async () => {
        const booking = await make();
        const before = booking.status;

        const refusal = await refusalOf(confirmReservation(booking.id, booking.clientId));

        assert.match(refusal.message, message);
        assert.equal(refusal.code, code);
        assert.equal(await statusOf(booking.id), before);
        assert.equal(mail.delivered().length, 0);
      });
    }

    it("somebody else's booking", async () => {
      const booking = await makeBooking({ trailer: await trailerFree(), ...dates });
      const stranger = await makeClient();

      const refusal = await refusalOf(confirmReservation(booking.id, stranger.id));

      assert.equal(refusal.message, "Introuvable");
      assert.equal(await statusOf(booking.id), "pending");
    });

    it("a booking that does not exist", async () => {
      const client = await makeClient();
      const refusal = await refusalOf(confirmReservation("does-not-exist", client.id));
      assert.equal(refusal.message, "Introuvable");
    });
  });
});
