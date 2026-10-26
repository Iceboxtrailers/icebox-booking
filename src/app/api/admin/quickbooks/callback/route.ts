import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/admin-auth";
import { CONNECTION_ID, exchangeCodeForTokens } from "@/lib/accounting/quickbooks";
import { logAudit } from "@/lib/audit";
import { reconcileQuickBooksCompany } from "@/lib/accounting/links";

export async function GET(request: Request) {
  const guard = await requireOwner();
  if (guard.error) return guard.error;

  const url = new URL(request.url);
  const back = (query: string) => NextResponse.redirect(`${url.origin}/dashboard/comptabilite?${query}`);

  const code = url.searchParams.get("code");
  const realmId = url.searchParams.get("realmId");
  const state = url.searchParams.get("state");
  const cookieState = request.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("qb_oauth_state="))
    ?.slice("qb_oauth_state=".length);

  if (url.searchParams.get("error")) return back("error=refuse");
  if (!code || !realmId || !state || !cookieState || state !== cookieState) return back("error=etat");

  try {
    const tokens = await exchangeCodeForTokens(code, `${url.origin}/api/admin/quickbooks/callback`);
    const existing = await prisma.accountingConnection.findUnique({ where: { id: CONNECTION_ID } });
    await prisma.accountingConnection.upsert({
      where: { id: CONNECTION_ID },
      create: { id: CONNECTION_ID, realmId, syncFromDate: new Date(), ...tokens },
      // Reconnecting the same company keeps its settings; a different company
      // starts clean so stale item/tax ids are never sent to it.
      update:
        existing && existing.realmId === realmId
          ? { ...tokens }
          : {
              realmId,
              ...tokens,
              syncFromDate: new Date(),
              incomeAccountId: null,
              taxCodeId: null,
              rentalItemId: null,
              transportItemId: null,
            },
    });
    // A different company (the real one after the test one, say): the customer and invoice numbers of the old one
    // mean nothing here, so they are forgotten and those bookings can be sent again.
    const company = await reconcileQuickBooksCompany(realmId, existing?.realmId ?? null);
    if (company.changed) {
      await logAudit({
        action: "quickbooks_company_changed",
        actor: { type: "admin", id: guard.admin.id },
        details: { from: company.from, to: company.to, clients: company.clients, reservations: company.reservations },
      });
    }
    await logAudit({
      action: "quickbooks_connected",
      actor: { type: "admin", id: guard.admin.id },
      details: { realmId },
    });
  } catch (error) {
    console.error("QuickBooks OAuth callback failed", error);
    return back("error=echec");
  }

  const response = back("connected=1");
  response.cookies.set("qb_oauth_state", "", { maxAge: 0, path: "/api/admin/quickbooks" });
  return response;
}
