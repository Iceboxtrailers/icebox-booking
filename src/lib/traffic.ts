import { createHmac } from "node:crypto";
import { WIZARD_SEGMENTS } from "@/lib/wizard";

// Anonymous audience measurement. What is stored (see TrafficEvent in the schema) can count
// a visit but cannot identify anyone or follow them from one day to the next:
//  - no cookie and nothing kept in the browser;
//  - the "visitor" is an HMAC of the day, the IP and the browser with a secret that stays on
//    the server, truncated, and different every day; the IP itself is never stored;
//  - the only pages counted are public ones, normalised (no ids, no query strings);
//  - nothing links an event to a booking, a client or an email.
// Not counted at all: bots, visitors who send "Do Not Track" / Global Privacy Control, and
// the owner's own visits (a signed-in admin).

export const TRAFFIC_EVENT_NAMES = ["pageview", "search_dates"] as const;
export type TrafficEventName = (typeof TRAFFIC_EVENT_NAMES)[number];

// A visit that reaches one of these has opened the booking.
export const BOOKING_OPEN_PATHS = ["/reservation/invite", "/reservation/new"];

// Public pages worth counting. Anything else (admin console, secure links that carry a token,
// password reset, API) is ignored on purpose.
const PUBLIC_PATHS = new Set([
  "/",
  "/faq",
  "/contact",
  "/comment-ca-marche",
  "/chambre-froide",
  "/chambre-congelation",
  "/attaches-accessoires",
  "/devenir-concessionnaire",
  "/conditions",
  "/confidentialite",
  "/login",
  "/signup",
  "/mot-de-passe-oublie",
  ...BOOKING_OPEN_PATHS,
]);

export function normalizePath(raw: string): string | null {
  const bare = raw.split("?")[0].split("#")[0];
  if (!bare.startsWith("/") || bare.length > 120) return null;
  const path = bare.replace(/\/+$/, "") || "/";
  if (PUBLIC_PATHS.has(path)) return path;

  // /reservation/<id>/<step>: keep the step, drop the id so an event never points at a booking.
  const step = path.match(/^\/reservation\/[A-Za-z0-9_-]{10,40}\/([a-z-]+)$/)?.[1];
  if (step && (WIZARD_SEGMENTS as readonly string[]).includes(step)) return `/reservation/:id/${step}`;
  return null;
}

export type Device = "mobile" | "tablet" | "desktop";

export function deviceFromUserAgent(userAgent: string): Device {
  if (/ipad|tablet|android(?!.*mobile)/i.test(userAgent)) return "tablet";
  if (/mobi|iphone|ipod|android.*mobile|windows phone/i.test(userAgent)) return "mobile";
  return "desktop";
}

export function isBot(userAgent: string): boolean {
  return (
    !userAgent ||
    /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|monitor|uptime|curl|wget|python-requests|httpclient|facebookexternalhit|embedly|scrap/i.test(
      userAgent,
    )
  );
}

// Where the visit came from: a campaign tag (utm_source) first, else the referring site. Our own
// site (any of its addresses) is not a source.
export function trafficSource(referrer: string | undefined, utmSource: string | undefined): string | null {
  const utm = utmSource?.trim().toLowerCase().slice(0, 40);
  if (utm && /^[a-z0-9._-]+$/.test(utm)) return utm;
  if (!referrer) return null;
  try {
    const host = new URL(referrer).hostname.toLowerCase().replace(/^www\./, "");
    if (!host || host === "iceboxtrailers.ca" || host.includes("icebox-booking") || host === "localhost") return null;
    return host.slice(0, 80);
  } catch {
    return null;
  }
}

// Calendar day in Québec time (YYYY-MM-DD): the visitor hash and the reports use the same day.
export function quebecDay(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export function visitorHash(secret: string, day: string, ip: string, userAgent: string): string {
  return createHmac("sha256", secret).update(`${day}|${ip}|${userAgent}`).digest("hex").slice(0, 16);
}

// Events are recorded on the live site only (or when forced, for tests): local runs and preview
// deployments share the production database and must not pollute the numbers.
export function trackingEnabled(): boolean {
  return process.env.VERCEL_ENV === "production" || process.env.TRAFFIC_TRACKING_FORCE === "1";
}

// One visitor cannot add more than this many events a day (protects the table from a runaway script).
export const MAX_EVENTS_PER_VISITOR_PER_DAY = 300;

// Events are kept this long, then deleted.
export const TRAFFIC_RETENTION_DAYS = 400;
