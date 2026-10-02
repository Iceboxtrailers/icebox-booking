import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import type { ReportReservation } from "@/lib/admin/reports";

const PAGE_SIZE: [number, number] = [612, 792];
const MARGIN = 56;
const LOGO_PATH = path.join(process.cwd(), "public/brand/logo-horizontal.png");
const LOGO_HEIGHT = 40;
const ROW_HEIGHT = 16;

const INK = rgb(0.15, 0.17, 0.2);
const MUTED = rgb(0.45, 0.48, 0.52);
const RULE = rgb(0.8, 0.8, 0.8);

const COLS = [
  { label: "Date", x: 0, width: 118 },
  { label: "Client", x: 118, width: 150 },
  { label: "Remorque", x: 268, width: 115 },
  { label: "Statut", x: 383, width: 62 },
  { label: "Montant", x: 445, width: 55 },
];

function fmtShort(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function money(cents: number): string {
  return `${(cents / 100).toFixed(2)} $`;
}

function truncate(text: string, font: PDFFont, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && font.widthOfTextAtSize(`${t}…`, size) > maxWidth) {
    t = t.slice(0, -1);
  }
  return `${t}…`;
}

// A tabular PDF report (revenue by rental over a date range), independent from
// the per-reservation contract PDF in ./providers/signature/stub.ts — same
// pdf-lib approach, but a table layout rather than flowing legal text.
export async function buildRentalReportPdf(params: {
  periodLabel: string;
  reservations: ReportReservation[];
}): Promise<Uint8Array> {
  const { periodLabel, reservations } = params;

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const logoImage = await pdfDoc.embedPng(await readFile(LOGO_PATH));
  const logoWidth = (logoImage.width / logoImage.height) * LOGO_HEIGHT;

  let page = pdfDoc.addPage(PAGE_SIZE);
  let y = page.getHeight() - MARGIN;

  const newPage = () => {
    page = pdfDoc.addPage(PAGE_SIZE);
    y = page.getHeight() - MARGIN;
  };
  const ensureRoom = (needed: number, onBreak?: () => void) => {
    if (y - needed < MARGIN) {
      newPage();
      onBreak?.();
    }
  };
  const drawRule = () => {
    page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + 500, y }, thickness: 0.75, color: RULE });
  };
  const drawTableHeader = () => {
    for (const col of COLS) {
      page.drawText(col.label, { x: MARGIN + col.x, y, size: 9, font: boldFont, color: MUTED });
    }
    y -= 5;
    drawRule();
    y -= 14;
  };

  // Header: logo + title + period, top-left.
  page.drawImage(logoImage, { x: MARGIN, y: y - LOGO_HEIGHT, width: logoWidth, height: LOGO_HEIGHT });
  const textX = MARGIN + logoWidth + 14;
  page.drawText("Rapport des locations", { x: textX, y: y - 15, size: 16, font: boldFont, color: INK });
  page.drawText(periodLabel, { x: textX, y: y - 32, size: 11, font, color: MUTED });
  page.drawText(`Généré le ${fmtShort(new Date())}`, { x: textX, y: y - 47, size: 9, font, color: MUTED });
  y -= LOGO_HEIGHT + 18;
  drawRule();
  y -= 16;

  drawTableHeader();

  let totalCents = 0;
  if (reservations.length === 0) {
    page.drawText("Aucune location pour cette période.", { x: MARGIN, y, size: 10.5, font, color: MUTED });
    y -= ROW_HEIGHT;
  }
  for (const r of reservations) {
    ensureRoom(ROW_HEIGHT, drawTableHeader);
    const dateRange = `${fmtShort(r.pickupDate)} - ${fmtShort(r.returnDate)}`;
    const values = [dateRange, r.clientName, r.trailerLabel, r.status, money(r.totalAmount)];
    for (let i = 0; i < COLS.length; i++) {
      const col = COLS[i];
      const text = truncate(values[i], font, 9.5, col.width - 6);
      page.drawText(text, { x: MARGIN + col.x, y, size: 9.5, font, color: INK });
    }
    totalCents += r.totalAmount;
    y -= ROW_HEIGHT;
  }

  ensureRoom(30);
  y -= 6;
  drawRule();
  y -= 18;
  page.drawText(
    `Total : ${reservations.length} location${reservations.length > 1 ? "s" : ""} — ${money(totalCents)} (avant taxes)`,
    { x: MARGIN, y, size: 11, font: boldFont, color: INK }
  );

  return pdfDoc.save();
}
