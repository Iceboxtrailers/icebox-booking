import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { BOOKING_OPEN_PATHS, quebecDay } from "@/lib/traffic";
import { getBookingFunnel, type FunnelReport } from "@/lib/admin/funnel";

export type TrafficCount = { label: string; visits: number };

export type TrafficReport = {
  days: number;
  /** when the first event was recorded, so low numbers at the start are understood */
  trackingSince: Date | null;
  /** a visit = one visitor on one day; someone who comes back another day counts again */
  visits: number;
  searched: number;
  opened: number;
  daily: { day: string; visits: number }[];
  sources: TrafficCount[];
  devices: TrafficCount[];
  regions: TrafficCount[];
  pages: { path: string; views: number; visits: number }[];
  booking: FunnelReport;
  /** confirmed bookings / visits over the period */
  conversionRate: number | null;
};

const DEVICE_LABEL: Record<string, string> = { mobile: "Téléphone", tablet: "Tablette", desktop: "Ordinateur" };

const CANADIAN_REGION: Record<string, string> = {
  QC: "Québec",
  ON: "Ontario",
  NB: "Nouveau-Brunswick",
  NS: "Nouvelle-Écosse",
  PE: "Île-du-Prince-Édouard",
  NL: "Terre-Neuve-et-Labrador",
  MB: "Manitoba",
  SK: "Saskatchewan",
  AB: "Alberta",
  BC: "Colombie-Britannique",
  YT: "Yukon",
  NT: "Territoires du Nord-Ouest",
  NU: "Nunavut",
};

export function regionLabel(country: string | null, region: string | null): string {
  if (!country) return "Inconnu";
  if (country === "CA") return (region && CANADIAN_REGION[region]) || "Canada (autre)";
  try {
    return new Intl.DisplayNames(["fr-CA"], { type: "region" }).of(country) ?? country;
  } catch {
    return country;
  }
}

export function deviceLabel(device: string): string {
  return DEVICE_LABEL[device] ?? device;
}

// The last `count` calendar days (Québec time), oldest first, as YYYY-MM-DD.
export function lastDays(count: number, today: string = quebecDay()): string[] {
  const base = new Date(`${today}T12:00:00Z`).getTime();
  return Array.from({ length: count }, (_, index) => new Date(base - (count - 1 - index) * 86_400_000).toISOString().slice(0, 10));
}

// Days without a single visit are still shown (as zero) so the chart keeps its time scale.
export function fillDaily(days: string[], rows: { day: string; visits: number }[]): { day: string; visits: number }[] {
  const byDay = new Map(rows.map((row) => [row.day, row.visits]));
  return days.map((day) => ({ day, visits: byDay.get(day) ?? 0 }));
}

// Visits that came with no campaign tag and no outside referrer are "Direct".
export function withDirectSource(totalVisits: number, sourcedVisits: number, rows: TrafficCount[]): TrafficCount[] {
  const direct = Math.max(totalVisits - sourcedVisits, 0);
  return [...rows, ...(direct > 0 ? [{ label: "Direct", visits: direct }] : [])].sort((a, b) => b.visits - a.visits);
}

const n = (value: unknown) => Number(value ?? 0);

export async function getTrafficReport(days: number): Promise<TrafficReport> {
  const dayList = lastDays(days);
  const firstDay = dayList[0];

  const [totals, daily, sources, devices, regions, pages, first, booking] = await Promise.all([
    prisma.$queryRaw<{ visits: unknown; searched: unknown; opened: unknown; sourced: unknown }[]>(Prisma.sql`
      SELECT
        COUNT(DISTINCT CASE WHEN name = 'pageview' THEN day || visitor END) AS visits,
        COUNT(DISTINCT CASE WHEN name = 'search_dates' THEN day || visitor END) AS searched,
        COUNT(DISTINCT CASE WHEN name = 'pageview' AND path IN (${Prisma.join(BOOKING_OPEN_PATHS)}) THEN day || visitor END) AS opened,
        COUNT(DISTINCT CASE WHEN name = 'pageview' AND source IS NOT NULL THEN day || visitor END) AS sourced
      FROM traffic_events
      WHERE day >= ${firstDay}`),
    prisma.$queryRaw<{ day: string; visits: unknown }[]>(Prisma.sql`
      SELECT day, COUNT(DISTINCT visitor) AS visits
      FROM traffic_events
      WHERE day >= ${firstDay} AND name = 'pageview'
      GROUP BY day ORDER BY day`),
    prisma.$queryRaw<{ label: string; visits: unknown }[]>(Prisma.sql`
      SELECT source AS label, COUNT(DISTINCT day || visitor) AS visits
      FROM traffic_events
      WHERE day >= ${firstDay} AND name = 'pageview' AND source IS NOT NULL
      GROUP BY source ORDER BY visits DESC LIMIT 8`),
    prisma.$queryRaw<{ label: string; visits: unknown }[]>(Prisma.sql`
      SELECT device AS label, COUNT(DISTINCT day || visitor) AS visits
      FROM traffic_events
      WHERE day >= ${firstDay} AND name = 'pageview'
      GROUP BY device ORDER BY visits DESC`),
    prisma.$queryRaw<{ country: string | null; region: string | null; visits: unknown }[]>(Prisma.sql`
      SELECT country, region, COUNT(DISTINCT day || visitor) AS visits
      FROM traffic_events
      WHERE day >= ${firstDay} AND name = 'pageview'
      GROUP BY country, region ORDER BY visits DESC LIMIT 8`),
    prisma.$queryRaw<{ path: string; views: unknown; visits: unknown }[]>(Prisma.sql`
      SELECT path, COUNT(*) AS views, COUNT(DISTINCT day || visitor) AS visits
      FROM traffic_events
      WHERE day >= ${firstDay} AND name = 'pageview'
      GROUP BY path ORDER BY views DESC LIMIT 12`),
    prisma.trafficEvent.findFirst({ orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
    getBookingFunnel(days),
  ]);

  const total = totals[0];
  const visits = n(total?.visits);

  return {
    days,
    trackingSince: first?.createdAt ?? null,
    visits,
    searched: n(total?.searched),
    opened: n(total?.opened),
    daily: fillDaily(dayList, daily.map((row) => ({ day: row.day, visits: n(row.visits) }))),
    sources: withDirectSource(visits, n(total?.sourced), sources.map((row) => ({ label: row.label, visits: n(row.visits) }))),
    devices: devices.map((row) => ({ label: deviceLabel(row.label), visits: n(row.visits) })),
    regions: regions.map((row) => ({ label: regionLabel(row.country, row.region), visits: n(row.visits) })),
    pages: pages.map((row) => ({ path: row.path, views: n(row.views), visits: n(row.visits) })),
    booking,
    conversionRate: visits > 0 ? booking.confirmed / visits : null,
  };
}
