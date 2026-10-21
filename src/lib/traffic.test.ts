import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { deviceFromUserAgent, isBot, normalizePath, trackingEnabled, trafficSource, visitorHash } from "@/lib/traffic";

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const IPAD =
  "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const ANDROID_PHONE =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";
const ANDROID_TABLET =
  "Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const DESKTOP_CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

describe("which page a visit is counted for", () => {
  it("keeps the public pages and drops the query string, the anchor and a trailing slash", () => {
    assert.equal(normalizePath("/"), "/");
    assert.equal(normalizePath("/faq/"), "/faq");
    assert.equal(normalizePath("/faq?utm_source=x#haut"), "/faq");
    assert.equal(normalizePath("/reservation/invite"), "/reservation/invite");
  });

  it("keeps the booking step but never the booking id", () => {
    assert.equal(normalizePath("/reservation/cmviafytn0001h0wokom4x72a/depot"), "/reservation/:id/depot");
    assert.equal(normalizePath("/reservation/cmviafytn0001h0wokom4x72a/contrat?x=1"), "/reservation/:id/contrat");
  });

  it("ignores everything that is not a public page", () => {
    const ignored = [
      "/dashboard",
      "/dashboard/clients",
      "/admin/login",
      "/api/track",
      "/depot/some-secret-token",
      "/reinitialiser-mot-de-passe",
      "/reservation/cmviafytn0001h0wokom4x72a/inconnu",
      "/reservation/court/depot",
      "faq",
      "",
      `/${"a".repeat(130)}`,
    ];
    for (const path of ignored) assert.equal(normalizePath(path), null, path);
  });
});

describe("device", () => {
  it("tells phones, tablets and computers apart", () => {
    assert.equal(deviceFromUserAgent(IPHONE), "mobile");
    assert.equal(deviceFromUserAgent(ANDROID_PHONE), "mobile");
    assert.equal(deviceFromUserAgent(IPAD), "tablet");
    assert.equal(deviceFromUserAgent(ANDROID_TABLET), "tablet");
    assert.equal(deviceFromUserAgent(DESKTOP_CHROME), "desktop");
  });
});

describe("robots", () => {
  it("are not counted", () => {
    for (const agent of ["Googlebot/2.1", "curl/8.4.0", "facebookexternalhit/1.1", `${DESKTOP_CHROME} Chrome-Lighthouse`, ""]) {
      assert.equal(isBot(agent), true, JSON.stringify(agent));
    }
  });

  it("a normal browser is", () => {
    assert.equal(isBot(DESKTOP_CHROME), false);
    assert.equal(isBot(IPHONE), false);
  });
});

describe("where a visit came from", () => {
  it("prefers the campaign tag, in lower case", () => {
    assert.equal(trafficSource(undefined, "Facebook"), "facebook");
    assert.equal(trafficSource("https://www.google.com/", "newsletter"), "newsletter");
  });

  it("otherwise names the referring site without www", () => {
    assert.equal(trafficSource("https://www.google.com/search?q=remorque", undefined), "google.com");
  });

  it("ignores a campaign tag with odd characters, and our own site in all its addresses", () => {
    assert.equal(trafficSource("https://www.google.com", "bad value!"), "google.com");
    assert.equal(trafficSource("https://iceboxtrailers.ca/faq", undefined), null);
    assert.equal(trafficSource("https://icebox-booking-master.vercel.app/", undefined), null);
    assert.equal(trafficSource("http://localhost:3000/", undefined), null);
  });

  it("is empty for a direct visit or a referrer that is not an address", () => {
    assert.equal(trafficSource(undefined, undefined), null);
    assert.equal(trafficSource("not a url", undefined), null);
  });
});

describe("anonymous visitor", () => {
  it("is a short code that changes every day and cannot be turned back into the address", () => {
    const today = visitorHash("secret", "2029-01-01", "203.0.113.7", "UA");
    assert.match(today, /^[0-9a-f]{16}$/);
    assert.equal(today, visitorHash("secret", "2029-01-01", "203.0.113.7", "UA"));
    assert.notEqual(today, visitorHash("secret", "2029-01-02", "203.0.113.7", "UA"));
    assert.notEqual(today, visitorHash("secret", "2029-01-01", "203.0.113.8", "UA"));
    assert.notEqual(today, visitorHash("secret", "2029-01-01", "203.0.113.7", "Other UA"));
    assert.notEqual(today, visitorHash("another secret", "2029-01-01", "203.0.113.7", "UA"));
    assert.ok(!today.includes("203"));
  });
});

describe("when visits are recorded", () => {
  const saved = { vercel: process.env.VERCEL_ENV, force: process.env.TRAFFIC_TRACKING_FORCE };
  afterEach(() => {
    for (const [name, value] of [["VERCEL_ENV", saved.vercel], ["TRAFFIC_TRACKING_FORCE", saved.force]] as const) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  it("only on the live site, so local runs and previews do not pollute the numbers", () => {
    delete process.env.VERCEL_ENV;
    delete process.env.TRAFFIC_TRACKING_FORCE;
    assert.equal(trackingEnabled(), false);
    process.env.VERCEL_ENV = "preview";
    assert.equal(trackingEnabled(), false);
    process.env.VERCEL_ENV = "production";
    assert.equal(trackingEnabled(), true);
  });

  it("or when forced for a test", () => {
    delete process.env.VERCEL_ENV;
    process.env.TRAFFIC_TRACKING_FORCE = "1";
    assert.equal(trackingEnabled(), true);
  });
});
