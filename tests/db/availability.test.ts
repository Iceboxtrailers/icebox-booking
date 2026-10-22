import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { makeBooking, makeTrailer, prisma, setupDatabase } from "./harness";
import { hasConflict, searchAvailability, withTrailerLock } from "@/lib/availability";

setupDatabase();

describe("hasConflict", () => {
  const holds: [string, boolean][] = [
    ["confirmed", true],
    ["in_progress", true],
    ["completed", true],
    ["pending", false],
    ["cancelled", false],
  ];
  for (const [status, blocks] of holds) {
    it(`${blocks ? "blocks" : "does not block"} the dates when the other booking is ${status}`, async () => {
      const trailer = await makeTrailer();
      await makeBooking({ trailer, start: "2099-05-10", end: "2099-05-13", status });
      assert.equal(await hasConflict(trailer.id, "2099-05-11", "2099-05-12"), blocks);
    });
  }

  it("counts the return morning as free: dates are end-exclusive", async () => {
    const trailer = await makeTrailer();
    await makeBooking({ trailer, start: "2099-05-10", end: "2099-05-13", status: "confirmed" });

    const cases: [string, string, boolean][] = [
      ["2099-05-13", "2099-05-15", false], // picks up the morning the other returns
      ["2099-05-08", "2099-05-10", false], // returns the morning the other picks up
      ["2099-05-12", "2099-05-14", true],
      ["2099-05-09", "2099-05-11", true],
      ["2099-05-11", "2099-05-12", true],
      ["2099-05-08", "2099-05-15", true],
      ["2099-05-10", "2099-05-13", true],
    ];
    for (const [start, end, expected] of cases) {
      assert.equal(await hasConflict(trailer.id, start, end), expected, `${start} → ${end}`);
    }
  });

  it("ignores the booking that is being changed, and other trailers", async () => {
    const [trailer, other] = await Promise.all([makeTrailer(), makeTrailer()]);
    const booking = await makeBooking({ trailer, start: "2099-05-10", end: "2099-05-13", status: "confirmed" });

    assert.equal(await hasConflict(trailer.id, "2099-05-10", "2099-05-13", booking.id), false);
    assert.equal(await hasConflict(other.id, "2099-05-10", "2099-05-13"), false);
  });
});

describe("searchAvailability", () => {
  it("offers the free trailers of the size asked for, and skips the ones out of service", async () => {
    const free = await makeTrailer();
    const busy = await makeTrailer();
    await makeTrailer({ status: "maintenance" });
    await makeTrailer({ size: "6x12" });
    await makeBooking({ trailer: busy, start: "2099-05-10", end: "2099-05-13", status: "confirmed" });

    const found = await searchAvailability({ size: "5x10", dateRangeType: "fixed", start: "2099-05-11", end: "2099-05-12", flexWindowDays: 0 });

    assert.deepEqual(found.map((candidate) => candidate.trailerId), [free.id]);
    assert.equal(found[0].nights, 1);
    assert.ok(found[0].totalCents > 0);
  });

  it("offers every size when none is asked for", async () => {
    await makeTrailer();
    await makeTrailer({ size: "6x12" });

    const found = await searchAvailability({ dateRangeType: "fixed", start: "2099-05-11", end: "2099-05-12", flexWindowDays: 0 });

    assert.deepEqual(found.map((candidate) => candidate.size).sort(), ["5x10", "6x12"]);
  });

  it("drops the flexible windows that run into a booking", async () => {
    const trailer = await makeTrailer();
    await makeBooking({ trailer, start: "2099-05-13", end: "2099-05-14", status: "confirmed" });

    const found = await searchAvailability({ size: "5x10", dateRangeType: "flexible", start: "2099-05-10", end: "2099-05-13", flexWindowDays: 2 });

    // 8 → 11 and 10 → 13 are free (13 is the morning the other client picks up); 12 → 15 is not.
    assert.deepEqual(found.map((candidate) => `${candidate.windowStart}→${candidate.windowEnd}`).sort(), ["2099-05-08→2099-05-11", "2099-05-10→2099-05-13"]);
  });

  it("does not take a booking into account while it is being changed", async () => {
    const trailer = await makeTrailer();
    const mine = await makeBooking({ trailer, start: "2099-05-10", end: "2099-05-13", status: "confirmed" });

    const without = await searchAvailability({ size: "5x10", dateRangeType: "fixed", start: "2099-05-10", end: "2099-05-13", flexWindowDays: 0 });
    const editing = await searchAvailability({
      size: "5x10",
      dateRangeType: "fixed",
      start: "2099-05-10",
      end: "2099-05-13",
      flexWindowDays: 0,
      excludeReservationId: mine.id,
    });

    assert.equal(without.length, 0);
    assert.equal(editing.length, 1);
  });

  it("never offers dates that have already passed", async () => {
    await makeTrailer();
    const found = await searchAvailability({ size: "5x10", dateRangeType: "fixed", start: "2020-05-10", end: "2020-05-13", flexWindowDays: 0 });
    assert.deepEqual(found, []);
  });
});

describe("withTrailerLock", () => {
  it("lets one caller at a time through for the same trailer", async () => {
    const trailer = await makeTrailer();
    const order: string[] = [];
    const slow = (name: string) =>
      withTrailerLock(trailer.id, async () => {
        order.push(`${name} in`);
        await new Promise((resolve) => setTimeout(resolve, 150));
        order.push(`${name} out`);
      });

    await Promise.all([slow("a"), slow("b"), slow("c")]);

    // Whoever gets in first, each one finishes before the next starts.
    for (let i = 0; i < order.length; i += 2) {
      assert.match(order[i], / in$/);
      assert.equal(order[i + 1], order[i].replace(" in", " out"));
    }
  });

  it("does not make callers wait for each other when the trailers differ", async () => {
    const [one, two] = await Promise.all([makeTrailer(), makeTrailer()]);
    // Each caller stays inside until the other one is inside too: if the second had to wait for the first,
    // neither could ever leave.
    let inside = 0;
    let bothInside!: () => void;
    const together = new Promise<void>((resolve) => {
      bothInside = resolve;
    });
    const hold = (id: string) =>
      withTrailerLock(id, async () => {
        inside += 1;
        if (inside === 2) bothInside();
        let giveUp: NodeJS.Timeout | undefined;
        const tooLate = new Promise<never>((_, reject) => {
          giveUp = setTimeout(() => reject(new Error("the second trailer had to wait for the first")), 3000);
        });
        try {
          await Promise.race([together, tooLate]);
        } finally {
          clearTimeout(giveUp);
        }
      });

    await Promise.all([hold(one.id), hold(two.id)]);

    assert.equal(inside, 2);
  });

  it("rolls everything back when the work fails", async () => {
    const trailer = await makeTrailer();
    const booking = await makeBooking({ trailer, start: "2099-05-10", end: "2099-05-13" });

    await assert.rejects(
      withTrailerLock(trailer.id, async (tx) => {
        await tx.reservation.update({ where: { id: booking.id }, data: { status: "confirmed" } });
        throw new Error("boom");
      }),
      /boom/,
    );

    assert.equal((await prisma.reservation.findUniqueOrThrow({ where: { id: booking.id } })).status, "pending");
  });
});
