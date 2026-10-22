import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Slows down abuse of the public forms and the logins: a rule allows `limit` requests per
// `windowSeconds` for one requester (an IP address, an email or a signed-in client). Counters live
// in the database so every server instance sees the same numbers.
export type RateRule = { name: string; limit: number; windowSeconds: number };

export const RATE_RULES = {
  // Client sign-in: per email (guessing one password) and per IP (trying many emails).
  login: { name: "login", limit: 10, windowSeconds: 15 * 60 },
  loginIp: { name: "login-ip", limit: 40, windowSeconds: 15 * 60 },
  // Console sign-in. The account lockout (8 failures, 15 minutes) stops one account being guessed; this stops
  // one address trying many accounts. A normal sign-in is two or three requests (password, then the code).
  adminLoginIp: { name: "admin-login-ip", limit: 30, windowSeconds: 15 * 60 },
  signup: { name: "signup", limit: 5, windowSeconds: 60 * 60 },
  // "Does this email have an account?" can be used to list customers.
  checkEmail: { name: "check-email", limit: 30, windowSeconds: 10 * 60 },
  forgotPassword: { name: "forgot-password", limit: 10, windowSeconds: 60 * 60 },
  resetPassword: { name: "reset-password", limit: 20, windowSeconds: 60 * 60 },
  // Each contact message sends an email: the site-wide cap keeps the sending quota (confirmation and
  // password emails use the same one) from being used up by a script.
  contact: { name: "contact", limit: 5, windowSeconds: 60 * 60 },
  contactAll: { name: "contact-all", limit: 40, windowSeconds: 24 * 60 * 60 },
  guestStart: { name: "guest-start", limit: 10, windowSeconds: 60 * 60 },
  // Per signed-in client: file storage, contract PDFs, and the paid Google Maps distance lookup.
  upload: { name: "upload", limit: 20, windowSeconds: 60 * 60 },
  contract: { name: "contract", limit: 30, windowSeconds: 60 * 60 },
  maps: { name: "maps", limit: 20, windowSeconds: 60 * 60 },
  passwordChange: { name: "password-change", limit: 10, windowSeconds: 15 * 60 },
  // Staff resending a client's confirmation e-mail, per booking: enough to retry after a typo or an outage,
  // not enough to flood one client's inbox.
  resendConfirmation: { name: "resend-confirmation", limit: 5, windowSeconds: 60 * 60 },
} satisfies Record<string, RateRule>;

// The visitor's address as the hosting platform reports it (it replaces anything the visitor sent).
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}

// Counters are keyed by a keyed hash, so neither an IP nor an email is stored in the clear.
export function rateLimitKey(rule: RateRule, subject: string): string {
  const digest = createHmac("sha256", process.env.AUTH_SECRET ?? "").update(subject.toLowerCase()).digest("hex");
  return `${rule.name}:${digest.slice(0, 24)}`;
}

// Counts one request and says whether it goes over the rule. It never throws: if the counter cannot
// be reached the request goes through, since what it protects needs the same database anyway.
export async function overLimit(rule: RateRule, subject: string): Promise<{ over: boolean; retryAfterSeconds: number }> {
  try {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const bucket = Math.floor(nowSeconds / rule.windowSeconds);
    const windowEnd = (bucket + 1) * rule.windowSeconds;

    const rows = await prisma.$queryRaw<{ count: number }[]>`
      INSERT INTO rate_limits ("key", "bucket", "count", "expiresAt")
      VALUES (${rateLimitKey(rule, subject)}, ${String(bucket)}::bigint, 1, ${String(windowEnd + 60)}::bigint)
      ON CONFLICT ("key", "bucket") DO UPDATE SET "count" = rate_limits."count" + 1
      RETURNING "count"`;

    // Housekeeping: now and then, drop counters whose window is over.
    if (Math.random() < 0.01) {
      await prisma.$executeRaw`DELETE FROM rate_limits WHERE "expiresAt" < ${String(nowSeconds)}::bigint`;
    }

    return { over: Number(rows[0]?.count ?? 1) > rule.limit, retryAfterSeconds: Math.max(1, windowEnd - nowSeconds) };
  } catch (error) {
    console.error("Rate limit check failed", error);
    return { over: false, retryAfterSeconds: 0 };
  }
}

export function tooManyRequests(retryAfterSeconds: number, message = "Trop de tentatives. Réessayez dans quelques minutes.") {
  return NextResponse.json({ error: message }, { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } });
}

// For route handlers: `const limited = await rejectIfOverLimit(rule, subject); if (limited) return limited;`
export async function rejectIfOverLimit(rule: RateRule, subject: string, message?: string): Promise<NextResponse | null> {
  const { over, retryAfterSeconds } = await overLimit(rule, subject);
  return over ? tooManyRequests(retryAfterSeconds, message) : null;
}
