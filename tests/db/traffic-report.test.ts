import { afterEach, beforeEach, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { makeBooking, makeTrailer, prisma, setupDatabase } from "./harness";
import { getTrafficReport } from "@/lib/admin/traffic";

setupDatabase();

// Tuesday 20 October 2026, 11 am in Québec.
const NOW = Date.parse("2026-10-20T15:00:00Z");

type Hit = { day: string; visitor: string; name?: string; path?: string; source?: string | null; device?: string; country?: string | null; region?: string | null };
const hit = ({ day, ...rest }: Hit) =>
  prisma.trafficEvent.create({
    data: { name: "pageview", path: "/", device: "desktop", source: null, country: "CA", region: "QC", createdAt: new Date(`${day}T15:00:00Z`), day, ...rest },
  });

const byLabel = (rows: { label: string; visits: number }[]) => Object.fromEntries(rows.map((row) => [row.label, row.visits]));

describe("the traffic report", () => {
  beforeEach(() => {
    mock.timers.enable({ apis: ["Date"], now: NOW });
  });
  afterEach(() => {
    mock.timers.reset();
  });

  it("is empty, and says so, before the first visit", async () => {
    const report = await getTrafficReport(7);

    assert.equal(report.visits, 0);
    assert.equal(report.trackingSince, null);
    assert.equal(report.conversionRate, null);
    assert.deepEqual(report.daily.map((d) => d.day), ["2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18", "2026-10-19", "2026-10-20"]);
    assert.ok(report.daily.every((d) => d.visits === 0));
    assert.deepEqual(report.sources, []);
  });

  describe("with a week of visits", () => {
    beforeEach(async () => {
      // 20 Oct: A comes from Google on a phone, reads two pages and searches for dates; B comes straight
      // in; C comes from Facebook (in the United States) and opens the booking.
      await hit({ day: "2026-10-20", visitor: "aaaa", source: "google.com", device: "mobile" });
      await hit({ day: "2026-10-20", visitor: "aaaa", path: "/faq", source: "google.com", device: "mobile" });
      await hit({ day: "2026-10-20", visitor: "aaaa", name: "search_dates", source: "google.com", device: "mobile" });
      await hit({ day: "2026-10-20", visitor: "bbbb", region: "ON" });
      await hit({ day: "2026-10-20", visitor: "cccc", path: "/reservation/new", source: "facebook.com", country: "US", region: "NY" });
      // 19 Oct: D, on a tablet, from Google.
      await hit({ day: "2026-10-19", visitor: "dddd", source: "google.com", device: "tablet" });
      // 14 Oct is the first day of the window; 13 Oct is just outside it.
      await hit({ day: "2026-10-14", visitor: "eeee" });
      await hit({ day: "2026-10-13", visitor: "ffff" });
    });

    it("counts a visit as one visitor on one day", async () => {
      const report = await getTrafficReport(7);

      assert.equal(report.visits, 5);
      assert.equal(report.searched, 1);
      assert.equal(report.opened, 1);
      assert.deepEqual(report.daily.map((d) => d.visits), [1, 0, 0, 0, 0, 1, 3]);
    });

    it("includes the earlier visit with a longer period, and dates the first one", async () => {
      const week = await getTrafficReport(7);
      const month = await getTrafficReport(30);

      assert.equal(month.visits, 6);
      assert.equal(week.trackingSince?.toISOString(), "2026-10-13T15:00:00.000Z");
    });

    it("breaks the visits down by source, device, region and page", async () => {
      const report = await getTrafficReport(7);

      assert.deepEqual(byLabel(report.sources), { "google.com": 2, "facebook.com": 1, Direct: 2 });
      assert.deepEqual(byLabel(report.devices), { Ordinateur: 3, Téléphone: 1, Tablette: 1 });
      const regions = byLabel(report.regions);
      assert.equal(regions["Québec"], 3);
      assert.equal(regions["Ontario"], 1);
      assert.equal(Object.values(regions).reduce((a, b) => a + b, 0), 5);
      assert.deepEqual(
        report.pages.map((page) => [page.path, page.views, page.visits]),
        [
          ["/", 4, 4],
          ["/faq", 1, 1],
          ["/reservation/new", 1, 1],
        ],
      );
    });

    it("divides the bookings that were really confirmed by the visits", async () => {
      const trailer = await makeTrailer();
      const created = (day: string) => ({ createdAt: new Date(`${day}T15:00:00Z`) });
      await makeBooking({ trailer, start: "2026-12-01", end: "2026-12-04", status: "confirmed", over: created("2026-10-18") });
      await makeBooking({ trailer, start: "2026-12-10", end: "2026-12-12", status: "confirmed", over: { ...created("2026-10-18"), isTest: true } });
      await makeBooking({ signed: false, card: false, over: created("2026-10-19") }); // abandoned: pending for more than two hours

      const report = await getTrafficReport(7);

      assert.equal(report.booking.started, 2);
      assert.equal(report.booking.confirmed, 1);
      assert.equal(report.booking.abandoned.length, 1);
      assert.equal(report.conversionRate, 1 / 5);
    });
  });
});
