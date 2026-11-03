import { NextResponse } from "next/server";
import Stripe from "stripe";
import { list } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { pingQuickBooks, quickBooksConfigured } from "@/lib/accounting/quickbooks";
import { runHealthChecks, tokenMatches } from "@/lib/health";
import type { HealthCheck } from "@/lib/health";

// Health of the connections to the outside platforms, for the quality-control agent. Read-only calls only. It answers
// to whoever sends the HEALTHCHECK_TOKEN in the x-health-token header; to anyone else the page does not exist.
export const dynamic = "force-dynamic";

const checks: Record<string, HealthCheck> = {
  database: async () => {
    await prisma.$queryRaw`SELECT 1`;
  },

  stripe: async () => {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) return "skipped: clé non configurée";
    await new Stripe(key).balance.retrieve();
  },

  email: async () => {
    const key = process.env.RESEND_API_KEY;
    if (!key) return "skipped: clé non configurée";
    const res = await fetch("https://api.resend.com/domains", { headers: { Authorization: `Bearer ${key}` }, cache: "no-store" });
    if (res.ok) return;
    // A key that can only send mail cannot list domains: Resend says so, and the key is good.
    const body = await res.json().catch(() => ({}));
    if (res.status === 401 && body?.name === "restricted_api_key") return "clé d'envoi seulement";
    throw new Error(`Resend a répondu ${res.status}${body?.name ? ` (${body.name})` : ""}`);
  },

  quickbooks: async () => {
    if (!quickBooksConfigured()) return "skipped: clés non configurées";
    const connection = await pingQuickBooks();
    if (!connection) return "skipped: non connecté";
    return connection.refreshDaysLeft < 14 ? `autorisation expire dans ${connection.refreshDaysLeft} jours` : undefined;
  },

  storage: async () => {
    if (process.env.STORAGE_PROVIDER !== "vercel-blob") return "skipped: stockage local";
    await list({ limit: 1 });
  },
};

export async function GET(request: Request) {
  if (!tokenMatches(request.headers.get("x-health-token"), process.env.HEALTHCHECK_TOKEN)) {
    return new NextResponse("Not found", { status: 404 });
  }
  const report = await runHealthChecks(checks);
  return NextResponse.json(report, { status: report.ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
