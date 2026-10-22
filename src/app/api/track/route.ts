import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentAdminId } from "@/lib/session";
import {
  MAX_EVENTS_PER_VISITOR_PER_DAY,
  TRAFFIC_EVENT_NAMES,
  TRAFFIC_RETENTION_DAYS,
  deviceFromUserAgent,
  isBot,
  normalizePath,
  quebecDay,
  trackingEnabled,
  trafficSource,
  visitorHash,
} from "@/lib/traffic";

const trackSchema = z.object({
  name: z.enum(TRAFFIC_EVENT_NAMES),
  path: z.string().max(200),
  referrer: z.string().max(300).optional(),
  utm: z.string().max(60).optional(),
});

// Anonymous audience measurement (see src/lib/traffic.ts). Always answers 204 and says nothing
// about why an event was ignored.
export async function POST(request: Request) {
  const ignored = () => new NextResponse(null, { status: 204 });

  const secret = process.env.AUTH_SECRET;
  if (!trackingEnabled() || !secret) return ignored();

  // Respect "Do Not Track" and Global Privacy Control.
  if (request.headers.get("dnt") === "1" || request.headers.get("sec-gpc") === "1") return ignored();

  const userAgent = request.headers.get("user-agent") ?? "";
  if (isBot(userAgent)) return ignored();

  const parsed = trackSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return ignored();
  const path = normalizePath(parsed.data.path);
  if (!path) return ignored();

  // The owner's own visits are not traffic.
  if (await getCurrentAdminId()) return ignored();

  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || request.headers.get("x-real-ip") || "unknown";
  const day = quebecDay();
  const visitor = visitorHash(secret, day, ip, userAgent);

  const eventsToday = await prisma.trafficEvent.count({ where: { day, visitor } });
  if (eventsToday >= MAX_EVENTS_PER_VISITOR_PER_DAY) return ignored();

  await prisma.trafficEvent.create({
    data: {
      day,
      visitor,
      name: parsed.data.name,
      path,
      source: trafficSource(parsed.data.referrer, parsed.data.utm),
      device: deviceFromUserAgent(userAgent),
      country: request.headers.get("x-vercel-ip-country")?.slice(0, 2).toUpperCase() || null,
      region: request.headers.get("x-vercel-ip-country-region")?.slice(0, 6).toUpperCase() || null,
    },
  });

  // Housekeeping: now and then, drop events older than the retention period.
  if (Math.random() < 0.01) {
    await prisma.trafficEvent.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - TRAFFIC_RETENTION_DAYS * 86_400_000) } } });
  }

  return ignored();
}
