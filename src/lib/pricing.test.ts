import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { addDays } from "@/lib/dates";
import { TRAILER_SIZE } from "@/lib/constants";
import type { TrailerSize } from "@/lib/constants";
import {
  GST_RATE,
  QST_RATE,
  RATE_TABLE,
  computeDeliveryFeeCents,
  computeTaxBreakdown,
  computeTotalCents,
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
    assert.equal(priceFor("5x10", 31), 105000); // a month and a day
    assert.equal(priceFor("5x10", 37), 130000); // a month and a week
    // 6x12: a day is 180 $, so 4 days (720 $) already cost the week (600 $), 15 nights the month.
    assert.deepEqual([3, 4].map((n) => priceFor("6x12", n)), [54000, 60000]);
    assert.equal(priceFor("6x12", 14), 120000);
    assert.equal(priceFor("6x12", 15), 130000);
  });

  it("counts a same-day rental as one night", () => {
    assert.equal(computeTotalCents("5x10", START, START), 15000);
  });

  it("is always the cheapest way to cover the nights, for every length up to 400 nights", () => {
    for (const size of TRAILER_SIZE) {
      for (let n = 1; n <= 400; n++) {
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
        const { months, weeks, days, totalCents } = priceBreakdown(size, START, addDays(START, n));
        assert.equal(months * rate.monthCents + weeks * rate.weekCents + days * rate.dayCents, totalCents);
      }
    }
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
