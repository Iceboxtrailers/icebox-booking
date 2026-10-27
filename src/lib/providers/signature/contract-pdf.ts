import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb, type PDFPage } from "pdf-lib";
import { fmt, quebecDay } from "@/lib/dates";
import { loadContractFonts, type ContractFonts } from "./contract-fonts";
import type { ContractLine, Run, SignatureParty } from "./contract-text";

const PAGE_SIZE: [number, number] = [612, 792];
const LOGO_PATH = path.join(process.cwd(), "public/brand/logo-stacked.png");

const CYAN = rgb(0, 0.619608, 0.870588);
const NAVY = rgb(0, 0.372549, 0.607843);
const MUTED = rgb(0.321569, 0.388235, 0.439216);
const INK = rgb(0.145098, 0.203922, 0.25098);
const HEADER_RULE = rgb(0.407843, 0.737255, 0.913725);
const TINT = rgb(0.611765, 0.811765, 0.941176);
const WHITE = rgb(1, 1, 1);

// The page of the owner's revised contract, in points from the bottom-left corner. Text is 8.5 on 11.5, the
// headings 10.1 and the page title 18 in Bungee; a block starts under the page's header at TOP and stops at
// BOTTOM, above the footer.
const LEFT = 60;
const TEXT_WIDTH = 494;
const TABLE_WIDTH = 504;
const RIGHT_EDGE = 558;
const TOP = 698;
const BOTTOM = 52;
const BODY = 8.5;
const LEAD = 11.5;
const HEADING = 10.1;
const ROW_PADDING = 3.5;
// The label and the value of a table row, and the amount of a price row, start this far from the table's left edge.
const LABEL_X = 10;
const VALUE_X = 160;
const AMOUNT_X = 364;
const PARTY_X = [10, 262];
// A row has 3.5 above and below its text; the first baseline sits 12.5 under the top of the row.
const ROW_FIRST_BASELINE = 12.5;
// Room to sign, above the line of the signature (and for the signature itself once signed).
const SIGNATURE_ZONE = 22;

// How the client signed, printed in the signature block of the contract: the signature itself (drawn, or the typed
// name set in handwriting) with who and when.
export type SignatureStamp = {
  imageBuffer: Buffer;
  signerName: string;
  signedAt: Date;
  method: "drawn" | "typed";
};

// "21 h 30": the time of day in Québec, written the way the contract writes the date.
export function quebecTimeOfDay(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
  return `${hour} h ${minute}`;
}

type Seg = { text: string; bold: boolean };

// A block laid out: how tall it is, the space it asks for around it and how to draw it from its top edge.
type Placed = {
  height: number;
  before: number;
  after: number;
  // The page head always opens a page.
  startsPage?: boolean;
  // A heading never ends a page: it moves with what follows.
  keepWithNext?: boolean;
  draw: (page: PDFPage, top: number) => void;
};

// The words of a line of runs. Only a plain space separates words: a no-break space stays inside one.
function toWords(runs: Run[], clean: (text: string) => string): Seg[][] {
  const words: Seg[][] = [];
  let word: Seg[] = [];
  const end = () => {
    if (word.length) words.push(word);
    word = [];
  };
  for (const run of runs) {
    const bold = typeof run !== "string";
    for (const part of clean(typeof run === "string" ? run : run.bold).split(/( )/)) {
      if (part === " ") end();
      else if (part) {
        const last = word[word.length - 1];
        if (last && last.bold === bold) last.text += part;
        else word.push({ text: part, bold });
      }
    }
  }
  end();
  return words;
}

// Words joined into the segments of a line: a space between two bold words is bold, any other is plain, as in the text.
function joinWords(words: Seg[][]): Seg[] {
  const line: Seg[] = [];
  const add = (text: string, bold: boolean) => {
    const last = line[line.length - 1];
    if (last && last.bold === bold) last.text += text;
    else line.push({ text, bold });
  };
  words.forEach((word, index) => {
    if (index > 0) add(" ", words[index - 1][words[index - 1].length - 1].bold && word[0].bold);
    for (const seg of word) add(seg.text, seg.bold);
  });
  return line;
}

// Breaks runs into lines no wider than `width`.
function wrapRuns(runs: Run[], width: number, size: number, fonts: ContractFonts): Seg[][] {
  const fontOf = (seg: Seg) => (seg.bold ? fonts.bold : fonts.body);
  const widthOf = (segs: Seg[]) => segs.reduce((sum, seg) => sum + fontOf(seg).widthOfTextAtSize(seg.text, size), 0);
  const spaceBetween = (a: Seg[], b: Seg[]) => (a[a.length - 1].bold && b[0].bold ? fonts.bold : fonts.body).widthOfTextAtSize(" ", size);

  // A word wider than the line (a very long address) is cut where it must be.
  const pieces = (word: Seg[]): Seg[][] => {
    if (widthOf(word) <= width) return [word];
    const out: Seg[][] = [];
    let piece: Seg[] = [];
    for (const seg of word) {
      for (const char of seg.text) {
        const next = [...piece, { text: char, bold: seg.bold }];
        if (piece.length && widthOf(next) > width) {
          out.push(piece);
          piece = [{ text: char, bold: seg.bold }];
        } else piece = next;
      }
    }
    if (piece.length) out.push(piece);
    return out;
  };

  const lines: Seg[][][] = [];
  let line: Seg[][] = [];
  let lineWidth = 0;
  for (const word of toWords(runs, fonts.clean).flatMap(pieces)) {
    const wordWidth = widthOf(word);
    if (line.length && lineWidth + spaceBetween(line[line.length - 1], word) + wordWidth > width) {
      lines.push(line);
      line = [];
    }
    lineWidth = line.length ? lineWidth + spaceBetween(line[line.length - 1], word) + wordWidth : wordWidth;
    line.push(word);
  }
  if (line.length) lines.push(line);
  return lines.length ? lines.map(joinWords) : [[]];
}

// Draws the contract as a PDF from its blocks (the same ones the page shows, see contract-text.ts) in the layout of
// the owner's revised contract: the logo and header on every page, one page per part, shaded tables, the footer with
// the page numbers. The signature block takes the client's signature once it is signed. Text goes through the
// fonts' `clean`: a name or an address the fonts cannot draw must not make the contract fail.
export async function renderContractDocument(
  lines: ContractLine[],
  // `fontDir` is for the tests: where the font files are looked for.
  options: { signature?: SignatureStamp; fontDir?: string } = {},
): Promise<{ bytes: Uint8Array; pageCount: number }> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle("Contrat de location – Remorques Réfrigérées ICEBOX");
  pdfDoc.setLanguage("fr-CA");
  const fonts = await loadContractFonts(pdfDoc, options.fontDir);
  const logo = await pdfDoc.embedPng(await readFile(LOGO_PATH));
  const stamp = options.signature;
  const signature = stamp ? await pdfDoc.embedPng(stamp.imageBuffer) : null;
  const logoHeight = 62;

  // The built-in bold stands in for Bungee when the font files are missing; it only has capitals to go with it.
  const displayText = (text: string) => (fonts.custom ? fonts.clean(text) : fonts.clean(text).toUpperCase());

  const drawSegs = (page: PDFPage, segs: Seg[], x: number, y: number, size = BODY, color = INK) => {
    let cursor = x;
    for (const seg of segs) {
      if (!seg.text) continue;
      const font = seg.bold ? fonts.bold : fonts.body;
      page.drawText(seg.text, { x: cursor, y, size, font, color });
      cursor += font.widthOfTextAtSize(seg.text, size);
    }
  };
  const drawText = (page: PDFPage, text: string, x: number, y: number, bold = false) => drawSegs(page, [{ text: fonts.clean(text), bold }], x, y);

  // The shaded panel of a table, and the white lines between its rows.
  const drawPanel = (page: PDFPage, top: number, rowHeights: number[]) => {
    const height = rowHeights.reduce((sum, h) => sum + h, 0);
    page.drawRectangle({ x: LEFT, y: top - height, width: TABLE_WIDTH, height, color: TINT });
    let edge = top;
    for (const rowHeight of rowHeights.slice(0, -1)) {
      edge -= rowHeight;
      page.drawLine({ start: { x: LEFT, y: edge }, end: { x: LEFT + TABLE_WIDTH, y: edge }, thickness: 0.5, color: WHITE });
    }
  };
  const rowHeight = (lineCount: number) => lineCount * LEAD + ROW_PADDING * 2;

  const place = {
    pageHead: (eyebrow: string, title: string): Placed => ({
      height: 11 + 5 + 26,
      before: 0,
      after: 10,
      startsPage: true,
      draw: (page, top) => {
        drawSegs(page, [{ text: fonts.clean(eyebrow), bold: false }], LEFT, top - 8, 8, MUTED);
        page.drawText(displayText(title), { x: LEFT, y: top - 11 - 5 - 18, size: 18, font: fonts.display, color: NAVY });
      },
    }),

    heading: (text: string): Placed => {
      const wrapped = wrapRuns([text], TEXT_WIDTH, HEADING, fonts);
      const shown = wrapped.map((segs) => displayText(segs.map((seg) => seg.text).join("")));
      return {
        height: 14 * shown.length,
        before: 7,
        after: 5,
        keepWithNext: true,
        draw: (page, top) =>
          shown.forEach((line, i) => page.drawText(line, { x: LEFT, y: top - HEADING - i * 14, size: HEADING, font: fonts.display, color: NAVY })),
      };
    },

    paragraph: (paragraph: Run[][]): Placed => {
      const wrapped = paragraph.flatMap((runs) => wrapRuns(runs, TEXT_WIDTH, BODY, fonts));
      return {
        height: wrapped.length * LEAD,
        before: 0,
        after: 5,
        draw: (page, top) => wrapped.forEach((segs, i) => drawSegs(page, segs, LEFT, top - BODY - i * LEAD)),
      };
    },

    note: (text: string): Placed => {
      const wrapped = wrapRuns([text], TEXT_WIDTH, 8, fonts);
      return {
        height: wrapped.length * 11,
        before: 0,
        after: 5,
        draw: (page, top) => wrapped.forEach((segs, i) => drawSegs(page, segs, LEFT, top - 8 - i * 11, 8, MUTED)),
      };
    },

    table: (rows: { label: string; lines: Run[][] }[]): Placed => {
      const laid = rows.map((row) => ({
        label: wrapRuns([row.label], VALUE_X - LABEL_X - 10, BODY, fonts),
        value: row.lines.flatMap((runs) => wrapRuns(runs, TABLE_WIDTH - VALUE_X - 10, BODY, fonts)),
      }));
      const heights = laid.map((row) => rowHeight(Math.max(row.label.length, row.value.length)));
      return {
        height: heights.reduce((sum, h) => sum + h, 0),
        before: 0,
        after: 8,
        draw: (page, top) => {
          drawPanel(page, top, heights);
          let rowTop = top;
          laid.forEach((row, r) => {
            row.label.forEach((segs, i) => drawSegs(page, segs, LEFT + LABEL_X, rowTop - ROW_FIRST_BASELINE - i * LEAD));
            row.value.forEach((segs, i) => drawSegs(page, segs, LEFT + VALUE_X, rowTop - ROW_FIRST_BASELINE - i * LEAD));
            rowTop -= heights[r];
          });
        },
      };
    },

    amounts: (rows: { label: string; amount: string; strong?: boolean }[]): Placed => {
      const laid = rows.map((row) => ({
        label: wrapRuns([row.strong ? { bold: row.label } : row.label], AMOUNT_X - LABEL_X - 10, BODY, fonts),
        amount: wrapRuns([row.strong ? { bold: row.amount } : row.amount], TABLE_WIDTH - AMOUNT_X - 10, BODY, fonts),
      }));
      const heights = laid.map((row) => rowHeight(Math.max(row.label.length, row.amount.length)));
      return {
        height: heights.reduce((sum, h) => sum + h, 0),
        before: 0,
        after: 8,
        draw: (page, top) => {
          drawPanel(page, top, heights);
          let rowTop = top;
          laid.forEach((row, r) => {
            row.label.forEach((segs, i) => drawSegs(page, segs, LEFT + LABEL_X, rowTop - ROW_FIRST_BASELINE - i * LEAD));
            row.amount.forEach((segs, i) => drawSegs(page, segs, LEFT + AMOUNT_X, rowTop - ROW_FIRST_BASELINE - i * LEAD));
            rowTop -= heights[r];
          });
        },
      };
    },

    // The two parties side by side, with room to sign. Once signed, the client's column carries the signature.
    parties: (parties: SignatureParty[]): Placed => {
      const columnWidth = 242 - LABEL_X;
      const signedAt = stamp ? `${fmt(quebecDay(stamp.signedAt))} à ${quebecTimeOfDay(stamp.signedAt)} (heure du Québec)` : "";

      type Entry = { segs: Seg[][]; height: number; image?: boolean; blank?: boolean };
      const columns = parties.map((party) => {
        const signed = Boolean(stamp && party.signer);
        const entries: Entry[] = party.fields.map((field) => {
          const isSignature = field.label === "Signature";
          if (signed && stamp) {
            if (isSignature) {
              const label = `Signature (${stamp.method === "typed" ? "nom tapé" : "dessinée"}) :`;
              return { segs: [[{ text: fonts.clean(label), bold: false }]], height: SIGNATURE_ZONE, image: true };
            }
            const segs = wrapRuns([`${field.label} : ${field.label === "Date" ? signedAt : stamp.signerName}`], columnWidth, BODY, fonts);
            return { segs, height: segs.length * LEAD };
          }
          const text = `${field.label} : ${"_".repeat(field.blank)}`;
          return { segs: wrapRuns([text], columnWidth, BODY, fonts), height: isSignature ? SIGNATURE_ZONE : LEAD, blank: isSignature };
        });
        return { party, signed, entries, height: entries.reduce((sum, entry) => sum + entry.height, 0) };
      });
      const bodyHeight = Math.max(...columns.map((column) => column.height)) + ROW_PADDING * 2;
      const heights = [rowHeight(1), bodyHeight];

      return {
        height: heights[0] + heights[1],
        before: 0,
        after: 8,
        draw: (page, top) => {
          drawPanel(page, top, heights);
          const bodyTop = top - heights[0];
          columns.forEach((column, c) => {
            const x = LEFT + PARTY_X[c];
            drawText(page, column.signed ? `${column.party.title} • signé électroniquement` : column.party.title, x, top - ROW_FIRST_BASELINE);
            let y = bodyTop - ROW_PADDING;
            for (const entry of column.entries) {
              if (entry.image && signature) {
                const labelWidth = fonts.body.widthOfTextAtSize(entry.segs[0][0].text, BODY);
                // As tall as the zone, within what is left of the column after the label.
                const scale = Math.min((columnWidth - labelWidth - 4) / signature.width, SIGNATURE_ZONE / signature.height);
                drawSegs(page, entry.segs[0], x, y - entry.height + 3);
                page.drawImage(signature, {
                  x: x + labelWidth + 4,
                  y: y - entry.height + 1,
                  width: signature.width * scale,
                  height: signature.height * scale,
                });
              } else {
                // A line of text sits at the top of its room; the line to sign on at the bottom of the zone.
                const baseline = entry.blank ? y - entry.height + 3 : y - 9;
                entry.segs.forEach((segs, i) => drawSegs(page, segs, x, baseline - i * LEAD));
              }
              y -= entry.height;
            }
          });
        },
      };
    },
  };

  // Every block as what is drawn; the signature section is its heading, its paragraph and its table.
  const footer = lines.find((line): line is Extract<ContractLine, { type: "footer" }> => line.type === "footer")?.text ?? "";
  const placed: Placed[] = [];
  for (const line of lines) {
    if (line.type === "page") placed.push(place.pageHead(line.eyebrow, line.title));
    else if (line.type === "heading") placed.push(place.heading(line.text));
    else if (line.type === "paragraph") placed.push(place.paragraph(line.lines));
    else if (line.type === "note") placed.push(place.note(line.text));
    else if (line.type === "table") placed.push(place.table(line.rows));
    else if (line.type === "amounts") placed.push(place.amounts(line.rows));
    else if (line.type === "signatures") {
      const intro = place.paragraph([line.intro]);
      placed.push(place.heading(line.heading), { ...intro, keepWithNext: true }, place.parties(line.parties));
    }
  }

  const pages: PDFPage[] = [];
  const newPage = () => {
    const page = pdfDoc.addPage(PAGE_SIZE);
    page.drawRectangle({ x: 0, y: 786, width: PAGE_SIZE[0], height: 6, color: CYAN });
    const logoWidth = (logo.width / logo.height) * logoHeight;
    page.drawImage(logo, { x: 54.54, y: 720, width: logoWidth, height: logoHeight });
    const title = "CONTRAT DE LOCATION";
    const subtitle = "Remorques Réfrigérées ICEBOX Inc.";
    page.drawText(displayText(title), {
      x: RIGHT_EDGE - fonts.display.widthOfTextAtSize(displayText(title), 10),
      y: 758,
      size: 10,
      font: fonts.display,
      color: NAVY,
    });
    page.drawText(fonts.clean(subtitle), {
      x: RIGHT_EDGE - fonts.body.widthOfTextAtSize(fonts.clean(subtitle), 8),
      y: 742,
      size: 8,
      font: fonts.body,
      color: MUTED,
    });
    page.drawLine({ start: { x: 54, y: 714 }, end: { x: RIGHT_EDGE, y: 714 }, thickness: 1, color: HEADER_RULE });
    page.drawLine({ start: { x: 54, y: 42 }, end: { x: RIGHT_EDGE, y: 42 }, thickness: 1, color: TINT });
    pages.push(page);
    return page;
  };

  // What a block asks for, with the blocks it must stay with.
  const spaceBetween = (a: Placed, b: Placed) => Math.max(a.after, b.before);
  const roomFor = (index: number): number => {
    const block = placed[index];
    const next = placed[index + 1];
    return block.height + (block.keepWithNext && next && !next.startsPage ? spaceBetween(block, next) + roomFor(index + 1) : 0);
  };

  let page: PDFPage | null = null;
  let y = TOP;
  let after = 0;
  placed.forEach((block, index) => {
    let gap = page && !block.startsPage ? Math.max(after, block.before) : 0;
    if (!page || block.startsPage || y - gap - roomFor(index) < BOTTOM) {
      page = newPage();
      y = TOP;
      gap = 0;
    }
    block.draw(page, y - gap);
    y -= gap + block.height;
    after = block.after;
  });
  if (!pages.length) newPage();

  pages.forEach((target, index) => {
    drawSegs(target, [{ text: fonts.clean(footer), bold: false }], 54, 28, 7, MUTED);
    const count = `${index + 1} / ${pages.length}`;
    drawSegs(target, [{ text: count, bold: false }], RIGHT_EDGE - fonts.body.widthOfTextAtSize(count, 7), 28, 7, MUTED);
  });

  return { bytes: await pdfDoc.save(), pageCount: pages.length };
}

export async function renderContractPdf(lines: ContractLine[], options: { signature?: SignatureStamp } = {}): Promise<Uint8Array> {
  return (await renderContractDocument(lines, options)).bytes;
}
