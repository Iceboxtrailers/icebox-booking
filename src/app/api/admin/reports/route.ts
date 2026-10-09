import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/admin-auth";
import { adminReportQuerySchema } from "@/lib/validation";
import { getReservationsForReport } from "@/lib/admin/reports";
import { buildRentalReportPdf } from "@/lib/reports/rental-report-pdf";
import { fmt } from "@/lib/dates";

const MONTH_LABELS_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

function lastDayOfMonth(year: number, month: number): string {
  const day = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export async function GET(request: Request) {
  const ownerGuard = await requireOwner();
  if (ownerGuard.error) return ownerGuard.error;

  const searchParams = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = adminReportQuerySchema.safeParse(searchParams);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide" }, { status: 400 });
  }

  let start: string;
  let end: string;
  let periodLabel: string;
  let filenamePart: string;

  if (parsed.data.type === "month") {
    const { year, month } = parsed.data;
    start = `${year}-${String(month).padStart(2, "0")}-01`;
    end = lastDayOfMonth(year, month);
    periodLabel = `${MONTH_LABELS_FR[month - 1]} ${year}`;
    filenamePart = `${year}-${String(month).padStart(2, "0")}`;
  } else if (parsed.data.type === "year") {
    const { year } = parsed.data;
    start = `${year}-01-01`;
    end = `${year}-12-31`;
    periodLabel = `Année ${year}`;
    filenamePart = String(year);
  } else {
    ({ start, end } = parsed.data);
    if (end < start) {
      return NextResponse.json({ error: "La date de fin doit être après la date de début" }, { status: 400 });
    }
    periodLabel = `Du ${fmt(start)} au ${fmt(end)}`;
    filenamePart = `${start}_${end}`;
  }

  const reservations = await getReservationsForReport(start, end);
  const pdfBytes = await buildRentalReportPdf({ periodLabel, reservations });

  return new NextResponse(new Uint8Array(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="rapport-locations-${filenamePart}.pdf"`,
    },
  });
}
