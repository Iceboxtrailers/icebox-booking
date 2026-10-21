import { afterEach, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { addDays, fmt, isRealIsoDate, nights, quebecDay, quebecToday } from "@/lib/dates";

describe("addDays", () => {
  it("moves across month, year and leap-day boundaries", () => {
    assert.equal(addDays("2026-12-31", 1), "2027-01-01");
    assert.equal(addDays("2028-02-28", 1), "2028-02-29");
    assert.equal(addDays("2029-02-28", 1), "2029-03-01");
    assert.equal(addDays("2029-03-01", -1), "2029-02-28");
    assert.equal(addDays("2029-03-05", 0), "2029-03-05");
  });

  it("is not thrown off by the days the clocks change", () => {
    assert.equal(addDays("2026-03-08", 1), "2026-03-09");
    assert.equal(addDays("2026-11-01", 1), "2026-11-02");
  });
});

describe("nights", () => {
  it("counts the nights between two days, whatever the clocks do", () => {
    assert.equal(nights("2029-03-05", "2029-03-08"), 3);
    assert.equal(nights("2026-03-07", "2026-03-10"), 3);
    assert.equal(nights("2026-10-31", "2026-11-02"), 2);
  });

  it("counts a same-day rental as one night and a missing date as none", () => {
    assert.equal(nights("2029-03-05", "2029-03-05"), 1);
    assert.equal(nights(null, "2029-03-05"), 0);
    assert.equal(nights("2029-03-05", undefined), 0);
  });
});

describe("isRealIsoDate", () => {
  it("accepts real calendar days, leap day included", () => {
    for (const value of ["2028-02-29", "2029-12-31", "2026-10-21"]) assert.equal(isRealIsoDate(value), true, value);
  });

  it("rejects dates that do not exist or are not in the YYYY-MM-DD form", () => {
    const bad = ["2029-02-29", "2029-02-30", "2029-04-31", "2029-13-01", "2029-00-10", "2029-1-1", "29-01-01", "", "abcd-ef-gh", "2029-01-01T00:00:00Z"];
    for (const value of bad) assert.equal(isRealIsoDate(value), false, value);
  });
});

describe("fmt", () => {
  it("writes a day in French the way the site shows it", () => {
    assert.equal(fmt("2029-03-05"), "5 mars 2029");
    assert.equal(fmt("2026-10-21"), "21 octobre 2026");
    assert.equal(fmt(null), "");
    assert.equal(fmt(undefined), "");
  });
});

describe("quebecDay", () => {
  it("gives the calendar day in Québec, not in UTC (summer time, UTC-4)", () => {
    assert.equal(quebecDay(new Date("2026-10-21T03:30:00Z")), "2026-10-20");
    assert.equal(quebecDay(new Date("2026-10-21T04:00:00Z")), "2026-10-21");
  });

  it("follows winter time too (UTC-5)", () => {
    assert.equal(quebecDay(new Date("2026-12-01T04:30:00Z")), "2026-11-30");
    assert.equal(quebecDay(new Date("2026-12-01T05:00:00Z")), "2026-12-01");
  });

  it("is right around the end of summer time (1 November 2026, 06:00 UTC)", () => {
    assert.equal(quebecDay(new Date("2026-11-01T03:59:00Z")), "2026-10-31");
    assert.equal(quebecDay(new Date("2026-11-01T04:00:00Z")), "2026-11-01");
    assert.equal(quebecDay(new Date("2026-11-01T06:30:00Z")), "2026-11-01");
  });
});

describe("quebecToday", () => {
  afterEach(() => mock.timers.reset());

  // Pickup and return dates are stored as midnight UTC of their day: "today" must be comparable with them,
  // and must not jump to tomorrow at 8 pm in Québec.
  it("is midnight UTC of the Québec day", () => {
    mock.timers.enable({ apis: ["Date"], now: new Date("2026-10-22T01:30:00Z") });
    assert.equal(quebecToday().toISOString(), "2026-10-21T00:00:00.000Z");
  });

  it("is the same day during the day", () => {
    mock.timers.enable({ apis: ["Date"], now: new Date("2026-10-21T16:00:00Z") });
    assert.equal(quebecToday().toISOString(), "2026-10-21T00:00:00.000Z");
  });
});
