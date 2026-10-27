import { PDFArray, PDFDict, PDFDocument, PDFName, PDFRawStream, PDFStream, decodePDFRawStream } from "pdf-lib";
import type { PDFRef } from "pdf-lib";

// Reads back the text a pdf-lib PDF draws, for tests. Embedded fonts show their text as glyph numbers: the
// font's ToUnicode table turns them into characters again; the built-in fonts write plain Windows-1252 bytes.

export type DrawnText = { page: number; x: number; y: number; text: string };

const bytesOf = (stream: PDFRawStream) => Buffer.from(decodePDFRawStream(stream).decode());

// "<0001> <0041>" pairs of a ToUnicode table: glyph number -> text.
function glyphTexts(cmap: string): Map<number, string> {
  const map = new Map<number, string>();
  const chars = cmap.slice(cmap.indexOf("beginbfchar"));
  for (const [, glyph, unicode] of chars.matchAll(/<([0-9a-f]{4})>\s*<([0-9a-f]+)>/gi)) {
    const units = unicode.match(/.{4}/g) ?? [];
    map.set(parseInt(glyph, 16), String.fromCharCode(...units.map((unit) => parseInt(unit, 16))));
  }
  return map;
}

// Every piece of text drawn on the pages, in the order it was drawn, with where its baseline starts. A line of the
// contract is a few pieces side by side (bold and plain passages).
export async function readPdfText(bytes: Uint8Array): Promise<DrawnText[]> {
  const pdf = await PDFDocument.load(bytes);
  const drawn: DrawnText[] = [];
  pdf.getPages().forEach((page, pageIndex) => {
    const glyphsByFont = new Map<string, Map<number, string> | null>();
    const fonts = page.node.Resources()?.lookupMaybe(PDFName.of("Font"), PDFDict);
    for (const [name, ref] of fonts?.entries() ?? []) {
      const font = pdf.context.lookup(ref, PDFDict);
      const toUnicode = font.lookupMaybe(PDFName.of("ToUnicode"), PDFStream);
      glyphsByFont.set(name.decodeText(), toUnicode instanceof PDFRawStream ? glyphTexts(bytesOf(toUnicode).toString("latin1")) : null);
    }

    const contents = page.node.Contents();
    const streams = (contents instanceof PDFArray ? Array.from({ length: contents.size() }, (_, i) => pdf.context.lookup(contents.get(i) as PDFRef)) : [contents]).filter(
      (stream): stream is PDFRawStream => stream instanceof PDFRawStream,
    );
    const content = streams.map((stream) => bytesOf(stream).toString("latin1")).join("\n");

    // `/F1 8.5 Tf` picks the font, `a b c d x y Tm` places the text, `<hex> Tj` shows it.
    const number = "(-?[\\d.]+(?:e-?\\d+)?)";
    const operators = new RegExp(`/(\\S+)\\s+[\\d.]+\\s+Tf|${Array(6).fill(number).join("\\s+")}\\s+Tm|<([0-9A-Fa-f]+)>\\s*Tj`, "g");
    let font = "";
    let x = 0;
    let y = 0;
    for (const match of content.matchAll(operators)) {
      if (match[1]) {
        font = match[1];
      } else if (match[7] !== undefined) {
        x = Number(match[6]);
        y = Number(match[7]);
      } else {
        const glyphs = glyphsByFont.get(font);
        const text = glyphs
          ? (match[8].match(/.{4}/g) ?? []).map((glyph) => glyphs.get(parseInt(glyph, 16)) ?? "").join("")
          : Buffer.from(match[8], "hex").toString("latin1");
        drawn.push({ page: pageIndex, x, y, text });
      }
    }
  });
  return drawn;
}

// The text of each page in reading order, in one string: pieces separated by a space, no-break spaces plain, runs of
// spaces collapsed. Good for finding a phrase, whatever the line breaks and the bold passages around it.
export async function readPdfPages(bytes: Uint8Array): Promise<string[]> {
  const drawn = await readPdfText(bytes);
  const pages = Math.max(-1, ...drawn.map((item) => item.page)) + 1;
  return Array.from({ length: pages }, (_, page) =>
    drawn
      .filter((item) => item.page === page)
      .map((item) => item.text)
      .join(" ")
      .replace(/[\u00a0\s]+/g, " ")
      .trim(),
  );
}
