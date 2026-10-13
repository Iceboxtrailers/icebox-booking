import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/admin-auth";
import { listIncomeAccounts, listTaxCodes } from "@/lib/accounting/quickbooks";

// Lists what the owner can pick from inside their own QuickBooks file.
export async function GET() {
  const guard = await requireOwner();
  if (guard.error) return guard.error;

  try {
    const [accounts, taxCodes] = await Promise.all([listIncomeAccounts(), listTaxCodes()]);
    return NextResponse.json({ accounts, taxCodes });
  } catch (error) {
    console.error("QuickBooks options error", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Impossible de lire QuickBooks" },
      { status: 502 },
    );
  }
}
