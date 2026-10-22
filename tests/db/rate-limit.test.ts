import { afterEach, beforeEach, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { prisma, setupDatabase } from "./harness";
import { overLimit } from "@/lib/rate-limit";
import type { RateRule } from "@/lib/rate-limit";

setupDatabase();

const rule: RateRule = { name: "db-test", limit: 3, windowSeconds: 60 };
const otherRule: RateRule = { name: "db-test-other", limit: 3, windowSeconds: 60 };

// Unix time is a whole number of minutes at hh:mm:00, so 10 s past the minute is 10 s into a 60 s window.
const T0 = Date.parse("2027-01-15T10:00:10Z");

const rows = () => prisma.rateLimit.findMany({ orderBy: [{ key: "asc" }, { bucket: "asc" }] });

describe("request counters", () => {
  beforeEach(() => {
    mock.timers.enable({ apis: ["Date"], now: T0 });
  });
  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
  });

  it("let `limit` requests through and refuse the rest of the window", async () => {
    const answers: boolean[] = [];
    for (let i = 0; i < 6; i++) answers.push((await overLimit(rule, "203.0.113.7")).over);

    assert.deepEqual(answers, [false, false, false, true, true, true]);
    const stored = await rows();
    assert.equal(stored.length, 1);
    assert.equal(stored[0].count, 6);
  });

  it("count requests that arrive at the same moment exactly", async () => {
    const answers = await Promise.all(Array.from({ length: 25 }, () => overLimit(rule, "203.0.113.7")));

    assert.equal(answers.filter((answer) => !answer.over).length, 3);
    assert.equal((await rows())[0].count, 25);
  });

  it("are kept apart per requester and per rule", async () => {
    for (let i = 0; i < 4; i++) await overLimit(rule, "203.0.113.7");
    const other = await overLimit(rule, "198.51.100.9");
    const sameRequesterOtherRule = await overLimit(otherRule, "203.0.113.7");

    assert.equal(other.over, false);
    assert.equal(sameRequesterOtherRule.over, false);
    assert.deepEqual((await rows()).map((row) => row.count).sort(), [1, 1, 4]);
  });

  it("treat an address or an e-mail in capitals as the same requester", async () => {
    await overLimit(rule, "Marie@Example.test");
    await overLimit(rule, "marie@example.test");
    assert.deepEqual((await rows()).map((row) => row.count), [2]);
  });

  it("start again with the next window, and say how long to wait", async () => {
    for (let i = 0; i < 3; i++) await overLimit(rule, "203.0.113.7");
    const refused = await overLimit(rule, "203.0.113.7");
    assert.equal(refused.over, true);
    assert.equal(refused.retryAfterSeconds, 50);

    mock.timers.setTime(T0 + 50_000); // 10:01:00, the next window
    const fresh = await overLimit(rule, "203.0.113.7");

    assert.equal(fresh.over, false);
    assert.equal(fresh.retryAfterSeconds, 60);
    assert.deepEqual((await rows()).map((row) => row.count), [4, 1]);
  });

  it("store neither the address nor the e-mail, and a time after which the row is useless", async () => {
    await overLimit(rule, "203.0.113.7");

    const [stored] = await rows();
    assert.match(stored.key, /^db-test:[0-9a-f]{24}$/);
    assert.equal(stored.expiresAt, BigInt(Math.floor(T0 / 1000 / 60) * 60 + 60 + 60));
  });

  it("sweep away old rows now and then, never current ones", async () => {
    await overLimit(rule, "203.0.113.7");
    mock.timers.setTime(T0 + 200_000); // well past the end of that window (plus the minute of grace)
    mock.method(Math, "random", () => 0.5);
    await overLimit(rule, "198.51.100.9");
    assert.equal((await rows()).length, 2, "no sweep on this request");

    mock.method(Math, "random", () => 0);
    await overLimit(rule, "198.51.100.9");

    const left = await rows();
    assert.equal(left.length, 1);
    assert.equal(left[0].count, 2);
  });

  it("let the request through when the counters cannot be reached", async () => {
    mock.method(console, "error", () => {});
    await prisma.$executeRawUnsafe(`ALTER TABLE rate_limits RENAME TO rate_limits_away`);
    try {
      const answer = await overLimit(rule, "203.0.113.7");
      assert.deepEqual(answer, { over: false, retryAfterSeconds: 0 });
    } finally {
      await prisma.$executeRawUnsafe(`ALTER TABLE rate_limits_away RENAME TO rate_limits`);
    }
  });
});
