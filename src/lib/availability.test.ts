import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildWindows } from "@/lib/availability";

describe("search windows", () => {
  it("a fixed range is searched as it is", () => {
    assert.deepEqual(buildWindows("fixed", "2029-03-05", "2029-03-08", 2), [
      { start: "2029-03-05", end: "2029-03-08", offsetDays: 0 },
    ]);
  });

  it("a flexible range is also searched two days earlier and two days later, keeping its length", () => {
    assert.deepEqual(buildWindows("flexible", "2029-03-05", "2029-03-08", 2), [
      { start: "2029-03-03", end: "2029-03-06", offsetDays: -2 },
      { start: "2029-03-05", end: "2029-03-08", offsetDays: 0 },
      { start: "2029-03-07", end: "2029-03-10", offsetDays: 2 },
    ]);
  });

  it("a flexible range with no flexibility is just the range", () => {
    assert.deepEqual(buildWindows("flexible", "2029-03-05", "2029-03-08", 0), [
      { start: "2029-03-05", end: "2029-03-08", offsetDays: 0 },
    ]);
  });

  it("shifts correctly across a month end", () => {
    const windows = buildWindows("flexible", "2029-03-01", "2029-03-03", 2);
    assert.equal(windows[0].start, "2029-02-27");
    assert.equal(windows[0].end, "2029-03-01");
    assert.equal(windows[2].end, "2029-03-05");
  });
});
