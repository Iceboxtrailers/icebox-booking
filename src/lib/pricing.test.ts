import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { addDays } from "@/lib/dates";
import { TRAILER_SIZE } from "@/lib/constants";
import type { TrailerSize } from "@/lib/constants";
import {
  GST_RATE,
  LONG_STAY_SPREAD_DAYS,
  QST_RATE,
  RATE_TABLE,
  computeDeliveryFeeCents,
  computeTaxBreakdown,
  computeTotalCents,
  longStayCents,
  priceBreakdown,
} from "@/lib/pricing";

const START = "2029-01-01";
const priceFor = (size: TrailerSize, nightCount: number) => computeTotalCents(size, START, addDays(START, nightCount));

// What the offer sheet promises, written independently of the code: the cheapest way to cover at least
// `nightCount` nights with blocks of 1, 7 and 30 nights.
function cheapestCover(size: TrailerSize, nightCount: number): number {
  const rate = RATE_TABLE[size];
  const best: number[] = Array(nightCount + 40).fill(Infinity);
  best[0] = 0;
  for (let i = 1; i < best.length; i++) {
    best[i] = Math.min(
      best[i - 1] + rate.dayCents,
      i >= 7 ? best[i - 7] + rate.weekCents : Infinity,
      i >= 30 ? best[i - 30] + rate.monthCents : Infinity,
    );
  }
  return Math.min(...best.slice(nightCount));
}

describe("rental price", () => {
  it("charges the flat rate for exactly a day, a week and a month", () => {
    assert.equal(priceFor("5x10", 1), 15000);
    assert.equal(priceFor("5x10", 7), 40000);
    assert.equal(priceFor("5x10", 30), 90000);
    assert.equal(priceFor("6x12", 1), 18000);
    assert.equal(priceFor("6x12", 7), 60000);
    assert.equal(priceFor("6x12", 30), 130000);
  });

  it("never charges more than the next tier up (the rule validated by the owner)", () => {
    // 5x10: 3 days cost as much as the week, 15 to 29 nights as much as the month.
    assert.deepEqual([2, 3, 4].map((n) => priceFor("5x10", n)), [30000, 40000, 40000]);
    assert.equal(priceFor("5x10", 8), 55000); // a week and a day
    assert.equal(priceFor("5x10", 14), 80000);
    assert.deepEqual([15, 22, 29].map((n) => priceFor("5x10", n)), [90000, 90000, 90000]);
    // 6x12: a day is 180 $, so 4 days (720 $) already cost the week (600 $), 15 nights the month.
    assert.deepEqual([3, 4].map((n) => priceFor("6x12", n)), [54000, 60000]);
    assert.equal(priceFor("6x12", 14), 120000);
    assert.equal(priceFor("6x12", 15), 130000);
  });

  it("counts a same-day rental as one night", () => {
    assert.equal(computeTotalCents("5x10", START, START), 15000);
  });

  it("under a month, is always the cheapest way to cover the nights", () => {
    for (const size of TRAILER_SIZE) {
      for (let n = 1; n < 30; n++) {
        assert.equal(priceFor(size, n), cheapestCover(size, n), `${size}, ${n} nights`);
      }
    }
  });

  it("never goes down when the rental gets longer, and never beats the daily rate", () => {
    for (const size of TRAILER_SIZE) {
      let previous = 0;
      for (let n = 1; n <= 400; n++) {
        const price = priceFor(size, n);
        assert.ok(price >= previous, `${size}: ${n} nights cost less than ${n - 1}`);
        assert.ok(price <= n * RATE_TABLE[size].dayCents, `${size}: ${n} nights cost more than ${n} days`);
        previous = price;
      }
    }
  });

  it("splits the total into blocks that add up to it", () => {
    for (const size of TRAILER_SIZE) {
      const rate = RATE_TABLE[size];
      for (let n = 1; n <= 120; n++) {
        const { months, weeks, days, longStayDays, totalCents } = priceBreakdown(size, START, addDays(START, n));
        assert.equal(
          months * rate.monthCents + weeks * rate.weekCents + days * rate.dayCents + longStayCents(size, longStayDays),
          totalCents,
          `${size}, ${n} nights`,
        );
        // Short rentals are weeks and days, long stays are months and long-stay days, never a mix.
        assert.ok(longStayDays === 0 || (weeks === 0 && days === 0), `${size}, ${n} nights`);
        assert.ok(longStayDays < LONG_STAY_SPREAD_DAYS, `${size}, ${n} nights`);
      }
    }
  });
});

describe("long stay price", () => {
  // The prices the owner agreed to, before tax. A 6x12 is 1 300 $ a month, then 46,43 $ a day or 325 $ a week; a 5x10 is
  // 900 $ a month, then 32,14 $ a day or 225 $ a week.
  it("charges the full months at the monthly rate, then the monthly rate spread over 28 days", () => {
    assert.deepEqual(
      [30, 35, 42, 45, 56, 60, 65, 90].map((n) => priceFor("6x12", n)),
      [130000, 153214, 185714, 199643, 250714, 260000, 283214, 390000],
    );
    assert.deepEqual([30, 35, 45, 60, 90].map((n) => priceFor("5x10", n)), [90000, 106071, 138214, 180000, 270000]);
  });

  it("makes a week after the first month a quarter of the month", () => {
    assert.equal(longStayCents("6x12", 7), 32500);
    assert.equal(longStayCents("5x10", 7), 22500);
    assert.equal(priceFor("6x12", 37) - priceFor("6x12", 30), 32500);
    assert.equal(priceFor("5x10", 37) - priceFor("5x10", 30), 22500);
  });

  it("rounds the days after the months once, on the whole block", () => {
    // 5 x 46,43 $ would be 232,15 $ and 15 x 46,43 $ 696,45 $.
    assert.equal(longStayCents("6x12", 5), 23214);
    assert.equal(longStayCents("6x12", 15), 69643);
    assert.equal(longStayCents("5x10", 5), 16071);
  });

  it("never charges the days after the full months more than one more month", () => {
    for (const size of TRAILER_SIZE) {
      const month = RATE_TABLE[size].monthCents;
      assert.ok(longStayCents(size, 27) < month, `${size}, 27 days`);
      for (const days of [28, 29, 100]) assert.equal(longStayCents(size, days), month, `${size}, ${days} days`);
      // 28 and 29 days after the first month are the second month.
      for (const n of [58, 59, 60]) assert.equal(priceFor(size, n), 2 * month, `${size}, ${n} nights`);
    }
  });

  it("costs between the full months and one more month, for every length", () => {
    for (const size of TRAILER_SIZE) {
      const month = RATE_TABLE[size].monthCents;
      for (let n = 30; n <= 400; n++) {
        const fullMonths = Math.floor(n / 30);
        const price = priceFor(size, n);
        assert.ok(price >= fullMonths * month && price <= (fullMonths + 1) * month, `${size}, ${n} nights`);
      }
    }
  });

  it("never costs more than the day, week and month rates alone would", () => {
    for (const size of TRAILER_SIZE) {
      for (let n = 30; n <= 400; n++) {
        assert.ok(priceFor(size, n) <= cheapestCover(size, n), `${size}, ${n} nights`);
      }
    }
  });

  it("adds a 28th of the month for each night after the first month, never more", () => {
    for (const size of TRAILER_SIZE) {
      const oneNight = Math.ceil(RATE_TABLE[size].monthCents / LONG_STAY_SPREAD_DAYS);
      for (let n = 30; n < 400; n++) {
        const gap = priceFor(size, n + 1) - priceFor(size, n);
        assert.ok(gap >= 0 && gap <= oneNight, `${size}: ${n} to ${n + 1} nights`);
      }
    }
  });

  it("is for one continuous rental: separate reservations are each priced on their own nights", () => {
    // Two weeks, the trailer comes back, three more weeks later: two ordinary rentals, no long-stay rate on their sum.
    for (const size of TRAILER_SIZE) {
      assert.equal(priceFor(size, 14), cheapestCover(size, 14));
      assert.equal(priceFor(size, 21), cheapestCover(size, 21));
      assert.ok(priceFor(size, 14) + priceFor(size, 21) > priceFor(size, 35), size);
    }
    assert.equal(priceFor("6x12", 14) + priceFor("6x12", 21), 120000 + 130000);
    assert.equal(priceFor("6x12", 35), 153214);
  });

  it("shows the days after the months apart from the weeks and days of a short rental", () => {
    assert.deepEqual(priceBreakdown("6x12", START, addDays(START, 35)), {
      months: 1,
      weeks: 0,
      days: 0,
      longStayDays: 5,
      totalCents: 153214,
    });
    assert.deepEqual(priceBreakdown("6x12", START, addDays(START, 10)), {
      months: 0,
      weeks: 1,
      days: 3,
      longStayDays: 0,
      totalCents: 114000,
    });
    // 28 days after the first month are the second month.
    assert.deepEqual(priceBreakdown("6x12", START, addDays(START, 58)), {
      months: 2,
      weeks: 0,
      days: 0,
      longStayDays: 0,
      totalCents: 260000,
    });
  });
});

describe("taxes", () => {
  it("adds the GST and the QST, both on the pre-tax amount (matches the booking screens)", () => {
    assert.deepEqual(computeTaxBreakdown(40000), {
      subtotalCents: 40000,
      gstCents: 2000,
      qstCents: 3990,
      totalWithTaxCents: 45990,
    });
    // 540 $ -> 620,87 $ as shown to clients (the QST of 53,865 $ rounds up).
    assert.equal(computeTaxBreakdown(54000).totalWithTaxCents, 62087);
    assert.equal(computeTaxBreakdown(0).totalWithTaxCents, 0);
  });

  it("rounds each tax to the nearest cent and keeps the total consistent", () => {
    for (let subtotal = 0; subtotal <= 300000; subtotal += 137) {
      const tax = computeTaxBreakdown(subtotal);
      assert.equal(tax.totalWithTaxCents, subtotal + tax.gstCents + tax.qstCents);
      assert.ok(Math.abs(tax.gstCents - subtotal * GST_RATE) <= 0.5 + 1e-9);
      assert.ok(Math.abs(tax.qstCents - subtotal * QST_RATE) <= 0.5 + 1e-9);
    }
  });
});

describe("transport fee", () => {
  it("is 60 $ per one-way trip within 50 km, and nothing for a pickup at the depot", () => {
    assert.equal(computeDeliveryFeeCents(0, 0), 0);
    assert.equal(computeDeliveryFeeCents(30, 2), 12000);
    assert.equal(computeDeliveryFeeCents(50, 1), 6000);
  });

  it("adds 0,95 $ per km beyond 50 km, for each trip", () => {
    assert.equal(computeDeliveryFeeCents(80, 2), 17700); // 2 x (60 $ + 30 km x 0,95 $)
    assert.equal(computeDeliveryFeeCents(51.5, 1), 6143);
  });
});
